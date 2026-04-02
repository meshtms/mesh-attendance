declare module 'sql.js' {
  interface Database {
    run(sql: string, params?: unknown[]): void
    exec(sql: string): { columns: string[]; values: unknown[][] }[]
    prepare(sql: string): Statement
    export(): Uint8Array
    getRowsModified(): number
  }

  interface Statement {
    bind(params?: unknown[]): void
    step(): boolean
    get(): unknown[]
    run(params?: unknown[]): void
    free(): void
  }

  interface SqlJsStatic {
    Database: new (data?: ArrayLike<number>) => Database
  }

  export default function initSqlJs(): Promise<SqlJsStatic>
  export { Database, Statement }
}
