import {Fragment} from 'react';
import styled from '@emotion/styled';
import type {Location} from 'history';
import pick from 'lodash/pick';

import {Flex} from '@sentry/scraps/layout';

import {SectionHeading} from 'sentry/components/charts/styles';
import {LinkButton} from 'sentry/components/core/button/linkButton';
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
import {useTransactionSummaryEAP} from 'sentry/views/performance/otlp/useTransactionSummaryEAP';
import {removeTracingKeysFromSearch} from 'sentry/views/performance/utils';

type Props = {
  location: Location;
  organization: Organization;
  transaction: string;
  end?: string;
  start?: string;
  statsPeriod?: string | null;
};

function RelatedIssues({
  location,
  organization,
  transaction,
  start,
  end,
  statsPeriod,
}: Props) {
  const shouldUseOTelFriendlyUI = useTransactionSummaryEAP();

  const getIssuesEndpointQueryParams = () => {
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
  };

  const handleOpenClick = () => {
    trackAnalytics('performance_views.summary.open_issues', {
      organization: organization.id,
    });
  };

  const renderEmptyMessage = () => {
    // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expression of type 'string | null | undefined' can't be used to index type
    const selectedTimePeriod = statsPeriod && DEFAULT_RELATIVE_PERIODS[statsPeriod];
    const displayedPeriod = selectedTimePeriod
      ? selectedTimePeriod.toLowerCase()
      : t('given timeframe');

    return (
      <Panel>
        <PanelBody>
          <EmptyStateWarning>
            <p>
              {tct('No new issues for this [identifier] for the [timePeriod].', {
                identifier: shouldUseOTelFriendlyUI
                  ? 'service entry span'
                  : 'transaction',
                timePeriod: displayedPeriod,
              })}
            </p>
          </EmptyStateWarning>
        </PanelBody>
      </Panel>
    );
  };

  const {queryParams} = getIssuesEndpointQueryParams();
  const issueSearch = {
    pathname: `/organizations/${organization.slug}/issues/`,
    query: {referrer: 'performance-related-issues', ...queryParams},
  };

  return (
    <Fragment>
      <Flex justify="between" align="center" marginBottom="md">
        <SectionHeading>{t('Related Issues')}</SectionHeading>
        <LinkButton
          data-test-id="issues-open"
          size="xs"
          to={issueSearch}
          onClick={handleOpenClick}
        >
          {t('Open in Issues')}
        </LinkButton>
      </Flex>

      <TableWrapper>
        <GroupList
          queryParams={queryParams}
          canSelectGroups={false}
          renderEmptyMessage={() => renderEmptyMessage()}
          withChart={false}
          withPagination={false}
          source="performance-related-issues"
          numPlaceholderRows={queryParams.limit}
        />
      </TableWrapper>
    </Fragment>
  );
}

const TableWrapper = styled('div')`
  margin-bottom: ${space(4)};
  ${Panel} {
    /* smaller space between table and pagination */
    margin-bottom: -${space(1)};
  }
`;

export default RelatedIssues;
