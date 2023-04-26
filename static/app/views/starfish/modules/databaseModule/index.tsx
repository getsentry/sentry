import {Component} from 'react';
import styled from '@emotion/styled';
import {Location} from 'history';

import DatePageFilter from 'sentry/components/datePageFilter';
import * as Layout from 'sentry/components/layouts/thirds';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {
  PageErrorAlert,
  PageErrorProvider,
} from 'sentry/utils/performance/contexts/pageError';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';

import DatabaseChartView from './databaseChartView';
import DatabaseTableView, {DataRow} from './databaseTableView';
import QueryDetail from './panel';

type Props = {
  location: Location;
};

type State = {
  action: string;
  table: string;
  transaction: string;
  selectedRow?: DataRow;
};

class DatabaseModule extends Component<Props, State> {
  state: State = {
    action: 'ALL',
    transaction: '',
    table: 'ALL',
  };

  handleSearch(query) {
    const conditions = new MutableSearch(query);
    const transactionValues = conditions.getFilterValues('transaction');
    if (transactionValues.length) {
      return this.setState({transaction: transactionValues[0]});
    }
    if (conditions.freeText.length > 0) {
      // so no need to wrap it here
      return this.setState({transaction: conditions.freeText.join(' ')});
    }
    return this.setState({transaction: ''});
  }

  render() {
    const {location} = this.props;
    const {table, action, transaction} = this.state;
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
              <FilterOptionsContainer>
                <DatePageFilter alignDropdown="left" />
              </FilterOptionsContainer>
              <DatabaseChartView
                location={location}
                action={action}
                table={table}
                onChange={(key, val) => {
                  if (key === 'action') {
                    this.setState({action: val});
                    this.setState({table: 'ALL'});
                  } else {
                    this.setState({table: val});
                  }
                }}
              />
              <DatabaseTableView
                location={location}
                action={action !== 'ALL' ? action : undefined}
                table={table !== 'ALL' ? table : undefined}
                transaction={transaction}
                onSelect={setSelectedRow}
              />
              <QueryDetail
                row={this.state.selectedRow}
                onClose={unsetSelectedSpanGroup}
              />
            </Layout.Main>
          </Layout.Body>
        </PageErrorProvider>
      </Layout.Page>
    );
  }
}

export default DatabaseModule;

const FilterOptionsContainer = styled('div')`
  display: flex;
  flex-direction: row;
  gap: ${space(1)};
  margin-bottom: ${space(2)};
`;
