import {useCallback, useMemo} from 'react';

import ButtonBar from 'sentry/components/buttonBar';
import DiscoverButton from 'sentry/components/discoverButton';
import FeedbackWidgetButton from 'sentry/components/feedback/widget/feedbackWidgetButton';
import * as Layout from 'sentry/components/layouts/thirds';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import {trackAnalytics} from 'sentry/utils/analytics';
import type EventView from 'sentry/utils/discover/eventView';
import {useLocation} from 'sentry/utils/useLocation';

import Breadcrumb from '../breadcrumb';

interface TraceMetadataHeaderProps {
  organization: Organization;
  projectID: string;
  title: string;
  traceEventView: EventView;
  traceSlug: string;
}

export function TraceMetadataHeader(props: TraceMetadataHeaderProps) {
  const location = useLocation();

  const breadcrumbTransaction = useMemo(() => {
    return {
      project: props.projectID ?? '',
      name: props.title ?? '',
    };
  }, [props.projectID, props.title]);

  const trackOpenInDiscover = useCallback(() => {
    trackAnalytics('performance_views.trace_view.open_in_discover', {
      organization: props.organization,
    });
  }, [props.organization]);

  return (
    <Layout.Header>
      <Layout.HeaderContent>
        <Breadcrumb
          organization={props.organization}
          location={location}
          transaction={breadcrumbTransaction}
          traceSlug={props.traceSlug}
        />
      </Layout.HeaderContent>
      <Layout.HeaderActions>
        <ButtonBar gap={1}>
          <DiscoverButton
            size="sm"
            to={props.traceEventView.getResultsViewUrlTarget(props.organization.slug)}
            onClick={trackOpenInDiscover}
          >
            {t('Open in Discover')}
          </DiscoverButton>

          <FeedbackWidgetButton />
        </ButtonBar>
      </Layout.HeaderActions>
    </Layout.Header>
  );
}
