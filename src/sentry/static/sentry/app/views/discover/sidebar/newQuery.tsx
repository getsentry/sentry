import { Component } from 'react';
import {browserHistory} from 'react-router';

import {Organization} from 'app/types';
import Button from 'app/components/button';
import {t, tct} from 'app/locale';
import {addSuccessMessage, addErrorMessage} from 'app/actionCreators/indicator';

import QueryFields from './queryFields';
import {createSavedQuery, generateQueryName} from '../utils';
import {
  ButtonSpinner,
  QueryActions,
  QueryActionsGroup,
  QueryFieldsContainer,
} from '../styles';
import {SavedQuery} from '../types';
import {QueryBuilder} from '../queryBuilder';

type NewQueryProps = {
  organization: Organization;
  queryBuilder: QueryBuilder;
  onRunQuery: () => void;
  onReset: () => void;
  onUpdateField: (field: string, value: any) => void;
  isFetchingQuery: boolean;
  isLoading: boolean;
};

export default class NewQuery extends Component<NewQueryProps> {
  saveQuery() {
    const {organization, queryBuilder} = this.props;
    const savedQueryName = generateQueryName();
    const data = {...queryBuilder.getInternal(), name: savedQueryName};

    createSavedQuery(organization, data)
      .then((savedQuery: SavedQuery) => {
        addSuccessMessage(tct('Successfully saved query [name]', {name: savedQueryName}));
        browserHistory.push({
          pathname: `/organizations/${organization.slug}/discover/saved/${savedQuery.id}/`,
          query: {editing: true},
        });
      })
      .catch((err: any) => {
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
