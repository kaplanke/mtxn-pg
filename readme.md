# @multiple-transaction-manager/pg

> PostgreSQL context implementation for multiple-transaction-manager library. 

## API

### Classes

#### __PgDBContext__

####  `constructor(txnMngr, connPool)`
-   `txnMngr`: _{MultiTxnMngr}_ The multiple transaction manager to to bind with the context.
-   `connPool`: _{Pool}_ The PostgreSQL connection pool obtain the session from.
-   Returns: {PgDBContext} The created _PgDBContext_ instance.

#### `addFunctionTask(execFunc)`

Adds a task to the transaction manager.

-   `execFunc`: _{execFunc: (txn: PoolClient, task: Task) => Promise<unknown | undefined>) | undefined}_ The function to be executes in promise. PostgreSQL connection is provided to the function.
-   Returns: {PgDBTask} Returns the created _PgDBTask_ instance.

#### `addTask(querySql: string, params?: unknown | undefined)`

A shortcut to add a SQL task to the transaction manager.

-   `querySql`: _{string}_ The query string to be executes in promise.
-   `params`: _{unknown | undefined}_ Optional parameter object to bind SQL statement variables.
-   Returns: {PgDBTask} The created _PgDBTask_ instance.


#### __PgDBTask__

####  `constructor(context, querySql, params, execFunc)`
-   `context`: _{PgDBContext}_ The _PgDBContext_ to to bind with the task.
-   `querySql`: _{string}_ The query string to be executes in promise. __Ignored if execFunc parameter is provided__.
-   `params`: _{unknown | undefined}_ Optional parameter object to bind SQL statement variables. __Ignored if execFunc parameter is provided__.
-   `execFunc`: _{execFunc: (txn: PoolClient, task: Task) => Promise<unknown | undefined>) | undefined}_  The function to be executes in promise. PostgreSQL connection is provided to the function.
-   Returns: {PgDBTask} The created _PgDBTask_ instance.

## Example

https://github.com/kaplanke/mtxn-pg/blob/master/test/mtxn.pg.test.ts

```js

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
```
