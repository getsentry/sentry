import * as React from 'react';

import {addLoadingMessage, clearIndicators} from 'app/actionCreators/indicator';
import {ModalRenderProps} from 'app/actionCreators/modal';
import {createSavedSearch} from 'app/actionCreators/savedSearches';
import {Client} from 'app/api';
import Button from 'app/components/button';
import {SelectField, TextField} from 'app/components/forms';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {LightWeightOrganization} from 'app/types';
import withApi from 'app/utils/withApi';

import {getSortLabel, IssueSortOptions} from './utils';

type Props = ModalRenderProps & {
  api: Client;
  query: string;
  sort?: string;
  organization: LightWeightOrganization;
};

type State = {
  isSaving: boolean;
  name: string;
  error: string | null;
  query: string | null;
  sort: string | null;
};

type FieldOnChangeParameters = Parameters<NonNullable<TextField['props']['onChange']>>[0];

const DEFAULT_SORT_OPTIONS = [
  IssueSortOptions.DATE,
  IssueSortOptions.NEW,
  IssueSortOptions.FREQ,
  IssueSortOptions.PRIORITY,
  IssueSortOptions.USER,
];

class CreateSavedSearchModal extends React.Component<Props, State> {
  state: State = {
    isSaving: false,
    name: '',
    error: null,
    query: null,
    sort: null,
  };

  /** Handle "date added" sort not being available for saved searches */
  validateSortOption(sort?: string | null): string {
    if (this.sortOptions().find(option => option === sort)) {
      return sort as string;
    }

    return IssueSortOptions.DATE;
  }

  onSubmit = (e: React.FormEvent) => {
    const {api, organization} = this.props;
    const query = this.state.query || this.props.query;
    const sort = this.validateSortOption(this.state.sort || this.props.sort);

    e.preventDefault();

    this.setState({isSaving: true});

    addLoadingMessage(t('Saving Changes'));

    createSavedSearch(api, organization.slug, this.state.name, query, sort)
      .then(_data => {
        this.props.closeModal();
        this.setState({
          error: null,
          isSaving: false,
        });
        clearIndicators();
      })
      .catch(err => {
        let error = t('Unable to save your changes.');
        if (err.responseJSON && err.responseJSON.detail) {
          error = err.responseJSON.detail;
        }
        this.setState({
          error,
          isSaving: false,
        });
        clearIndicators();
      });
  };

  sortOptions() {
    const {organization} = this.props;
    const options = [...DEFAULT_SORT_OPTIONS];
    if (organization?.features?.includes('issue-list-trend-sort')) {
      options.push(IssueSortOptions.TREND);
    }

    return options;
  }

  handleChangeName = (val: FieldOnChangeParameters) => {
    this.setState({name: String(val)});
  };

  handleChangeQuery = (val: FieldOnChangeParameters) => {
    this.setState({query: String(val)});
  };

  handleChangeSort = (val: string | number | boolean) => {
    this.setState({sort: val as string});
  };

  render() {
    const {isSaving, error} = this.state;
    const {Header, Footer, Body, closeModal, query, sort} = this.props;

    const sortOptions = this.sortOptions().map(sortOption => ({
      value: sortOption,
      label: getSortLabel(sortOption),
    }));

    return (
      <form onSubmit={this.onSubmit}>
        <Header>
          <h4>{t('Save Current Search')}</h4>
        </Header>

        <Body>
          {this.state.error && (
            <div className="alert alert-error alert-block">{error}</div>
          )}

          <p>{t('All team members will now have access to this search.')}</p>
          <TextField
            key="name"
            name="name"
            label={t('Name')}
            placeholder="e.g. My Search Results"
            required
            onChange={this.handleChangeName}
          />
          <TextField
            key="query"
            name="query"
            label={t('Query')}
            value={query}
            required
            onChange={this.handleChangeQuery}
          />
          <SelectField
            key="sort"
            name="sort"
            label={t('Sort By')}
            required
            clearable={false}
            defaultValue={this.validateSortOption(sort)}
            options={sortOptions}
            onChange={this.handleChangeSort}
          />
        </Body>
        <Footer>
          <Button
            priority="default"
            size="small"
            disabled={isSaving}
            onClick={closeModal}
            style={{marginRight: space(1)}}
          >
            {t('Cancel')}
          </Button>
          <Button priority="primary" size="small" disabled={isSaving}>
            {t('Save')}
          </Button>
        </Footer>
      </form>
    );
  }
}

export default withApi(CreateSavedSearchModal);
