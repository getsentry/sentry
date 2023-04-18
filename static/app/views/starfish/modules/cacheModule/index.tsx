import {useState} from 'react';
import {Location} from 'history';

import {CompactSelect} from 'sentry/components/compactSelect';
import * as Layout from 'sentry/components/layouts/thirds';
import TransactionNameSearchBar from 'sentry/components/performance/searchBar';
import {t} from 'sentry/locale';
import {Organization} from 'sentry/types';
import EventView from 'sentry/utils/discover/eventView';
import {
  PageErrorAlert,
  PageErrorProvider,
} from 'sentry/utils/performance/contexts/pageError';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import withOrganization from 'sentry/utils/withOrganization';
import CacheDetail from 'sentry/views/starfish/modules/cacheModule/cacheQueryDetail';

import CacheChartView from './cacheChartView';
import CacheTableView, {DataRow} from './cacheTableView';

type Props = {
  location: Location;
  organization: Organization;
};

function getOptions() {
  const prefix = <span>{t('Operation')}</span>;

  return [
    'SET',
    'GET',
    'INCRBY',
    'EXPIRE',
    'EVALSHA',
    'ZREM',
    'SISMEMBER',
    'SADD',
    'cluster',
  ].map(operation => {
    return {
      value: operation,
      prefix,
      label: operation,
    };
  });
}

function CacheModule(props: Props) {
  const [operation, setOperation] = useState<string>('SET');
  const [transaction, setTransaction] = useState<string>('');
  const [selectedRow, setSelectedRow] = useState<DataRow | null>(null);
  const {location, organization} = props;
  const eventView = EventView.fromLocation(location);

  const handleOptionChange = value => {
    setOperation(value);
  };

  const handleSearch = query => {
    const conditions = new MutableSearch(query);
    const transactionValues = conditions.getFilterValues('transaction');
    if (transactionValues.length) {
      setTransaction(transactionValues[0]);
    }
    if (conditions.freeText.length > 0) {
      // raw text query will be wrapped in wildcards in generatePerformanceEventView
      // so no need to wrap it here
      setTransaction(conditions.freeText.join(' '));
    }
    return setTransaction('');
  };

  return (
    <Layout.Page>
      <PageErrorProvider>
        <Layout.Header>
          <Layout.HeaderContent>
            <Layout.Title>{t('Cache')}</Layout.Title>
          </Layout.HeaderContent>
        </Layout.Header>

        <Layout.Body>
          <Layout.Main fullWidth>
            <PageErrorAlert />
            <CacheChartView location={location} />
            <CompactSelect
              value={operation}
              options={getOptions()}
              onChange={opt => handleOptionChange(opt.value)}
            />
            <TransactionNameSearchBar
              organization={organization}
              eventView={eventView}
              onSearch={(query: string) => handleSearch(query)}
              query={transaction}
            />
            <CacheTableView
              location={location}
              operation={operation}
              transaction={transaction}
              setSelectedRow={setSelectedRow}
            />
            {selectedRow && (
              <CacheDetail row={selectedRow} onClose={() => setSelectedRow(null)} />
            )}
          </Layout.Main>
        </Layout.Body>
      </PageErrorProvider>
    </Layout.Page>
  );
}

export default withOrganization(CacheModule);
