import {useMemo} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import * as Layout from 'sentry/components/layouts/thirds';
import Link from 'sentry/components/links/link';
import {
  ProfilingBreadcrumbs,
  ProfilingBreadcrumbsProps,
} from 'sentry/components/profiling/profilingBreadcrumbs';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Event} from 'sentry/types';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import {getTransactionDetailsUrl} from 'sentry/utils/performance/urls';
import {
  generateProfileDetailsRouteWithQuery,
  generateProfileFlamechartRouteWithQuery,
} from 'sentry/utils/profiling/routes';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {useProfileGroup} from 'sentry/views/profiling/profileGroupProvider';

interface ProfileHeaderProps {
  eventId: string;
  projectId: string;
  transaction: Event | null;
}

function ProfileHeader({transaction, projectId, eventId}: ProfileHeaderProps) {
  const location = useLocation();
  const organization = useOrganization();
  const profileGroup = useProfileGroup();

  const transactionName = profileGroup.type === 'resolved' ? profileGroup.data.name : '';
  const profileId = eventId ?? '';
  const projectSlug = projectId ?? '';

  const transactionTarget = transaction?.id
    ? getTransactionDetailsUrl(organization.slug, `${projectSlug}:${transaction.id}`)
    : null;

  function handleGoToTransaction() {
    trackAdvancedAnalyticsEvent('profiling_views.go_to_transaction', {
      organization,
      source: 'transaction_details',
    });
  }

  const breadcrumbTrails: ProfilingBreadcrumbsProps['trails'] = useMemo(() => {
    return [
      {type: 'landing', payload: {query: location.query}},
      {
        type: 'profile summary',
        payload: {
          projectSlug,
          transaction: transactionName,
          query: location.query,
        },
      },
      {
        type: 'flamechart',
        payload: {
          transaction: transactionName,
          profileId,
          projectSlug,
          query: location.query,
          tab: location.pathname.endsWith('details/') ? 'details' : 'flamechart',
        },
      },
    ];
  }, [location, projectSlug, transactionName, profileId]);

  return (
    <SmallerLayoutHeader>
      <SmallerHeaderContent>
        <SmallerProfilingBreadcrumbsWrapper>
          <ProfilingBreadcrumbs organization={organization} trails={breadcrumbTrails} />
        </SmallerProfilingBreadcrumbsWrapper>
      </SmallerHeaderContent>
      <Layout.HeaderActions>
        {transactionTarget && (
          <Button size="sm" onClick={handleGoToTransaction} to={transactionTarget}>
            {t('Go to Transaction')}
          </Button>
        )}
      </Layout.HeaderActions>
      <SmallerProfilingHeaderNavTabs underlined>
        <li className={location.pathname.endsWith('flamechart/') ? 'active' : undefined}>
          <Link
            to={generateProfileFlamechartRouteWithQuery({
              orgSlug: organization.slug,
              projectSlug,
              profileId,
              query: location.query,
            })}
          >
            {t('Flamechart')}
          </Link>
        </li>
        <li className={location.pathname.endsWith('details/') ? 'active' : undefined}>
          <Link
            to={generateProfileDetailsRouteWithQuery({
              orgSlug: organization.slug,
              projectSlug,
              profileId,
              query: location.query,
            })}
          >
            {t('Details')}
          </Link>
        </li>
      </SmallerProfilingHeaderNavTabs>
    </SmallerLayoutHeader>
  );
}

const SmallerHeaderContent = styled(Layout.HeaderContent)`
  margin-bottom: ${space(1.5)};
`;

const SmallerProfilingBreadcrumbsWrapper = styled('div')`
  nav {
    padding-bottom: ${space(1)};
  }
`;

const SmallerProfilingHeaderNavTabs = styled(Layout.HeaderNavTabs)`
  a {
    padding-top: 0 !important;
  }
`;
const SmallerLayoutHeader = styled(Layout.Header)`
  padding: ${space(1)} ${space(2)} ${space(0)} ${space(2)} !important;
`;

export {ProfileHeader};
