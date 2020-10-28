import React from 'react';
import moment from 'moment';

import getDynamicText from 'app/utils/getDynamicText';
import LoadingIndicator from 'app/components/loadingIndicator';
import {t, tct} from 'app/locale';
import {Organization} from 'app/types';

import {fetchSavedQueries} from '../utils';
import {
  Fieldset,
  LoadingContainer,
  SavedQueryList,
  SavedQueryListItem,
  SavedQueryLink,
  SavedQueryUpdated,
} from '../styles';
import {SavedQuery} from '../types';

type SavedQueriesProps = {
  organization: Organization;
  savedQuery: SavedQuery | null;
};

type SavedQueriesState = {
  isLoading: boolean;
  data: SavedQuery[];
  savedQuery: SavedQuery | null;
};

export default class SavedQueries extends React.Component<
  SavedQueriesProps,
  SavedQueriesState
> {
  state: SavedQueriesState = {
    isLoading: true,
    data: [],
    savedQuery: null,
  };

  static getDerivedStateFromProps(
    nextProps: SavedQueriesProps,
    prevState: SavedQueriesState
  ): Partial<SavedQueriesState> {
    const nextState: Partial<SavedQueriesState> = {};

    if (nextProps.savedQuery && nextProps.savedQuery !== prevState.savedQuery) {
      nextState.data = prevState.data.map(q =>
        q.id === nextProps.savedQuery!.id ? nextProps.savedQuery! : q
      );
    }

    return nextState;
  }

  componentDidMount() {
    this.fetchAll();
  }

  componentDidUpdate(prevProps) {
    // Re-fetch on deletion
    if (!this.props.savedQuery && prevProps.savedQuery) {
      this.fetchAll();
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
    const relativeLink = `/organizations/${organization.slug}/discover/saved/${id}/`;

    return (
      <SavedQueryListItem key={id} isActive={savedQuery && savedQuery.id === id}>
        <SavedQueryLink to={relativeLink}>
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
      </SavedQueryListItem>
    );
  }

  renderList() {
    const {data} = this.state;

    return data.length
      ? data.map(query => this.renderListItem(query))
      : this.renderEmpty();
  }

  render() {
    const {isLoading} = this.state;

    return (
      <SavedQueryList>
        {isLoading ? this.renderLoading() : this.renderList()}
      </SavedQueryList>
    );
  }
}
