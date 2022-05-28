import log4js from "log4js";
import { Context, MultiTxnMngr, Task } from "multiple-transaction-manager";
import { Pool, PoolClient, QueryResult } from "pg";
declare class PgDBContext implements Context {
    connPool: Pool;
    txn: PoolClient | undefined;
    done: ((release?: any) => void) | undefined;
    contextId: string;
    logger: log4js.Logger;
    constructor(connPool: Pool);
    init(): Promise<Context>;
    commit(): Promise<Context>;
    rollback(): Promise<Context>;
    isInitialized(): boolean;
    getName(): string;
    getTransaction(): PoolClient;
    addTask(txnMngr: MultiTxnMngr, querySql: string, params?: any | undefined): void;
    addFunctionTask(txnMngr: MultiTxnMngr, execFunc: ((txn: PoolClient, task: Task) => Promise<any | undefined>) | undefined): void;
}
declare class PgDBTask implements Task {
    params: any;
    context: PgDBContext;
    querySql: string;
    rs: QueryResult<any> | undefined;
    execFunc: ((txn: PoolClient, task: Task) => Promise<any | undefined>) | undefined;
    constructor(context: PgDBContext, querySql: string, params: any, execFunc: ((txn: PoolClient, task: Task) => Promise<any | undefined>) | undefined);
    getContext(): PgDBContext;
    exec(): Promise<Task>;
    setParams(params: any): void;
    getResult(): any | undefined;
}
export { PgDBContext, PgDBTask };
