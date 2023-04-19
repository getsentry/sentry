import {Component} from 'react';
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

import DatabaseChartView from './databaseChartView';
import DatabaseTableView, {DataRow} from './databaseTableView';
import QueryDetail from './panel';

type Props = {
  location: Location;
  organization: Organization;
};

function getOptions() {
  const prefix = <span>{t('Operation')}</span>;

  return [
    'DELETE',
    'INSERT',
    'ROLLBACK',
    'SAVEPOINT',
    'SELECT',
    'UPDATE',
    'connect',
    'delete',
  ].map(action => {
    return {
      value: action,
      prefix,
      label: action,
    };
  });
}

type State = {
  action: string;
  transaction: string;
  selectedRow?: DataRow;
};

class DatabaseModule extends Component<Props, State> {
  state: State = {
    action: 'SELECT',
    transaction: '',
  };

  handleOptionChange(value) {
    this.setState({action: value});
  }

  handleSearch(query) {
    const conditions = new MutableSearch(query);
    const transactionValues = conditions.getFilterValues('transaction');
    if (transactionValues.length) {
      return this.setState({transaction: transactionValues[0]});
    }
    if (conditions.freeText.length > 0) {
      // raw text query will be wrapped in wildcards in generatePerformanceEventView
      // so no need to wrap it here
      return this.setState({transaction: conditions.freeText.join(' ')});
    }
    return this.setState({transaction: ''});
  }

  render() {
    const {location, organization} = this.props;
    const {action, transaction} = this.state;
    const eventView = EventView.fromLocation(location);
    const setSelectedRow = (row: DataRow) => this.setState({selectedRow: row});
    const unsetSelectedSpanGroup = () => this.setState({selectedRow: undefined});

    return (
      <Layout.Page>
        <PageErrorProvider>
          <Layout.Header>
            <Layout.HeaderContent>
              <Layout.Title>{t('Database')}</Layout.Title>
            </Layout.HeaderContent>
          </Layout.Header>

          <Layout.Body>
            <Layout.Main fullWidth>
              <PageErrorAlert />
              <DatabaseChartView location={location} />
              <CompactSelect
                value={action}
                options={getOptions()}
                onChange={opt => this.handleOptionChange(opt.value)}
              />
              <TransactionNameSearchBar
                organization={organization}
                eventView={eventView}
                onSearch={(query: string) => this.handleSearch(query)}
                query={transaction}
              />
              <DatabaseTableView
                location={location}
                action={action}
                transaction={transaction}
                onSelect={setSelectedRow}
              />
              <QueryDetail row={selectedRow} onClose={unsetSelectedSpanGroup} />
            </Layout.Main>
          </Layout.Body>
        </PageErrorProvider>
      </Layout.Page>
    );
  }
}

export default withOrganization(DatabaseModule);
