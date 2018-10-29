import React from 'react';
import moment from 'moment';
import {Flex} from 'grid-emotion';

import SentryTypes from 'app/sentryTypes';

import LoadingIndicator from 'app/components/loadingIndicator';
import {t, tct} from 'app/locale';

import {fetchSavedQueries} from '../utils';
import {
  Fieldset,
  SavedQueryList,
  SavedQueryListItem,
  SavedQueryLink,
  SavedQueryUpdated,
} from '../styles';

export default class SavedQueries extends React.Component {
  static propTypes = {
    organization: SentryTypes.Organization.isRequired,
    // provided if it's a saved query
    savedQuery: SentryTypes.DiscoverSavedQuery,
  };

  constructor(props) {
    super(props);
    this.state = {isLoading: true, data: [], topSavedQuery: props.savedQuery};
  }

  componentDidMount() {
    this.fetchAll();
  }

  componentWillReceiveProps(nextProps) {
    // Refetch on deletion
    if (!nextProps.savedQuery && this.props.savedQuery !== nextProps.savedQuery) {
      this.fetchAll();
    }
    // Update saved query if any name / details have been updated
    if (
      nextProps.savedQuery &&
      this.state.topSavedQuery &&
      nextProps.savedQuery.id === this.state.topSavedQuery.id
    ) {
      this.setState({
        topSavedQuery: nextProps.savedQuery,
      });
    }
  }

  fetchAll() {
    fetchSavedQueries(this.props.organization)
      .then(data => {
        this.setState({isLoading: false, data});
      })
      .catch(() => {
        this.setState({isLoading: false});
      });
  }

  renderLoading() {
    return (
      <Fieldset>
        <Flex justify="center">
          <LoadingIndicator mini />
        </Flex>
      </Fieldset>
    );
  }

  renderEmpty() {
    return <Fieldset>{t('No saved queries')}</Fieldset>;
  }

  renderListItem(query) {
    const {savedQuery} = this.props;

    const {id, name, dateUpdated} = query;
    const {organization} = this.props;
    return (
      <SavedQueryListItem key={id} isActive={savedQuery && savedQuery.id === id}>
        <SavedQueryLink to={`/organizations/${organization.slug}/discover/saved/${id}/`}>
          {name}
          <SavedQueryUpdated>
            {tct('Updated [date] (UTC)', {
              date: moment.utc(dateUpdated).format('MMM DD HH:mm:ss'),
            })}
          </SavedQueryUpdated>
        </SavedQueryLink>
      </SavedQueryListItem>
    );
  }

  renderList() {
    const {data, topSavedQuery} = this.state;

    const savedQueryId = topSavedQuery ? topSavedQuery.id : null;

    if (!data.length) {
      return this.renderEmpty();
    }

    return data.map(query => {
      return query.id !== savedQueryId ? this.renderListItem(query) : null;
    });
  }

  render() {
    const {topSavedQuery, isLoading} = this.state;

    return (
      <SavedQueryList>
        {topSavedQuery && this.renderListItem(topSavedQuery)}
        {isLoading ? this.renderLoading() : this.renderList()}
      </SavedQueryList>
    );
  }
}
