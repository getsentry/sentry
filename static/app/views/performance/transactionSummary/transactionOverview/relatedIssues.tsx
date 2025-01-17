import {Component, Fragment} from 'react';
import styled from '@emotion/styled';
import type {Location} from 'history';
import pick from 'lodash/pick';

import {LinkButton} from 'sentry/components/button';
import {SectionHeading} from 'sentry/components/charts/styles';
import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import GroupList from 'sentry/components/issues/groupList';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import {DEFAULT_RELATIVE_PERIODS} from 'sentry/constants';
import {URL_PARAM} from 'sentry/constants/pageFilters';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import {trackAnalytics} from 'sentry/utils/analytics';
import {decodeScalar} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';

import {removeTracingKeysFromSearch} from '../../utils';

type Props = {
  location: Location;
  organization: Organization;
  transaction: string;
  end?: string;
  start?: string;
  statsPeriod?: string | null;
};

class RelatedIssues extends Component<Props> {
  getIssuesEndpointQueryParams() {
    const {transaction, start, end, statsPeriod, location} = this.props;

    const queryParams = {
      start,
      end,
      statsPeriod,
      limit: 5,
      sort: 'trends',
      ...pick(location.query, [...Object.values(URL_PARAM), 'cursor']),
    };
    const currentFilter = new MutableSearch(decodeScalar(location.query.query, ''));
    removeTracingKeysFromSearch(currentFilter);
    currentFilter
      .addFreeText('is:unresolved')
      .setFilterValues('transaction', [transaction]);

    return {
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

    // @ts-ignore TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
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
    const {queryParams} = this.getIssuesEndpointQueryParams();
    const issueSearch = {
      pathname: `/organizations/${organization.slug}/issues/`,
      query: {referrer: 'performance-related-issues', ...queryParams},
    };

    return (
      <Fragment>
        <ControlsWrapper>
          <SectionHeading>{t('Related Issues')}</SectionHeading>
          <LinkButton
            data-test-id="issues-open"
            size="xs"
            to={issueSearch}
            onClick={this.handleOpenClick}
          >
            {t('Open in Issues')}
          </LinkButton>
        </ControlsWrapper>

        <TableWrapper>
          <GroupList
            orgSlug={organization.slug}
            queryParams={queryParams}
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
