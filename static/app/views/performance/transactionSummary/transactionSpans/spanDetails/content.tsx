import {Fragment} from 'react';
import {Location} from 'history';

import Feature from 'sentry/components/acl/feature';
import * as Layout from 'sentry/components/layouts/thirds';
import {Organization, Project} from 'sentry/types';
import DiscoverQuery from 'sentry/utils/discover/discoverQuery';
import EventView from 'sentry/utils/discover/eventView';
import SpanExamplesQuery, {
  ChildrenProps as SpanExamplesProps,
} from 'sentry/utils/performance/suspectSpans/spanExamplesQuery';
import SuspectSpansQuery, {
  ChildrenProps as SuspectSpansProps,
} from 'sentry/utils/performance/suspectSpans/suspectSpansQuery';
import {SpanSlug} from 'sentry/utils/performance/suspectSpans/types';
import Breadcrumb from 'sentry/views/performance/breadcrumb';

import Tab from '../../tabs';
import {SpanSortOthers} from '../types';
import {getTotalsView} from '../utils';

import SpanChart from './chart';
import SpanDetailsHeader from './spanDetailsHeader';
import SpanDetailsSearchBar from './spanDetailsSearchBar';
import SpanTable from './spanDetailsTable';

type Props = {
  eventView: EventView;
  location: Location;
  organization: Organization;
  project: Project | undefined;
  spanSlug: SpanSlug;
  transactionName: string;
};

export default function SpanDetailsContentWrapper(props: Props) {
  const {location, organization, eventView, project, transactionName, spanSlug} = props;

  return (
    <Fragment>
      <Layout.Header>
        <Layout.HeaderContent>
          <Breadcrumb
            organization={organization}
            location={location}
            transaction={{
              project: project?.id ?? '',
              name: transactionName,
            }}
            tab={Tab.Spans}
            spanSlug={spanSlug}
          />
          <Layout.Title>{transactionName}</Layout.Title>
        </Layout.HeaderContent>
      </Layout.Header>
      <Layout.Body>
        <Layout.Main fullWidth>
          <DiscoverQuery
            eventView={getTotalsView(eventView)}
            orgSlug={organization.slug}
            location={location}
            referrer="api.performance.transaction-spans"
            cursor="0:0:1"
            noPagination
          >
            {({tableData}) => {
              const totalCount: number = tableData?.data?.[0]?.count ?? null;

              return (
                <SuspectSpansQuery
                  location={location}
                  orgSlug={organization.slug}
                  eventView={getSpansEventView(eventView)}
                  perSuspect={0}
                  spanOps={[spanSlug.op]}
                  spanGroups={[spanSlug.group]}
                  cursor="0:0:1"
                >
                  {suspectSpansResults => (
                    <SpanExamplesQuery
                      location={location}
                      orgSlug={organization.slug}
                      eventView={eventView}
                      spanOp={spanSlug.op}
                      spanGroup={spanSlug.group}
                      limit={10}
                    >
                      {spanExamplesResults => (
                        <SpanDetailsContent
                          location={location}
                          organization={organization}
                          project={project}
                          eventView={eventView}
                          spanSlug={spanSlug}
                          transactionName={transactionName}
                          totalCount={totalCount}
                          suspectSpansResults={suspectSpansResults}
                          spanExamplesResults={spanExamplesResults}
                        />
                      )}
                    </SpanExamplesQuery>
                  )}
                </SuspectSpansQuery>
              );
            }}
          </DiscoverQuery>
        </Layout.Main>
      </Layout.Body>
    </Fragment>
  );
}

type ContentProps = {
  eventView: EventView;
  location: Location;
  organization: Organization;
  project: Project | undefined;
  spanExamplesResults: SpanExamplesProps;
  spanSlug: SpanSlug;
  suspectSpansResults: SuspectSpansProps;
  totalCount: number;
  transactionName: string;
};

function SpanDetailsContent(props: ContentProps) {
  const {
    location,
    organization,
    project,
    eventView,
    spanSlug,
    transactionName,
    totalCount,
    suspectSpansResults,
    spanExamplesResults,
  } = props;

  // There should always be exactly 1 result
  const suspectSpan = suspectSpansResults.suspectSpans?.[0];
  const examples = spanExamplesResults.examples?.[0]?.examples;
  const transactionCountContainingSpan = suspectSpan?.frequency;

  return (
    <Fragment>
      <SpanDetailsHeader
        spanSlug={spanSlug}
        totalCount={totalCount}
        suspectSpan={suspectSpan}
      />
      <Feature features={['performance-span-histogram-view']}>
        <SpanDetailsSearchBar
          organization={organization}
          location={location}
          eventView={eventView}
        />
      </Feature>
      <SpanChart
        totalCount={transactionCountContainingSpan}
        organization={organization}
        eventView={eventView}
        spanSlug={spanSlug}
      />
      <SpanTable
        location={location}
        organization={organization}
        project={project}
        suspectSpan={suspectSpan}
        transactionName={transactionName}
        isLoading={spanExamplesResults.isLoading}
        examples={examples ?? []}
        pageLinks={spanExamplesResults.pageLinks}
      />
    </Fragment>
  );
}

function getSpansEventView(eventView: EventView): EventView {
  // TODO: There is a bug where if the sort is not avg occurrence,
  // then the avg occurrence will never be added to the fields
  eventView = eventView.withSorts([{field: SpanSortOthers.AVG_OCCURRENCE, kind: 'desc'}]);
  eventView.fields = [
    {field: 'count()'},
    {field: 'count_unique(id)'},
    {field: 'equation|count() / count_unique(id)'},
    {field: 'sumArray(spans_exclusive_time)'},
    {field: 'percentileArray(spans_exclusive_time, 0.75)'},
    {field: 'percentileArray(spans_exclusive_time, 0.95)'},
    {field: 'percentileArray(spans_exclusive_time, 0.99)'},
  ];
  return eventView;
}
