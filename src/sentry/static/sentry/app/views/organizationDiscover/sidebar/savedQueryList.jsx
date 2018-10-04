import React from 'react';
import moment from 'moment';

import SentryTypes from 'app/sentryTypes';

import LoadingIndicator from 'app/components/loadingIndicator';
import {t, tct} from 'app/locale';

import {fetchSavedQueries} from '../utils';
import {
  Fieldset,
  SavedQuery,
  SavedQueryList,
  SavedQueryListItem,
  SavedQueryLink,
  SavedQueryUpdated,
} from '../styles';

export default class SavedQueries extends React.Component {
  static propTypes = {
    organization: SentryTypes.Organization.isRequired,
  };

  constructor() {
    super();
    this.state = {isLoading: true, data: []};
  }

  componentDidMount() {
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
        <LoadingIndicator mini />
      </Fieldset>
    );
  }

  renderEmpty() {
    return <Fieldset>{t('No saved queries')}</Fieldset>;
  }

  renderList() {
    const {organization} = this.props;
    const {data} = this.state;

    if (!data.length) {
      return this.renderEmpty();
    }

    return (
      <SavedQueryList>
        {data.map(({id, name, dateUpdated}) => (
          <SavedQueryListItem key={id}>
            <SavedQueryLink
              to={`/organizations/${organization.slug}/discover/saved/${id}/`}
            >
              {name}
            </SavedQueryLink>
            <SavedQueryUpdated>
              {tct('Updated [date] (UTC)', {
                date: moment.utc(dateUpdated).format('MMM DD HH:mm:ss'),
              })}
            </SavedQueryUpdated>
          </SavedQueryListItem>
        ))}
      </SavedQueryList>
    );
  }

  render() {
    const {isLoading} = this.state;
    return (
      <SavedQuery>{isLoading ? this.renderLoading() : this.renderList()}</SavedQuery>
    );
  }
}
