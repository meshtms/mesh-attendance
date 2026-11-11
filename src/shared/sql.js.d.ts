declare module 'sql.js' {
  interface Database {
    run(sql: string, params?: unknown[]): void
    exec(sql: string): { columns: string[]; values: unknown[][] }[]
    prepare(sql: string): Statement
    export(): Uint8Array
    getRowsModified(): number
    close(): void
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

  interface SqlJsConfig {
    locateFile?: (file: string) => string
  }

  export default function initSqlJs(config?: SqlJsConfig): Promise<SqlJsStatic>
  export { Database, Statement, SqlJsStatic, SqlJsConfig }
}
