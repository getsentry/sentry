/**
 * The supported relational database system values are based on what is
 * set in the Sentry Python SDK. The only currently supported NoSQL DBMS is MongoDB.
 *
 * https://github.com/getsentry/sentry-python/blob/master/sentry_sdk/integrations/sqlalchemy.py#L125
 */
export enum SupportedDatabaseSystem {
  // SQL
  SQLITE = 'sqlite',
  POSTGRESQL = 'postgresql',
  MARIADB = 'mariadb',
  MYSQL = 'mysql',
  ORACLE = 'oracle',
  // NoSQL
  MONGODB = 'mongodb',
}

export const DATABASE_SYSTEM_TO_LABEL: Record<SupportedDatabaseSystem, string> = {
  [SupportedDatabaseSystem.SQLITE]: 'SQLite',
  [SupportedDatabaseSystem.POSTGRESQL]: 'PostgreSQL',
  [SupportedDatabaseSystem.MARIADB]: 'MariaDB',
  [SupportedDatabaseSystem.MYSQL]: 'MySQL',
  [SupportedDatabaseSystem.ORACLE]: 'Oracle',
  [SupportedDatabaseSystem.MONGODB]: 'MongoDB',
};
