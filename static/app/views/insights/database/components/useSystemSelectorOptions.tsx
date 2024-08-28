import type {SelectOption} from 'sentry/components/compactSelect';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';
import {useSpanMetrics} from 'sentry/views/insights/common/queries/useDiscover';
import {SpanMetricsField} from 'sentry/views/insights/types';

/**
 * The supported relational database system values are based on what is
 * set in the Sentry Python SDK. The only currently supported NoSQL DBMS is MongoDB.
 *
 * https://github.com/getsentry/sentry-python/blob/master/sentry_sdk/integrations/sqlalchemy.py#L125
 */
enum SupportedDatabaseSystems {
  // SQL
  SQLITE = 'sqlite',
  POSTGRESQL = 'postgresql',
  MARIADB = 'mariadb',
  MYSQL = 'mysql',
  ORACLE = 'oracle',
  // NoSQL
  MONGODB = 'mongodb',
}

const DATABASE_SYSTEM_TO_LABEL: Record<SupportedDatabaseSystems, string> = {
  [SupportedDatabaseSystems.SQLITE]: 'SQLite',
  [SupportedDatabaseSystems.POSTGRESQL]: 'PostgreSQL',
  [SupportedDatabaseSystems.MARIADB]: 'MariaDB',
  [SupportedDatabaseSystems.MYSQL]: 'MySQL',
  [SupportedDatabaseSystems.ORACLE]: 'Oracle',
  [SupportedDatabaseSystems.MONGODB]: 'MongoDB',
};

export function useSystemSelectorOptions() {
  const [selectedSystem, setSelectedSystem] = useLocalStorageState<string>(
    'insights-db-system-selector',
    ''
  );

  const {data, isLoading, isError} = useSpanMetrics(
    {
      search: MutableSearch.fromQueryObject({'span.op': 'db'}),

      fields: [SpanMetricsField.SPAN_SYSTEM, 'count()'],
      sorts: [{field: 'count()', kind: 'desc'}],
    },
    'api.starfish.database-system-selector'
  );

  const options: SelectOption<string>[] = [];
  data.forEach(entry => {
    const system = entry['span.system'];
    if (system) {
      const label: string =
        system in DATABASE_SYSTEM_TO_LABEL ? DATABASE_SYSTEM_TO_LABEL[system] : system;

      options.push({value: system, label, textValue: label});
    }
  });

  // Edge case: Invalid DB system was retrieved from localStorage
  if (!options.find(option => selectedSystem === option.value) && options.length > 0) {
    setSelectedSystem(options[0].value);
  }

  // Edge case: No current system is saved in localStorage
  if (!selectedSystem && options.length > 0) {
    setSelectedSystem(options[0].value);
  }

  return {selectedSystem, setSelectedSystem, options, isLoading, isError};
}
