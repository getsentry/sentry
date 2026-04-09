import {useCallback, useMemo} from 'react';
import styled from '@emotion/styled';

import {LinkButton} from '@sentry/scraps/button';

import {FeedbackButton} from 'sentry/components/feedbackButton/feedbackButton';
import * as Layout from 'sentry/components/layouts/thirds';
import {ProfilingBreadcrumbs} from 'sentry/components/profiling/profilingBreadcrumbs';
import {t} from 'sentry/locale';
import type {Event} from 'sentry/types/event';
import {trackAnalytics} from 'sentry/utils/analytics';
import {generateLinkToEventInTraceView} from 'sentry/utils/discover/urls';
import {isSchema, isSentrySampledProfile} from 'sentry/utils/profiling/guards/profile';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';
import {TopBar} from 'sentry/views/navigation/topBar';
import {useHasPageFrameFeature} from 'sentry/views/navigation/useHasPageFrameFeature';
import {useProfiles} from 'sentry/views/profiling/profilesProvider';

function getTransactionName(input: Profiling.ProfileInput): string {
  if (isSchema(input)) {
    return input.metadata.transactionName;
  }
  if (isSentrySampledProfile(input)) {
    return input.transaction.name || t('Unknown Transaction');
  }

  return t('Unknown Transaction');
}

interface ProfileHeaderProps {
  eventId: string;
  projectId: string;
  transaction: Event | null;
}

function ProfileHeader({transaction, projectId, eventId}: ProfileHeaderProps) {
  const location = useLocation();
  const organization = useOrganization();
  const profiles = useProfiles();
  const hasPageFrameFeature = useHasPageFrameFeature();

  const transactionName =
    profiles.type === 'resolved' ? getTransactionName(profiles.data) : '';
  const profileId = eventId ?? '';
  const projectSlug = projectId ?? '';

  const transactionTarget = transaction?.id
    ? generateLinkToEventInTraceView({
        timestamp: transaction.endTimestamp ?? '',
        eventId: transaction.id,
        traceSlug: transaction.contexts?.trace?.trace_id ?? '',
        location,
        organization,
      })
    : null;

  const handleGoToTransaction = useCallback(() => {
    trackAnalytics('profiling_views.go_to_transaction', {
      organization,
    });
  }, [organization]);

  const breadcrumbTrails = useMemo(() => {
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
        },
      },
    ] as const;
  }, [location, projectSlug, transactionName, profileId]);

  return (
    <SmallerLayoutHeader>
      <SmallerHeaderContent>
        <SmallerProfilingBreadcrumbsWrapper>
          <ProfilingBreadcrumbs organization={organization} trails={breadcrumbTrails} />
        </SmallerProfilingBreadcrumbsWrapper>
      </SmallerHeaderContent>
      <StyledHeaderActions>
        {hasPageFrameFeature ? (
          <TopBar.Slot name="feedback">
            <FeedbackButton>{null}</FeedbackButton>
          </TopBar.Slot>
        ) : (
          <FeedbackButton />
        )}
        {transactionTarget && (
          <LinkButton size="sm" onClick={handleGoToTransaction} to={transactionTarget}>
            {t('Go to Trace')}
          </LinkButton>
        )}
      </StyledHeaderActions>
    </SmallerLayoutHeader>
  );
}

const StyledHeaderActions = styled(Layout.HeaderActions)`
  display: flex;
  flex-direction: row;
  gap: ${p => p.theme.space.md};
`;

const SmallerHeaderContent = styled(Layout.HeaderContent)`
  margin-bottom: ${p => p.theme.space.lg};
`;

const SmallerProfilingBreadcrumbsWrapper = styled('div')`
  nav {
    padding-bottom: ${p => p.theme.space.md};
  }
`;

const SmallerLayoutHeader = styled(Layout.Header)`
  padding: ${p => p.theme.space.md} ${p => p.theme.space.xl} 0 ${p => p.theme.space.xl} !important;
`;

export {ProfileHeader};
