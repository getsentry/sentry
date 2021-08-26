import {Component} from 'react';
import {Location} from 'history';

import {t} from 'app/locale';
import EventView from 'app/utils/discover/eventView';
import {decodeScalar} from 'app/utils/queryString';
import {MutableSearch} from 'app/utils/tokenizeSearch';

import {getTransactionName} from '../../utils';
import Page from '../page';

import TagsPageContent from './content';

type Props = {
  location: Location;
};

type State = {
  eventView: EventView | undefined;
};

class TransactionTags extends Component<Props> {
  state: State = {
    eventView: generateTagsEventView(
      this.props.location,
      getTransactionName(this.props.location)
    ),
  };

  static getDerivedStateFromProps(nextProps: Readonly<Props>, prevState: State): State {
    return {
      ...prevState,
      eventView: generateTagsEventView(
        nextProps.location,
        getTransactionName(nextProps.location)
      ),
    };
  }

  getDocumentTitle(): string {
    const name = getTransactionName(this.props.location);

    const hasTransactionName = typeof name === 'string' && String(name).trim().length > 0;

    if (hasTransactionName) {
      return [String(name).trim(), t('Tags')].join(' \u2014 ');
    }

    return [t('Summary'), t('Tags')].join(' \u2014 ');
  }

  render() {
    const {location} = this.props;
    const {eventView} = this.state;

    return (
      <Page
        title={this.getDocumentTitle()}
        location={location}
        eventView={eventView}
        featureFlags={['performance-tag-page']}
      >
        {contentProps => <TagsPageContent {...contentProps} />}
      </Page>
    );
  }
}

function generateTagsEventView(
  location: Location,
  transactionName: string | undefined
): EventView | undefined {
  if (transactionName === undefined) {
    return undefined;
  }
  const query = decodeScalar(location.query.query, '');
  const conditions = new MutableSearch(query);
  const eventView = EventView.fromNewQueryWithLocation(
    {
      id: undefined,
      version: 2,
      name: transactionName,
      fields: ['transaction.duration'],
      query: conditions.formatString(),
      projects: [],
    },
    location
  );

  eventView.additionalConditions.setFilterValues('event.type', ['transaction']);
  eventView.additionalConditions.setFilterValues('transaction', [transactionName]);
  return eventView;
}

export default TransactionTags;
