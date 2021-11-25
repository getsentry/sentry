import * as React from 'react';
import styled from '@emotion/styled';

import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {GlobalSelection, Organization, TagCollection} from 'sentry/types';
import withIssueTags from 'sentry/utils/withIssueTags';
import {WidgetQuery} from 'sentry/views/dashboardsV2/types';
import IssueListSearchBar from 'sentry/views/issueList/searchBar';
import Field from 'sentry/views/settings/components/forms/field';

type Props = {
  organization: Organization;
  selection: GlobalSelection;
  query: WidgetQuery;
  error?: Record<string, any>;
  onChange: (widgetQuery: WidgetQuery) => void;
  tags: TagCollection;
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

  getFirstQueryError() {
    const {error} = this.props;

    if (!error) {
      return undefined;
    }

    return error;
  }

  render() {
    const {organization, error, query, tags} = this.props;

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
