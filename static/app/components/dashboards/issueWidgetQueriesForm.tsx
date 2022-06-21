import {Component} from 'react';
import styled from '@emotion/styled';
import cloneDeep from 'lodash/cloneDeep';

import Field from 'sentry/components/forms/field';
import SelectControl from 'sentry/components/forms/selectControl';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Organization, PageFilters, SelectValue} from 'sentry/types';
import {
  explodeField,
  generateFieldAsString,
  getColumnsAndAggregates,
} from 'sentry/utils/discover/fields';
import {DisplayType, WidgetQuery, WidgetType} from 'sentry/views/dashboardsV2/types';
import {IssuesSearchBar} from 'sentry/views/dashboardsV2/widgetBuilder/buildSteps/filterResultsStep/issuesSearchBar';
import {generateIssueWidgetOrderOptions} from 'sentry/views/dashboardsV2/widgetBuilder/issueWidget/utils';
import {generateFieldOptions} from 'sentry/views/eventsV2/utils';
import {IssueSortOptions} from 'sentry/views/issueList/utils';

import WidgetQueryFields from './widgetQueryFields';

type Props = {
  fieldOptions: ReturnType<typeof generateFieldOptions>;
  onChange: (widgetQuery: WidgetQuery) => void;
  organization: Organization;
  query: WidgetQuery;
  selection: PageFilters;
  error?: Record<string, any>;
};

type State = {
  blurTimeout?: number | null;
};

/**
 * Contain widget queries interactions and signal changes via the onChange
 * callback. This component's state should live in the parent.
 */
class IssueWidgetQueriesForm extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      blurTimeout: undefined,
    };
  }

  componentWillUnmount() {
    if (this.state.blurTimeout) {
      window.clearTimeout(this.state.blurTimeout);
    }
  }

  // Handle scalar field values changing.
  handleFieldChange = (field: string) => {
    const {query, onChange} = this.props;
    const widgetQuery = query;

    return function handleChange(value: string) {
      const newQuery = {...widgetQuery, [field]: value};
      onChange(newQuery);
    };
  };

  render() {
    const {organization, error, query, selection, fieldOptions, onChange} = this.props;
    const explodedFields = (query.fields ?? [...query.columns, ...query.aggregates]).map(
      field => explodeField({field})
    );

    return (
      <QueryWrapper>
        <Field
          label={t('Query')}
          inline={false}
          style={{paddingBottom: `8px`}}
          flexibleControlStateSize
          stacked
          error={error?.conditions}
        >
          <SearchConditionsWrapper>
            <IssuesSearchBar
              widgetQuery={query}
              pageFilters={selection}
              organization={organization}
              onSearch={field => {
                // IssueListSearchBar will call handlers for both onSearch and onBlur
                // when selecting a value from the autocomplete dropdown. This can
                // cause state issues for the search bar in our use case. To prevent
                // this, we set a timer in our onSearch handler to block our onBlur
                // handler from firing if it is within 200ms, ie from clicking an
                // autocomplete value.
                if (this.state.blurTimeout) {
                  window.clearTimeout(this.state.blurTimeout);
                }
                this.setState({
                  blurTimeout: window.setTimeout(() => {
                    this.setState({blurTimeout: undefined});
                  }, 200),
                });
                return this.handleFieldChange('conditions')(field);
              }}
              onBlur={field => {
                if (!this.state.blurTimeout) {
                  this.handleFieldChange('conditions')(field);
                }
              }}
            />
          </SearchConditionsWrapper>
        </Field>
        <WidgetQueryFields
          widgetType={WidgetType.ISSUE}
          displayType={DisplayType.TABLE}
          fieldOptions={fieldOptions}
          errors={error}
          fields={explodedFields}
          organization={organization}
          onChange={fields => {
            const fieldStrings = fields.map(field => generateFieldAsString(field));
            const newQuery = cloneDeep(query);
            newQuery.fields = fieldStrings;
            const {columns, aggregates} = getColumnsAndAggregates(fieldStrings);
            newQuery.aggregates = aggregates;
            newQuery.columns = columns;

            onChange(newQuery);
          }}
        />
        <Field
          label={t('Sort by')}
          inline={false}
          flexibleControlStateSize
          stacked
          error={error?.orderby}
          style={{marginBottom: space(1)}}
        >
          <SelectControl
            value={query.orderby || IssueSortOptions.DATE}
            name="orderby"
            options={generateIssueWidgetOrderOptions(
              organization?.features?.includes('issue-list-trend-sort')
            )}
            onChange={(option: SelectValue<string>) =>
              this.handleFieldChange('orderby')(option.value)
            }
          />
        </Field>
      </QueryWrapper>
    );
  }
}

const QueryWrapper = styled('div')`
  position: relative;
  padding-bottom: 16px;
`;

export const SearchConditionsWrapper = styled('div')`
  display: flex;
  align-items: center;

  > * + * {
    margin-left: ${space(1)};
  }
`;

export default IssueWidgetQueriesForm;
