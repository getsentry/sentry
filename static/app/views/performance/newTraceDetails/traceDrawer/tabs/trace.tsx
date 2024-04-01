import {Fragment, useMemo} from 'react';
import styled from '@emotion/styled';

import {SectionHeading} from 'sentry/components/charts/styles';
import EventVitals from 'sentry/components/events/eventVitals';
import Panel from 'sentry/components/panels/panel';
import Placeholder from 'sentry/components/placeholder';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {EventTransaction, Organization} from 'sentry/types';
import {generateQueryWithTag} from 'sentry/utils';
import type EventView from 'sentry/utils/discover/eventView';
import {formatTagKey} from 'sentry/utils/discover/fields';
import type {
  TraceFullDetailed,
  TraceSplitResults,
} from 'sentry/utils/performance/quickTrace/types';
import {WEB_VITAL_DETAILS} from 'sentry/utils/performance/vitals/constants';
import type {UseApiQueryResult} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import {useLocation} from 'sentry/utils/useLocation';
import Tags from 'sentry/views/discover/tags';

import {isTraceNode} from '../../guards';
import type {TraceTree, TraceTreeNode} from '../../traceTree';
import {IssueList} from '../details/issues/issues';

const WEB_VITALS = [
  WEB_VITAL_DETAILS['measurements.cls'],
  WEB_VITAL_DETAILS['measurements.lcp'],
  WEB_VITAL_DETAILS['measurements.ttfb'],
  WEB_VITAL_DETAILS['measurements.fcp'],
  WEB_VITAL_DETAILS['measurements.fid'],
];

type TraceFooterProps = {
  node: TraceTreeNode<TraceTree.NodeValue> | null;
  organization: Organization;
  rootEventResults: UseApiQueryResult<EventTransaction, RequestError>;
  traceEventView: EventView;
  traces: TraceSplitResults<TraceFullDetailed> | null;
  tree: TraceTree;
};

function NoWebVitals() {
  return (
    <div style={{flex: 1}}>
      <SectionHeading>{t('WebVitals')}</SectionHeading>
      <WebVitalsWrapper>
        {WEB_VITALS.map(detail => (
          <StyledPanel key={detail.name}>
            <div>{detail.name}</div>
            <div>{' \u2014 '}</div>
          </StyledPanel>
        ))}
      </WebVitalsWrapper>
    </div>
  );
}

function TraceDataLoading() {
  return (
    <WebVitalsAndTags>
      <div style={{flex: 1}}>
        <SectionHeading>{t('WebVitals')}</SectionHeading>
        <Fragment>
          <StyledPlaceholderVital key="title-1" />
          <StyledPlaceholderVital key="title-2" />
          <StyledPlaceholderVital key="title-3" />
          <StyledPlaceholderVital key="title-4" />
          <StyledPlaceholderVital key="title-5" />
        </Fragment>
      </div>
      <div style={{flex: 1}}>
        <SectionHeading>{t('Tag Summary')}</SectionHeading>
        <Fragment>
          <StyledPlaceholderTagTitle key="title-1" />
          <StyledPlaceholderTag key="bar-1" />
          <StyledPlaceholderTagTitle key="title-2" />
          <StyledPlaceholderTag key="bar-2" />
          <StyledPlaceholderTagTitle key="title-3" />
          <StyledPlaceholderTag key="bar-3" />
        </Fragment>
      </div>
    </WebVitalsAndTags>
  );
}

export function TraceLevelDetails(props: TraceFooterProps) {
  const location = useLocation();
  const issues = useMemo(() => {
    if (!props.node) {
      return [];
    }

    return [...props.node.errors, ...props.node.performance_issues];
  }, [props.node]);

  if (!props.node) {
    return null;
  }

  if (!(props.node && isTraceNode(props.node))) {
    throw new Error('Expected a trace node');
  }

  if (!props.traces) {
    return <TraceDataLoading />;
  }

  const {data: rootEvent} = props.rootEventResults;
  const webVitals = Object.keys(rootEvent?.measurements ?? {})
    .filter(name => Boolean(WEB_VITAL_DETAILS[`measurements.${name}`]))
    .sort();

  return (
    <Wrapper>
      <IssueList issues={issues} node={props.node} organization={props.organization} />
      {rootEvent ? (
        <WebVitalsAndTags>
          {webVitals.length > 0 ? (
            <div style={{flex: 1}}>
              <EventVitals event={rootEvent} />
            </div>
          ) : (
            <NoWebVitals />
          )}
          <div style={{flex: 1}}>
            <Tags
              generateUrl={(key: string, value: string) => {
                const url = props.traceEventView.getResultsViewUrlTarget(
                  props.organization.slug,
                  false
                );
                url.query = generateQueryWithTag(url.query, {
                  key: formatTagKey(key),
                  value,
                });
                return url;
              }}
              totalValues={props.tree.eventsCount}
              eventView={props.traceEventView}
              organization={props.organization}
              location={location}
            />
          </div>
        </WebVitalsAndTags>
      ) : null}
    </Wrapper>
  );
}

const Wrapper = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(2)};
`;

const WebVitalsAndTags = styled('div')`
  display: flex;
  gap: ${space(2)};
`;

const StyledPlaceholderTag = styled(Placeholder)`
  border-radius: ${p => p.theme.borderRadius};
  height: 16px;
  margin-bottom: ${space(1.5)};
`;

const StyledPlaceholderTagTitle = styled(Placeholder)`
  width: 100px;
  height: 12px;
  margin-bottom: ${space(0.5)};
`;

const StyledPlaceholderVital = styled(StyledPlaceholderTagTitle)`
  width: 100%;
  height: 50px;
  margin-bottom: ${space(0.5)};
`;

const StyledPanel = styled(Panel)`
  padding: ${space(1)} ${space(1.5)};
  margin-bottom: ${space(1)};
  width: 100%;
`;

const WebVitalsWrapper = styled('div')`
  display: flex;
  align-items: center;
  flex-direction: column;
`;
