import * as React from 'react';
import styled from '@emotion/styled';
import cloneDeep from 'lodash/cloneDeep';

import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {GlobalSelection, Organization, TagCollection} from 'sentry/types';
import {explodeField, generateFieldAsString} from 'sentry/utils/discover/fields';
import withIssueTags from 'sentry/utils/withIssueTags';
import {DisplayType, WidgetQuery, WidgetType} from 'sentry/views/dashboardsV2/types';
import {generateFieldOptions} from 'sentry/views/eventsV2/utils';
import IssueListSearchBar from 'sentry/views/issueList/searchBar';
import Field from 'sentry/views/settings/components/forms/field';

import WidgetQueryFields from './widgetQueryFields';

type Props = {
  organization: Organization;
  selection: GlobalSelection;
  query: WidgetQuery;
  error?: Record<string, any>;
  onChange: (widgetQuery: WidgetQuery) => void;
  tags: TagCollection;
  fieldOptions: ReturnType<typeof generateFieldOptions>;
};

/**
 * Contain widget queries interactions and signal changes via the onChange
 * callback. This component's state should live in the parent.
 */
class IssueWidgetQueriesForm extends React.Component<Props> {
  // Handle scalar field values changing.
  handleFieldChange = (field: string) => {
    const {query, onChange} = this.props;
    const widgetQuery = query;

    return function handleChange(value: string) {
      const newQuery = {...widgetQuery, [field]: value};
      onChange(newQuery);
    };
  };

  getFirstQueryError(key: string) {
    const {error} = this.props;
    return error?.[key];
  }

  render() {
    const {organization, error, query, tags, fieldOptions, onChange} = this.props;
    const explodedFields = query.fields.map(field => explodeField({field}));

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
            <StyledIssueListSearchBar
              organization={organization}
              query={query.conditions || ''}
              sort=""
              onSearch={this.handleFieldChange('conditions')}
              onBlur={this.handleFieldChange('conditions')}
              excludeEnvironment
              supportedTags={tags}
              tagValueLoader={() => new Promise(() => [])}
              savedSearch={undefined}
              onSidebarToggle={() => undefined}
            />
          </SearchConditionsWrapper>
        </Field>
        <WidgetQueryFields
          widgetType={WidgetType.ISSUE}
          displayType={DisplayType.TABLE}
          fieldOptions={fieldOptions}
          errors={error?.fields}
          fields={explodedFields}
          organization={organization}
          onChange={fields => {
            const fieldStrings = fields.map(field => generateFieldAsString(field));
            const newQuery = cloneDeep(query);
            newQuery.fields = fieldStrings;
            onChange(newQuery);
          }}
        />
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

const StyledIssueListSearchBar = styled(IssueListSearchBar)`
  flex-grow: 1;
  button:not([aria-label='Clear search']) {
    display: none;
  }
`;

export default withIssueTags(IssueWidgetQueriesForm);
