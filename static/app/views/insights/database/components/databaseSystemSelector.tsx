import {CompactSelect} from 'sentry/components/compactSelect';
import {t} from 'sentry/locale';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useSpanMetrics} from 'sentry/views/insights/common/queries/useDiscover';
import {SpanMetricsField} from 'sentry/views/insights/types';

/**
 * The supported relational database system values are based on what is
 * set in the Sentry Python SDK. The only supported NoSQL DBMS is MongoDB.
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

export function DatabaseSystemSelector() {
  const handleChange = () => {};

  const {data, isLoading, isError} = useSpanMetrics(
    {
      search: MutableSearch.fromQueryObject({'span.op': 'db'}),

      fields: [SpanMetricsField.SPAN_SYSTEM, 'count()'],
      sorts: [{field: 'count()', kind: 'desc'}],
    },
    'api.starfish.database-system-selector'
  );

  // No point in displaying the dropdown if there is only one option
  if (data.length <= 1) {
    return null;
  }

  const options = data.map(entry => {
    const system = entry['span.system'];
    const label =
      system in DATABASE_SYSTEM_TO_LABEL
        ? DATABASE_SYSTEM_TO_LABEL[system]
        : system === ''
          ? t('Unknown')
          : system;

    return {value: system, label};
  });

  const getDefaultValue = () => {
    if (isLoading || isError) {
      return t('—');
    }

    return options[0].value;
  };

  return (
    <CompactSelect
      onChange={handleChange}
      options={options}
      triggerProps={{prefix: t('DB System')}}
      defaultValue={getDefaultValue()}
      disabled={isLoading || isError}
    />
  );
}
