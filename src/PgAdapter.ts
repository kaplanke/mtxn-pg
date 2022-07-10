import log4js from "log4js";
import { Context, MultiTxnMngr, Task } from "multiple-transaction-manager";
import { Pool, PoolClient } from "pg";
import { v1 } from "uuid";

class PgDBContext implements Context {

    connPool: Pool;
    txn: PoolClient | undefined = undefined;
    done: ((release?: unknown) => void) | undefined = undefined;
    contextId: string;
    logger = log4js.getLogger("MultiTxnMngr");

    constructor(connPool: Pool) {
        this.connPool = connPool;
        this.contextId = v1();
    }

    init(): Promise<Context> {
        return new Promise((resolve, reject) => {
            if (this.isInitialized()) {
                reject("Context already initialised.");
            } else {
                try {
                    this.connPool.connect((err1, connection, done) => {
                        if (err1) {
                            reject(err1);
                        } else {
                            this.txn = connection;
                            this.done = done;
                            resolve(this);
                        }
                    });
                } catch (err) {
                    reject(err);
                }
            }
        });
    }

    commit(): Promise<Context> {
        return new Promise((resolve, reject) => {
            if (!this.isInitialized()) {
                reject("Cannot commit. Context not initialised.");
            } else {
                this.txn?.query("COMMIT", (err) => {
                    if (err) {
                        reject(err);
                    } else {
                        this.logger.debug(this.getName() + " is committed.");
                        resolve(this);
                    }
                    // todo: error handling??
                    if (this.done) this.done();
                    this.txn = undefined;
                    this.done = undefined;
                });
            }
        });
    }

    rollback(): Promise<Context> {
        return new Promise((resolve, reject) => {
            if (!this.isInitialized()) {
                reject("Cannot rollback. Context not initialised.");
            } else {
                this.txn?.query("ROLLBACK", (err) => {
                    if (err) {
                        reject(err);
                    } else {
                        this.logger.debug(this.getName() + " is rollbacked.");
                        resolve(this);
                    }
                    // todo: error handling??
                    if (this.done) this.done();
                    this.txn = undefined;
                    this.done = undefined;
                });
            }
        });
    }

    isInitialized(): boolean {
        return this.txn != undefined;
    }

    getName(): string {
        return "PostgreSQL DB Context: " + this.contextId;
    }

    getTransaction(): PoolClient {
        if (!this.txn)
            throw new Error("Transaction not initialised!");
        return this.txn;
    }

    addTask(txnMngr: MultiTxnMngr, querySql: string, params?: unknown | undefined): Task {
        const task = new PgDBTask(this, querySql, params, undefined);
        txnMngr.addTask(task);
        return task;
    }

    addFunctionTask(txnMngr: MultiTxnMngr,
        execFunc: ((txn: PoolClient, task: Task) => Promise<unknown | undefined>) | undefined): Task {
        const task = new PgDBTask(this, "", undefined, execFunc);
        txnMngr.addTask(task);
        return task;
    }
}

class PgDBTask implements Task {
    params: unknown;
    context: PgDBContext;
    querySql: string;
    rs: unknown | undefined; // {any, FieldInfo[]}
    execFunc: ((txn: PoolClient, task: Task) => Promise<unknown | undefined>) | undefined;

    constructor(context: PgDBContext,
        querySql: string,
        params: unknown,
        execFunc: ((txn: PoolClient, task: Task) => Promise<unknown | undefined>) | undefined) {
        this.context = context;
        this.querySql = querySql;
        if (params)
            this.params = params;
        if (execFunc)
            this.execFunc = execFunc;
    }

    getContext(): PgDBContext {
        return this.context;
    }

    exec(): Promise<Task> {
        return new Promise<Task>((resolveTask, rejectTask) => {
            if (this.execFunc) {
                this.execFunc(this.getContext().getTransaction(), this).then((res) => {
                    this.rs = res;
                    resolveTask(this);
                }).catch((err) => {
                    rejectTask(err);
                });
            } else {
                let params;
                if (this.params) {
                    if (this.params instanceof Function)
                        params = this.params();
                    else
                        params = this.params;
                }
                // eslint-disable-next-line @typescript-eslint/no-var-requires
                const sql = require('yesql').pg
                const q = sql(this.querySql)(params);
                this.getContext().getTransaction().query(q.text, q.values, (err, results) => {
                    if (err) {
                        rejectTask(err);
                    } else {
                        this.rs = results;
                        resolveTask(this);
                    }
                });
            }
        });
    }

    setParams(params: unknown) {
        this.params = params;
    }

    getResult(): unknown | undefined {
        return this.rs;
    }

}

export { PgDBContext, PgDBTask };

