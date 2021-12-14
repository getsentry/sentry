import * as React from 'react';
import styled from '@emotion/styled';
import cloneDeep from 'lodash/cloneDeep';

import {fetchTagValues} from 'sentry/actionCreators/tags';
import {Client} from 'sentry/api';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {GlobalSelection, Organization, TagCollection} from 'sentry/types';
import {getUtcDateString} from 'sentry/utils/dates';
import {explodeField, generateFieldAsString} from 'sentry/utils/discover/fields';
import withApi from 'sentry/utils/withApi';
import withIssueTags from 'sentry/utils/withIssueTags';
import {DisplayType, WidgetQuery, WidgetType} from 'sentry/views/dashboardsV2/types';
import {generateFieldOptions} from 'sentry/views/eventsV2/utils';
import IssueListSearchBar from 'sentry/views/issueList/searchBar';
import Field from 'sentry/views/settings/components/forms/field';

import WidgetQueryFields from './widgetQueryFields';

type Props = {
  api: Client;
  organization: Organization;
  selection: GlobalSelection;
  query: WidgetQuery;
  error?: Record<string, any>;
  onChange: (widgetQuery: WidgetQuery) => void;
  tags: TagCollection;
  fieldOptions: ReturnType<typeof generateFieldOptions>;
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

  tagValueLoader = (key: string, search: string) => {
    const {organization, selection, api} = this.props;
    const orgId = organization.slug;
    const projectIds = selection.projects.map(id => id.toString());
    const endpointParams = {
      start: getUtcDateString(selection.datetime.start),
      end: getUtcDateString(selection.datetime.end),
      statsPeriod: selection.datetime.period,
    };

    return fetchTagValues(api, orgId, key, search, projectIds, endpointParams);
  };

  render() {
    const {organization, error, query, tags, fieldOptions, onChange} = this.props;
    const explodedFields = query.fields.map(field => explodeField({field}));
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
              tagValueLoader={this.tagValueLoader}
              onSidebarToggle={() => undefined}
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

export default withApi(withIssueTags(IssueWidgetQueriesForm));
