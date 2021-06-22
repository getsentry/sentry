import {ComponentProps, ReactNode} from 'react';
import {Location} from 'history';

import Feature from 'app/components/acl/feature';
import FeatureDisabled from 'app/components/acl/featureDisabled';
import ErrorBoundary from 'app/components/errorBoundary';
import Hovercard from 'app/components/hovercard';
import ExternalLink from 'app/components/links/externalLink';
import Link from 'app/components/links/link';
import Placeholder from 'app/components/placeholder';
import QuickTrace from 'app/components/quickTrace';
import {generateTraceTarget} from 'app/components/quickTrace/utils';
import {t, tct, tn} from 'app/locale';
import {AvatarProject, OrganizationSummary} from 'app/types';
import {Event} from 'app/types/event';
import {trackAnalyticsEvent} from 'app/utils/analytics';
import {getConfigureTracingDocsLink} from 'app/utils/docs';
import {getShortEventId} from 'app/utils/events';
import {
  QuickTraceQueryChildrenProps,
  TraceMeta,
} from 'app/utils/performance/quickTrace/types';

import {MetaData} from './styles';

type Props = Pick<ComponentProps<typeof QuickTrace>, 'errorDest' | 'transactionDest'> & {
  event: Event;
  location: Location;
  organization: OrganizationSummary;
  quickTrace: QuickTraceQueryChildrenProps | null;
  traceMeta: TraceMeta | null;
  anchor: 'left' | 'right';
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
  organization,
  quickTrace,
  traceMeta,
  anchor,
  errorDest,
  transactionDest,
  project,
}: Props) {
  const features = ['performance-view'];

  const noFeatureMessage = t('Requires performance monitoring.');

  const docsLink = getConfigureTracingDocsLink(project);

  const traceId = event.contexts?.trace?.trace_id ?? null;
  const traceTarget = generateTraceTarget(event, organization);

  let body: ReactNode;
  let footer: ReactNode;

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

export function QuickTraceMetaBase({body, footer}: {body: ReactNode; footer: ReactNode}) {
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
