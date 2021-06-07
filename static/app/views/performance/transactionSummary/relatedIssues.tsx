import {Component, Fragment} from 'react';
import styled from '@emotion/styled';
import {Location} from 'history';
import pick from 'lodash/pick';

import Button from 'app/components/button';
import {SectionHeading} from 'app/components/charts/styles';
import EmptyStateWarning from 'app/components/emptyStateWarning';
import GroupList from 'app/components/issues/groupList';
import {Panel, PanelBody} from 'app/components/panels';
import {DEFAULT_RELATIVE_PERIODS} from 'app/constants';
import {URL_PARAM} from 'app/constants/globalSelectionHeader';
import {t, tct} from 'app/locale';
import space from 'app/styles/space';
import {OrganizationSummary} from 'app/types';
import {trackAnalyticsEvent} from 'app/utils/analytics';
import {TRACING_FIELDS} from 'app/utils/discover/fields';
import {decodeScalar} from 'app/utils/queryString';
import {stringifyQueryObject, tokenizeSearch} from 'app/utils/tokenizeSearch';

type Props = {
  organization: OrganizationSummary;
  location: Location;
  transaction: string;
  statsPeriod?: string;
  start?: string;
  end?: string;
};

class RelatedIssues extends Component<Props> {
  getIssuesEndpoint() {
    const {transaction, organization, start, end, statsPeriod, location} = this.props;

    const queryParams = {
      start,
      end,
      statsPeriod,
      limit: 5,
      sort: 'new',
      ...pick(location.query, [...Object.values(URL_PARAM), 'cursor']),
    };
    const currentFilter = tokenizeSearch(decodeScalar(location.query.query, ''));
    currentFilter.getTagKeys().forEach(tagKey => {
      // Remove aggregates and transaction event fields
      if (
        // aggregates
        tagKey.match(/\w+\(.*\)/) ||
        // transaction event fields
        TRACING_FIELDS.includes(tagKey) ||
        // event type can be "transaction" but we're searching for issues
        tagKey === 'event.type'
      ) {
        currentFilter.removeTag(tagKey);
      }
    });
    currentFilter.addQuery('is:unresolved').setTagValues('transaction', [transaction]);

    // Filter out key_transaction from being passed to issues as it will cause an error.
    currentFilter.removeTag('key_transaction');
    currentFilter.removeTag('team_key_transaction');

    return {
      path: `/organizations/${organization.slug}/issues/`,
      queryParams: {
        ...queryParams,
        query: stringifyQueryObject(currentFilter),
      },
    };
  }

  handleOpenClick = () => {
    const {organization} = this.props;
    trackAnalyticsEvent({
      eventKey: 'performance_views.summary.open_issues',
      eventName: 'Performance Views: Open issues from transaction summary',
      organization_id: parseInt(organization.id, 10),
    });
  };

  renderEmptyMessage = () => {
    const {statsPeriod} = this.props;

    const selectedTimePeriod = statsPeriod && DEFAULT_RELATIVE_PERIODS[statsPeriod];
    const displayedPeriod = selectedTimePeriod
      ? selectedTimePeriod.toLowerCase()
      : t('given timeframe');

    return (
      <Panel>
        <PanelBody>
          <EmptyStateWarning>
            <p>
              {tct('No new issues for this transaction for the [timePeriod].', {
                timePeriod: displayedPeriod,
              })}
            </p>
          </EmptyStateWarning>
        </PanelBody>
      </Panel>
    );
  };

  render() {
    const {organization} = this.props;
    const {path, queryParams} = this.getIssuesEndpoint();
    const issueSearch = {
      pathname: `/organizations/${organization.slug}/issues/`,
      query: queryParams,
    };

    return (
      <Fragment>
        <ControlsWrapper>
          <SectionHeading>{t('Related Issues')}</SectionHeading>
          <Button
            data-test-id="issues-open"
            size="small"
            to={issueSearch}
            onClick={this.handleOpenClick}
          >
            {t('Open in Issues')}
          </Button>
        </ControlsWrapper>

        <TableWrapper>
          <GroupList
            orgId={organization.slug}
            endpointPath={path}
            queryParams={queryParams}
            query=""
            canSelectGroups={false}
            renderEmptyMessage={this.renderEmptyMessage}
            withChart={false}
            withPagination={false}
          />
        </TableWrapper>
      </Fragment>
    );
  }
}

const ControlsWrapper = styled('div')`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: ${space(1)};
`;

const TableWrapper = styled('div')`
  margin-bottom: ${space(4)};
  ${Panel} {
    /* smaller space between table and pagination */
    margin-bottom: -${space(1)};
  }
`;

export default RelatedIssues;
