import React from 'react';
import moment from 'moment';

import getDynamicText from 'app/utils/getDynamicText';

import LoadingIndicator from 'app/components/loadingIndicator';
import {t, tct} from 'app/locale';

import {fetchSavedQueries} from '../utils';
import {
  Fieldset,
  LoadingContainer,
  SavedQueryList,
  SavedQueryListItem,
  SavedQueryLink,
  SavedQueryUpdated,
} from '../styles';
import {Organization, SavedQuery} from '../types';

// TODO: Find better way to use wrong styled components
const SavedQueryListItemAny = SavedQueryListItem as any;

type SavedQueriesProps = {
  organization: Organization;
  savedQuery: SavedQuery;
};

type SavedQueriesState = {
  isLoading: boolean;
  data: SavedQuery[];
  topSavedQuery: SavedQuery;
};

export default class SavedQueries extends React.Component<
  SavedQueriesProps,
  SavedQueriesState
> {
  constructor(props: SavedQueriesProps) {
    super(props);
    this.state = {
      isLoading: true,
      data: [],
      topSavedQuery: props.savedQuery,
    };
  }

  componentDidMount() {
    this.fetchAll();
  }

  componentWillReceiveProps(nextProps: SavedQueriesProps) {
    // Refetch on deletion
    if (!nextProps.savedQuery && this.props.savedQuery !== nextProps.savedQuery) {
      this.fetchAll();
    }

    // Update query in the list with new data
    if (nextProps.savedQuery && nextProps.savedQuery !== this.props.savedQuery) {
      const data = this.state.data.map(savedQuery =>
        savedQuery.id === nextProps.savedQuery.id ? nextProps.savedQuery : savedQuery
      );
      this.setState({data});
    }

    // Update saved query if any name / details have been updated
    if (
      nextProps.savedQuery &&
      (!this.state.topSavedQuery ||
        nextProps.savedQuery.id === this.state.topSavedQuery.id)
    ) {
      this.setState({
        topSavedQuery: nextProps.savedQuery,
      });
    }
  }

  fetchAll() {
    fetchSavedQueries(this.props.organization)
      .then((data: SavedQuery[]) => {
        this.setState({isLoading: false, data});
      })
      .catch(() => {
        this.setState({isLoading: false});
      });
  }

  renderLoading() {
    return (
      <Fieldset>
        <LoadingContainer>
          <LoadingIndicator mini />
        </LoadingContainer>
      </Fieldset>
    );
  }

  renderEmpty() {
    return <Fieldset>{t('No saved queries')}</Fieldset>;
  }

  renderListItem(query: SavedQuery) {
    const {savedQuery} = this.props;

    const {id, name, dateUpdated} = query;
    const {organization} = this.props;
    return (
      <SavedQueryListItemAny key={id} isActive={savedQuery && savedQuery.id === id}>
        <SavedQueryLink to={`/organizations/${organization.slug}/discover/saved/${id}/`}>
          {getDynamicText({value: name, fixed: 'saved query'})}
          <SavedQueryUpdated>
            {tct('Updated [date] (UTC)', {
              date: getDynamicText({
                value: moment.utc(dateUpdated).format('MMM DD HH:mm:ss'),
                fixed: 'update-date',
              }),
            })}
          </SavedQueryUpdated>
        </SavedQueryLink>
      </SavedQueryListItemAny>
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
