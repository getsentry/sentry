import {Location} from 'history';

import Feature from 'sentry/components/acl/feature';
import FeatureDisabled from 'sentry/components/acl/featureDisabled';
import ErrorBoundary from 'sentry/components/errorBoundary';
import {Hovercard} from 'sentry/components/hovercard';
import ExternalLink from 'sentry/components/links/externalLink';
import Link from 'sentry/components/links/link';
import Placeholder from 'sentry/components/placeholder';
import QuickTrace from 'sentry/components/quickTrace';
import {generateTraceTarget} from 'sentry/components/quickTrace/utils';
import {t, tct, tn} from 'sentry/locale';
import {AvatarProject, OrganizationSummary} from 'sentry/types';
import {Event} from 'sentry/types/event';
import {trackAnalyticsEvent} from 'sentry/utils/analytics';
import {getConfigureTracingDocsLink} from 'sentry/utils/docs';
import {getShortEventId} from 'sentry/utils/events';
import {
  QuickTraceQueryChildrenProps,
  TraceMeta,
} from 'sentry/utils/performance/quickTrace/types';
import useOrganization from 'sentry/utils/useOrganization';

import {MetaData} from './styles';

type Props = Pick<
  React.ComponentProps<typeof QuickTrace>,
  'errorDest' | 'transactionDest'
> & {
  anchor: 'left' | 'right';
  event: Event;
  location: Location;
  quickTrace: QuickTraceQueryChildrenProps | null;
  traceMeta: TraceMeta | null;
  project?: AvatarProject;
};

function handleTraceLink(organization: OrganizationSummary) {
  trackAnalyticsEvent({
    eventKey: 'quick_trace.trace_id.clicked',
    eventName: 'Quick Trace: Trace ID clicked',
    organization_id: parseInt(organization.id, 10),
    source: 'events',
  });
}

export default function QuickTraceMeta({
  event,
  location,
  quickTrace,
  traceMeta,
  anchor,
  errorDest,
  transactionDest,
  project,
}: Props) {
  const organization = useOrganization();
  const features = ['performance-view'];

  const noFeatureMessage = t('Requires performance monitoring.');

  const docsLink = getConfigureTracingDocsLink(project);

  const traceId = event.contexts?.trace?.trace_id ?? null;
  const traceTarget = generateTraceTarget(event, organization);

  let body: React.ReactNode;
  let footer: React.ReactNode;

  if (!traceId || !quickTrace || quickTrace.trace === null) {
    // this platform doesn't support performance don't show anything here
    if (docsLink === null) {
      return null;
    }

    body = t('Missing Trace');

    // need to configure tracing
    footer = <ExternalLink href={docsLink}>{t('Read the docs')}</ExternalLink>;
  } else {
    if (quickTrace.isLoading) {
      body = <Placeholder height="24px" />;
    } else if (quickTrace.error) {
      body = '\u2014';
    } else {
      body = (
        <ErrorBoundary mini>
          <QuickTrace
            event={event}
            quickTrace={{
              type: quickTrace.type,
              trace: quickTrace.trace,
            }}
            location={location}
            organization={organization}
            anchor={anchor}
            errorDest={errorDest}
            transactionDest={transactionDest}
          />
        </ErrorBoundary>
      );
    }

    footer = (
      <Link to={traceTarget} onClick={() => handleTraceLink(organization)}>
        {tct('View Full Trace: [id][events]', {
          id: getShortEventId(traceId ?? ''),
          events: traceMeta
            ? tn(' (%s event)', ' (%s events)', traceMeta.transactions + traceMeta.errors)
            : '',
        })}
      </Link>
    );
  }

  return (
    <Feature hookName="feature-disabled:performance-quick-trace" features={features}>
      {({hasFeature}) => {
        // also need to enable the performance feature
        if (!hasFeature) {
          footer = (
            <Hovercard
              body={
                <FeatureDisabled
                  features={features}
                  hideHelpToggle
                  message={noFeatureMessage}
                  featureName={noFeatureMessage}
                />
              }
            >
              {footer}
            </Hovercard>
          );
        }

        return <QuickTraceMetaBase body={body} footer={footer} />;
      }}
    </Feature>
  );
}

export function QuickTraceMetaBase({
  body,
  footer,
}: {
  body: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <MetaData
      headingText={t('Trace Navigator')}
      tooltipText={t(
        'An abbreviated version of the full trace. Related frontend and backend services can be added to provide further visibility.'
      )}
      bodyText={<div data-test-id="quick-trace-body">{body}</div>}
      subtext={<div data-test-id="quick-trace-footer">{footer}</div>}
    />
  );
}
