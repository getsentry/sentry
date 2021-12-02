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

type State = {
  blurTimeout?: ReturnType<typeof setTimeout>;
};

/**
 * Contain widget queries interactions and signal changes via the onChange
 * callback. This component's state should live in the parent.
 */
class IssueWidgetQueriesForm extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      blurTimeout: undefined,
    };
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

  getFirstQueryError() {
    const {error} = this.props;

    if (!error) {
      return undefined;
    }

    return error;
  }

  render() {
    const {organization, error, query, tags} = this.props;
    const {blurTimeout} = this.state;

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
              onSearch={field => {
                // IssueListSearchBar will call handlers for both onSearch and onBlur
                // when selecting a value from the autocomplete dropdown. This can
                // cause state issues for the search bar in our use case. To prevent
                // this, we set a timer in our onSearch handler to block our onBlur
                // handler from firing if it is within 200ms, ie from clicking an
                // autocomplete value.
                this.setState({
                  blurTimeout: setTimeout(() => {
                    this.setState({blurTimeout: undefined});
                  }, 200),
                });
                return this.handleFieldChange('conditions')(field);
              }}
              onBlur={field => {
                if (!blurTimeout) {
                  this.handleFieldChange('conditions')(field);
                }
              }}
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
