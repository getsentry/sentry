import React from 'react';
import styled from '@emotion/styled';
import cloneDeep from 'lodash/cloneDeep';

import {fetchSavedQueries} from 'app/actionCreators/discoverSavedQueries';
import {Client} from 'app/api';
import Feature from 'app/components/acl/feature';
import Button from 'app/components/button';
import SelectControl from 'app/components/forms/selectControl';
import {IconDelete} from 'app/icons';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {GlobalSelection, Organization, SavedQuery, SelectValue} from 'app/types';
import {Widget, WidgetQuery} from 'app/views/dashboardsV2/types';
import SearchBar from 'app/views/events/searchBar';
import {generateFieldOptions} from 'app/views/eventsV2/utils';
import Input from 'app/views/settings/components/forms/controls/input';
import RadioGroup from 'app/views/settings/components/forms/controls/radioGroup';
import Field from 'app/views/settings/components/forms/field';

import WidgetQueryFields, {QueryFieldWrapper} from './widgetQueryFields';

type Props = {
  api: Client;
  widgetQuery: WidgetQuery;
  organization: Organization;
  selection: GlobalSelection;
  displayType: Widget['displayType'];
  fieldOptions: ReturnType<typeof generateFieldOptions>;
  onChange: (widgetQuery: WidgetQuery) => void;
  canRemove: boolean;
  onRemove: () => void;
  errors?: Record<string, any>;
};

type SavedQueryOption = SelectValue<string> & {query: SavedQuery};

type State = {
  selectedQuery: SavedQueryOption | null;
  source: string;
};

/**
 * Contain widget query interactions and signal changes via the onChange
 * callback. This component's state should live in the parent.
 */
class WidgetQueryForm extends React.Component<Props, State> {
  state: State = {
    selectedQuery: null,
    source: 'new',
  };

  // Handle scalar field values changing.
  handleFieldChange = (field: string) => {
    const {widgetQuery, onChange} = this.props;

    return function handleChange(value: string) {
      const newQuery = {...widgetQuery, [field]: value};
      onChange(newQuery);
    };
  };

  handleFieldsChange = (fields: string[]) => {
    const {widgetQuery, onChange} = this.props;
    const newQuery = cloneDeep(widgetQuery);
    newQuery.fields = fields;
    onChange(newQuery);
  };

  handleSavedQueryChange = (option: SavedQueryOption) => {
    const {onChange, displayType, widgetQuery} = this.props;

    const newQuery = cloneDeep(widgetQuery);
    newQuery.fields =
      displayType === 'table'
        ? [...option.query.fields]
        : [option.query.yAxis ?? 'count()'];
    newQuery.conditions = option.query.query ?? '';
    newQuery.name = option.query.name;
    onChange(newQuery);

    this.setState({selectedQuery: option});
  };

  handleLoadOptions = (inputValue: string) => {
    const {api, organization} = this.props;
    return new Promise((resolve, reject) => {
      fetchSavedQueries(api, organization.slug, inputValue)
        .then((queries: SavedQuery[]) => {
          const results = queries.map(query => ({
            label: query.name,
            value: query.id,
            query,
          }));
          resolve(results);
        })
        .catch(reject);
    });
  };

  handleSourceChange = (value: string) => {
    this.setState(prevState => {
      return {
        ...prevState,
        source: value,
        selectedQuery: value === 'new' ? null : prevState.selectedQuery,
      };
    });
  };

  render() {
    const {
      canRemove,
      displayType,
      errors,
      fieldOptions,
      organization,
      selection,
      widgetQuery,
    } = this.props;
    const {selectedQuery, source} = this.state;

    return (
      <QueryWrapper>
        <QueryFieldWrapper>
          <Field
            data-test-id="source"
            label="Source"
            inline={false}
            flexibleControlStateSize
            stacked
            required
          >
            <RadioGroup
              orientInline
              value={this.state.source}
              label=""
              onChange={this.handleSourceChange}
              choices={[
                ['new', t('New Query')],
                ['existing', t('Existing Discover Query')],
              ]}
            />
          </Field>
          {canRemove && (
            <Button
              data-test-id="remove-query"
              size="zero"
              borderless
              onClick={this.props.onRemove}
              icon={<IconDelete />}
              title={t('Remove this query')}
            />
          )}
        </QueryFieldWrapper>
        {source === 'new' && (
          <Field
            data-test-id="new-query"
            label={t('Query')}
            inline={false}
            flexibleControlStateSize
            stacked
            error={errors?.conditions}
            required
          >
            <SearchBar
              organization={organization}
              projectIds={selection.projects}
              query={widgetQuery.conditions}
              fields={[]}
              onSearch={this.handleFieldChange('conditions')}
              onBlur={this.handleFieldChange('conditions')}
              useFormWrapper={false}
            />
          </Field>
        )}
        {source === 'existing' && (
          <Feature organization={organization} features={['discover-query']}>
            {({hasFeature}) => (
              <Field
                data-test-id="discover-query"
                label={t('Query')}
                inline={false}
                flexibleControlStateSize
                stacked
                required
              >
                <SelectControl
                  async
                  defaultOptions
                  value={selectedQuery}
                  name="discoverQuery"
                  loadOptions={this.handleLoadOptions}
                  onChange={this.handleSavedQueryChange}
                  options={[]}
                  disabled={!hasFeature}
                  cache
                  onSelectResetsInput={false}
                  onCloseResetsInput={false}
                  onBlurResetsInput={false}
                />
              </Field>
            )}
          </Feature>
        )}
        {canRemove && (
          <Field
            data-test-id="Query Name"
            label="Y-Axis"
            inline={false}
            flexibleControlStateSize
            stacked
            error={errors?.name}
          >
            <Input
              type="text"
              name="name"
              required
              value={widgetQuery.name}
              onChange={event => this.handleFieldChange('name')(event.target.value)}
            />
          </Field>
        )}
        <WidgetQueryFields
          displayType={displayType}
          fieldOptions={fieldOptions}
          errors={errors}
          fields={widgetQuery.fields}
          onChange={this.handleFieldsChange}
        />
      </QueryWrapper>
    );
  }
}

const QueryWrapper = styled('div')`
  padding-bottom: ${space(2)};
`;

export default WidgetQueryForm;
