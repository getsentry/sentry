import {Component, Fragment} from 'react';
import styled from '@emotion/styled';
import {Location} from 'history';
import pick from 'lodash/pick';

import {Button} from 'sentry/components/button';
import {SectionHeading} from 'sentry/components/charts/styles';
import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import GroupList from 'sentry/components/issues/groupList';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import {DEFAULT_RELATIVE_PERIODS} from 'sentry/constants';
import {URL_PARAM} from 'sentry/constants/pageFilters';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {OrganizationSummary} from 'sentry/types';
import {trackAnalytics} from 'sentry/utils/analytics';
import {decodeScalar} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';

import {removeTracingKeysFromSearch} from '../../utils';

type Props = {
  location: Location;
  organization: OrganizationSummary;
  transaction: string;
  end?: string;
  start?: string;
  statsPeriod?: string | null;
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
    const currentFilter = new MutableSearch(decodeScalar(location.query.query, ''));
    removeTracingKeysFromSearch(currentFilter);
    currentFilter
      .addFreeText('is:unresolved')
      .setFilterValues('transaction', [transaction]);

    return {
      path: `/organizations/${organization.slug}/issues/`,
      queryParams: {
        ...queryParams,
        query: currentFilter.formatString(),
      },
    };
  }

  handleOpenClick = () => {
    const {organization} = this.props;
    trackAnalytics('performance_views.summary.open_issues', {
      organization: organization.id,
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
      query: {referrer: 'performance-related-issues', ...queryParams},
    };

    return (
      <Fragment>
        <ControlsWrapper>
          <SectionHeading>{t('Related Issues')}</SectionHeading>
          <Button
            data-test-id="issues-open"
            size="xs"
            to={issueSearch}
            onClick={this.handleOpenClick}
          >
            {t('Open in Issues')}
          </Button>
        </ControlsWrapper>

        <TableWrapper>
          <GroupList
            orgSlug={organization.slug}
            endpointPath={path}
            queryParams={queryParams}
            query=""
            canSelectGroups={false}
            renderEmptyMessage={this.renderEmptyMessage}
            withChart={false}
            withPagination={false}
            source="performance-related-issues"
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
