import {Component} from 'react';
import {Location} from 'history';

import {t} from 'app/locale';
import EventView from 'app/utils/discover/eventView';
import {isAggregateField, WebVital} from 'app/utils/discover/fields';
import {WEB_VITAL_DETAILS} from 'app/utils/performance/vitals/constants';
import {decodeScalar} from 'app/utils/queryString';
import {MutableSearch} from 'app/utils/tokenizeSearch';

import {getTransactionName} from '../../utils';
import Page from '../page';

import {PERCENTILE, VITAL_GROUPS} from './constants';
import RumContent from './content';

type Props = {
  location: Location;
};

type State = {
  eventView: EventView | undefined;
};

class TransactionVitals extends Component<Props, State> {
  state: State = {
    eventView: generateRumEventView(
      this.props.location,
      getTransactionName(this.props.location)
    ),
  };

  static getDerivedStateFromProps(nextProps: Readonly<Props>, prevState: State): State {
    return {
      ...prevState,
      eventView: generateRumEventView(
        nextProps.location,
        getTransactionName(nextProps.location)
      ),
    };
  }

  getDocumentTitle(): string {
    const name = getTransactionName(this.props.location);

    const hasTransactionName = typeof name === 'string' && String(name).trim().length > 0;

    if (hasTransactionName) {
      return [String(name).trim(), t('Vitals')].join(' \u2014 ');
    }

    return [t('Summary'), t('Vitals')].join(' \u2014 ');
  }

  render() {
    const {location} = this.props;
    const {eventView} = this.state;

    return (
      <Page title={this.getDocumentTitle()} location={location} eventView={eventView}>
        {contentProps => <RumContent {...contentProps} />}
      </Page>
    );
  }
}

function generateRumEventView(
  location: Location,
  transactionName: string | undefined
): EventView | undefined {
  if (transactionName === undefined) {
    return undefined;
  }
  const query = decodeScalar(location.query.query, '');
  const conditions = new MutableSearch(query);
  conditions
    .setFilterValues('event.type', ['transaction'])
    .setFilterValues('transaction.op', ['pageload'])
    .setFilterValues('transaction', [transactionName]);

  Object.keys(conditions.filters).forEach(field => {
    if (isAggregateField(field)) conditions.removeFilter(field);
  });

  const vitals = VITAL_GROUPS.reduce((allVitals: WebVital[], group) => {
    return allVitals.concat(group.vitals);
  }, []);

  return EventView.fromNewQueryWithLocation(
    {
      id: undefined,
      version: 2,
      name: transactionName,
      fields: [
        ...vitals.map(vital => `percentile(${vital}, ${PERCENTILE})`),
        ...vitals.map(vital => `count_at_least(${vital}, 0)`),
        ...vitals.map(
          vital => `count_at_least(${vital}, ${WEB_VITAL_DETAILS[vital].poorThreshold})`
        ),
      ],
      query: conditions.formatString(),
      projects: [],
    },
    location
  );
}

export default TransactionVitals;
