import {Fragment, useMemo} from 'react';
import styled from '@emotion/styled';

import {LinkButton} from '@sentry/scraps/button';

import {FeedbackButton} from 'sentry/components/feedbackButton/feedbackButton';
import * as Layout from 'sentry/components/layouts/thirds';
import type {ProfilingBreadcrumbsProps} from 'sentry/components/profiling/profilingBreadcrumbs';
import {ProfilingBreadcrumbs} from 'sentry/components/profiling/profilingBreadcrumbs';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {generateLinkToEventInTraceView} from 'sentry/utils/discover/urls';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';
import type {SpanResponse} from 'sentry/views/insights/types';
import {SpanFields} from 'sentry/views/insights/types';
import {TopBar} from 'sentry/views/navigation/topBar';
import {useHasPageFrameFeature} from 'sentry/views/navigation/useHasPageFrameFeature';

interface ContinuousProfileHeader {
  transactionSpan:
    | Pick<SpanResponse, 'trace' | 'span_id' | 'precise.finish_ts'>
    | undefined;
}

export function ContinuousProfileHeader({transactionSpan}: ContinuousProfileHeader) {
  const location = useLocation();
  const organization = useOrganization();
  const hasPageFrameFeature = useHasPageFrameFeature();

  // @TODO add breadcrumbs when other views are implemented
  const breadCrumbs = useMemo((): ProfilingBreadcrumbsProps['trails'] => {
    return [{type: 'landing', payload: {query: {}}}];
  }, []);

  const transactionTarget = transactionSpan
    ? generateLinkToEventInTraceView({
        timestamp: transactionSpan[SpanFields.PRECISE_FINISH_TS],
        targetId: transactionSpan[SpanFields.SPAN_ID],
        traceSlug: transactionSpan[SpanFields.TRACE],
        location,
        organization,
      })
    : null;

  const handleGoToTransaction = () => {
    trackAnalytics('profiling_views.go_to_transaction', {
      organization,
    });
  };

  const breadcrumbs = (
    <SmallerProfilingBreadcrumbsWrapper>
      <ProfilingBreadcrumbs organization={organization} trails={breadCrumbs} />
    </SmallerProfilingBreadcrumbsWrapper>
  );

  if (hasPageFrameFeature) {
    return (
      <Fragment>
        <TopBar.Slot name="title">{breadcrumbs}</TopBar.Slot>
        {transactionTarget && (
          <TopBar.Slot name="actions">
            <LinkButton onClick={handleGoToTransaction} to={transactionTarget}>
              {t('Go to Trace')}
            </LinkButton>
          </TopBar.Slot>
        )}
        <TopBar.Slot name="feedback">
          <FeedbackButton
            aria-label={t('Give Feedback')}
            tooltipProps={{title: t('Give Feedback')}}
          >
            {null}
          </FeedbackButton>
        </TopBar.Slot>
      </Fragment>
    );
  }

  return (
    <SmallerLayoutHeader>
      <SmallerHeaderContent>{breadcrumbs}</SmallerHeaderContent>
      <StyledHeaderActions>
        <FeedbackButton />
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
