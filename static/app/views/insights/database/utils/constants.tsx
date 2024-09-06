/**
 * The supported relational database system values are based on what is
 * set in the Sentry Python SDK. The only currently supported NoSQL DBMS is MongoDB.
 *
 * https://github.com/getsentry/sentry-python/blob/master/sentry_sdk/integrations/sqlalchemy.py#L125
 */
export enum SupportedDatabaseSystems {
  // SQL
  SQLITE = 'sqlite',
  POSTGRESQL = 'postgresql',
  MARIADB = 'mariadb',
  MYSQL = 'mysql',
  ORACLE = 'oracle',
  // NoSQL
  MONGODB = 'mongodb',
}

export const DATABASE_SYSTEM_TO_LABEL: Record<SupportedDatabaseSystems, string> = {
  [SupportedDatabaseSystems.SQLITE]: 'SQLite',
  [SupportedDatabaseSystems.POSTGRESQL]: 'PostgreSQL',
  [SupportedDatabaseSystems.MARIADB]: 'MariaDB',
  [SupportedDatabaseSystems.MYSQL]: 'MySQL',
  [SupportedDatabaseSystems.ORACLE]: 'Oracle',
  [SupportedDatabaseSystems.MONGODB]: 'MongoDB',
};
