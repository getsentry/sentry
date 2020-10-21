import { Component } from 'react';
import isEqual from 'lodash/isEqual';

import Button from 'app/components/button';
import {t} from 'app/locale';
import {IconDelete} from 'app/icons';

import QueryFields from './queryFields';
import {parseSavedQuery} from '../utils';
import {
  ButtonSpinner,
  QueryActions,
  QueryActionsGroup,
  SavedQueryAction,
} from '../styles';
import {QueryBuilder} from '../queryBuilder';
import {SavedQuery} from '../types';

type EditSavedQueryProps = {
  queryBuilder: QueryBuilder;
  onRunQuery: () => void;
  savedQuery: SavedQuery;
  onUpdateField: (field: string, value: any) => void;
  onDeleteQuery: () => void;
  onSaveQuery: (name: string) => void;
  isFetchingQuery: boolean;
  isLoading: boolean;
};

type EditSavedQueryState = {
  savedQueryName: string;
};

export default class EditSavedQuery extends Component<
  EditSavedQueryProps,
  EditSavedQueryState
> {
  constructor(props: EditSavedQueryProps) {
    super(props);
    this.state = {
      savedQueryName: props.savedQuery.name,
    };
  }

  handleUpdateName(savedQueryName: string) {
    this.setState({savedQueryName});
  }

  hasChanges() {
    const {queryBuilder, savedQuery} = this.props;

    const hasChanged =
      !isEqual(parseSavedQuery(savedQuery), queryBuilder.getInternal()) ||
      this.state.savedQueryName !== savedQuery.name;
    return hasChanged;
  }

  render() {
    const {
      queryBuilder,
      savedQuery,
      isFetchingQuery,
      onUpdateField,
      onRunQuery,
      onDeleteQuery,
      onSaveQuery,
      isLoading,
    } = this.props;

    const {savedQueryName} = this.state;

    return (
      <QueryFields
        queryBuilder={queryBuilder}
        onUpdateField={onUpdateField}
        isLoading={isLoading}
        savedQuery={savedQuery}
        savedQueryName={this.state.savedQueryName}
        onUpdateName={name => this.handleUpdateName(name)}
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
                <Button
                  size="xsmall"
                  onClick={() => onSaveQuery(savedQueryName)}
                  disabled={!this.hasChanges()}
                >
                  {t('Save')}
                </Button>
              </div>
            </QueryActionsGroup>
            <div>
              <SavedQueryAction to="" data-test-id="delete" onClick={onDeleteQuery}>
                <IconDelete />
              </SavedQueryAction>
            </div>
          </QueryActions>
        }
      />
    );
  }
}
