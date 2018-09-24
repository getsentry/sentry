import React from 'react';
// import PropTypes from 'prop-types';

import SentryTypes from 'app/sentryTypes';

import Link from 'app/components/link';
import LoadingIndicator from 'app/components/loadingIndicator';
import {t} from 'app/locale';

import {fetchSavedQueries} from '../utils';
import {Fieldset, SavedQueryList, SavedQueryListItem} from '../styles';

export default class SavedQueries extends React.Component {
  static propTypes = {
    organization: SentryTypes.Organization.isRequired,
  };

  constructor() {
    super();
    this.state = {isLoading: true};
  }

  componentWillMount() {
    fetchSavedQueries(this.props.organization)
      .then(data => {
        this.setState({isLoading: false, data});
      })
      .catch(err => {
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
    return <Fieldset>{t('No saved searches')}</Fieldset>;
  }

  renderList() {
    const {organization} = this.props;
    const {data} = this.state;

    if (!data.length) {
      return this.renderEmpty();
    }

    return (
      <SavedQueryList>
        {data.map(({id, name}) => (
          <SavedQueryListItem key={id}>
            <Link to={`/organizations/${organization.slug}/discover/saved/${id}/`}>
              {name}
            </Link>
          </SavedQueryListItem>
        ))}
      </SavedQueryList>
    );
  }

  render() {
    const {isLoading} = this.state;
    return isLoading ? this.renderEmpty() : this.renderList();
  }
}
