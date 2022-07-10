import { afterAll, beforeAll, describe, expect, test } from '@jest/globals';
import log4js from "log4js";
import { FunctionContext, MultiTxnMngr, Task } from "multiple-transaction-manager";
import { Pool } from "pg";
import { PgDBContext } from "../src/index";

log4js.configure({
    appenders: { 'out': { type: 'stdout' } },
    categories: { default: { appenders: ['out'], level: 'debug' } }
});

const pool = new Pool({
    user: "postgres",
    host: "localhost",
    database: "mtxnmngr",
    password: "1q2w3e4r",
    port: 5432
});


describe("Multiple transaction manager PostgreSQL workflow test...", () => {

    beforeAll(() => { global.console = require('console'); });

    test("Success-commit case", async () => {

        // init manager
        const txnMngr: MultiTxnMngr = new MultiTxnMngr();

        const pgContext = new PgDBContext(pool);

        // Add first step
        pgContext.addTask(txnMngr, "DELETE FROM test_table");

        // Add second step
        pgContext.addTask(txnMngr, "INSERT INTO test_table(id, name) VALUES (:id, :name)", { "id": 1, "name": "Dave" });

        // Add third step
        FunctionContext.addTask(txnMngr,
            (task) => { return new Promise((resolve, _) => { console.log("All done."); resolve(task); }); },
            null, // optional params
            (task) => { return new Promise((resolve, _) => { console.log("Committing..."); resolve(task); }); },
            (task) => { return new Promise((resolve, _) => { console.log("Rolling back..."); resolve(task); }); }
        );


        await expect(txnMngr.exec()).resolves.not.toBeNull();

    });


    test("Fail-rollback case", async () => {

        // init manager
        const txnMngr: MultiTxnMngr = new MultiTxnMngr();

        const pgContext = new PgDBContext(pool);

        // Add first step
        pgContext.addTask(txnMngr, "DELETE FROM test_table");

        // Add second step
        pgContext.addTask(txnMngr, "INSERT INTO test_table(id, name) VALUES (:id, :name)", { "id": 1, "name": "Dave" });

        // Add third step -> Causes primary key violation
        pgContext.addTask(txnMngr, "INSERT INTO test_table(id, name) VALUES (:id, :name)", { "id": 1, "name": "Kevin" });

        // Add last step -> should not execute
        FunctionContext.addTask(txnMngr,
            (task) => {
                return new Promise((resolve, _reject) => {
                    console.log("Face the thing that should not be..."); resolve(task);
                });
            },
            null, // optional params
            (task) => Promise.resolve(task),
            (task) => Promise.resolve(task)
        );


        await expect(txnMngr.exec()).rejects.not.toBeNull();

    });

    test("Function task example", async () => {

        // init manager
        const txnMngr: MultiTxnMngr = new MultiTxnMngr();

        const pgContext = new PgDBContext(pool);

        // Add first step
        pgContext.addTask(txnMngr, "DELETE FROM test_table");

        // Add second step
        pgContext.addFunctionTask(txnMngr,
            (txn, _task) => {
                return new Promise<unknown | undefined>((resolve, reject) => {
                    txn.query("INSERT INTO test_table(id, name) VALUES (1, 'Stuart')", [], (err, results) => {
                        if (err) {
                            reject(err);
                        } else {
                            resolve(results);
                        }
                    });
                });
            });

        // Add control step
        const controlTask: Task = pgContext.addTask(txnMngr, "SELECT * FROM test_table");

        await txnMngr.exec();

        expect(controlTask.getResult().rows[0]["name"]).toEqual("Stuart");
    });


    afterAll(() => { pool.end(); });

});