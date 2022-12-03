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
    password: "changeme",
    port: 5432
});


describe("Multiple transaction manager PostgreSQL workflow test...", () => {

    beforeAll(() => { global.console = require('console'); });

    test("Success-commit case", async () => {

        // init manager & context
        const txnMngr: MultiTxnMngr = new MultiTxnMngr();
        const pgContext = new PgDBContext(txnMngr, pool);
        const functionContext = new FunctionContext(txnMngr);

        // Add first step
        pgContext.addTask("DELETE FROM test_table");

        // Add second step
        pgContext.addTask("INSERT INTO test_table(id, name) VALUES (:id, :name)", { "id": 1, "name": "Dave" });

        // Add third step
        functionContext.addTask(
            (task) => { return new Promise((resolve, _) => { console.log("All done."); resolve(task); }); },
            null, // optional params
            (task) => { return new Promise((resolve, _) => { console.log("On Txn Commit..."); resolve(task); }); },
            (task) => { return new Promise((resolve, _) => { console.log("On Txn Rollback..."); resolve(task); }); }
        );


        await expect(txnMngr.exec()).resolves.not.toBeNull();

    });


    test("Fail-rollback case", async () => {

        // init manager & context
        const txnMngr: MultiTxnMngr = new MultiTxnMngr();
        const pgContext = new PgDBContext(txnMngr, pool);
        const functionContext = new FunctionContext(txnMngr);

        // Add first step
        pgContext.addTask("DELETE FROM test_table");

        // Add second step
        pgContext.addTask("INSERT INTO test_table(id, name) VALUES (:id, :name)", { "id": 1, "name": "Dave" });

        // Add third step -> Causes primary key violation
        pgContext.addTask("INSERT INTO test_table(id, name) VALUES (:id, :name)", { "id": 1, "name": "Kevin" });

        // Add last step -> should not execute
        functionContext.addTask(
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
        const pgContext = new PgDBContext(txnMngr, pool);

        // Add first step
        pgContext.addTask("DELETE FROM test_table");

        // Add second step
        pgContext.addFunctionTask(
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
        const controlTask: Task = pgContext.addTask("SELECT * FROM test_table");

        await txnMngr.exec();

        expect(controlTask.getResult().rows[0]["name"]).toEqual("Stuart");
    });


    afterAll(() => { pool.end(); });

});