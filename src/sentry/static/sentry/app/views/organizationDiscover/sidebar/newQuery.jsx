import PropTypes from 'prop-types';
import React from 'react';
import {browserHistory} from 'react-router';

import Button from 'app/components/button';
import {t, tct} from 'app/locale';
import {addSuccessMessage, addErrorMessage} from 'app/actionCreators/indicator';
import SentryTypes from 'app/sentryTypes';

import QueryFields from './queryFields';
import {createSavedQuery, generateQueryName} from '../utils';
import {
  ButtonSpinner,
  QueryActions,
  QueryActionsGroup,
  QueryFieldsContainer,
} from '../styles';

export default class NewQuery extends React.Component {
  static propTypes = {
    organization: SentryTypes.Organization,
    queryBuilder: PropTypes.object.isRequired,
    onRunQuery: PropTypes.func.isRequired,
    onReset: PropTypes.func.isRequired,
    onUpdateField: PropTypes.func.isRequired,
    isFetchingQuery: PropTypes.bool.isRequired,
    isLoading: PropTypes.bool.isRequired,
  };

  saveQuery() {
    const {organization, queryBuilder} = this.props;
    const savedQueryName = generateQueryName();
    const data = {...queryBuilder.getInternal(), name: savedQueryName};

    createSavedQuery(organization, data)
      .then(savedQuery => {
        addSuccessMessage(tct('Successfully saved query [name]', {name: savedQueryName}));
        browserHistory.push({
          pathname: `/organizations/${organization.slug}/discover/saved/${
            savedQuery.id
          }/`,
          query: {editing: true},
        });
      })
      .catch(err => {
        const message = (err && err.detail) || t('Could not save query');
        addErrorMessage(message);
      });
  }

  render() {
    const {
      queryBuilder,
      onRunQuery,
      onReset,
      isFetchingQuery,
      onUpdateField,
      isLoading,
    } = this.props;
    return (
      <QueryFieldsContainer>
        <QueryFields
          queryBuilder={queryBuilder}
          onUpdateField={onUpdateField}
          isLoading={isLoading}
          actions={
            <QueryActions>
              <QueryActionsGroup>
                <div>
                  <Button
                    size="xsmall"
                    onClick={onRunQuery}
                    priority="primary"
                    busy={isFetchingQuery}
                  >
                    {t('Run')}
                    {isFetchingQuery && <ButtonSpinner />}
                  </Button>
                </div>
                <div>
                  <Button size="xsmall" onClick={() => this.saveQuery()}>
                    {t('Save')}
                  </Button>
                </div>
              </QueryActionsGroup>
              <div>
                <Button size="xsmall" onClick={onReset}>
                  {t('Reset')}
                </Button>
              </div>
            </QueryActions>
          }
        />
      </QueryFieldsContainer>
    );
  }
}
