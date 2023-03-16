import {Fragment} from 'react';
import {browserHistory} from 'react-router';
import styled from '@emotion/styled';
import {Location} from 'history';

import {Button} from 'sentry/components/button';
import {SectionHeading} from 'sentry/components/charts/styles';
import Pagination, {CursorHandler} from 'sentry/components/pagination';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Organization} from 'sentry/types';
import EventView from 'sentry/utils/discover/eventView';
import SuspectSpansQuery from 'sentry/utils/performance/suspectSpans/suspectSpansQuery';
import {decodeScalar} from 'sentry/utils/queryString';
import useProjects from 'sentry/utils/useProjects';

import SuspectSpansTable from '../transactionSpans/suspectSpansTable';
import {
  SpanSortOthers,
  SpanSortPercentiles,
  SpansTotalValues,
} from '../transactionSpans/types';
import {
  getSuspectSpanSortFromLocation,
  SPAN_SORT_TO_FIELDS,
  spansRouteWithQuery,
} from '../transactionSpans/utils';

const SPANS_CURSOR_NAME = 'spansCursor';

type Props = {
  eventView: EventView;
  location: Location;
  organization: Organization;
  projectId: string;
  totals: SpansTotalValues | null;
  transactionName: string;
};

export default function SuspectSpans(props: Props) {
  const {location, organization, eventView, totals, projectId, transactionName} = props;
  const sort = getSuspectSpanSortFromLocation(location, 'spanSort');
  const cursor = decodeScalar(location.query?.[SPANS_CURSOR_NAME]);

  const sortedEventView = eventView
    .withColumns(
      [...Object.values(SpanSortOthers), ...Object.values(SpanSortPercentiles)].map(
        field => ({kind: 'field', field})
      )
    )
    .withSorts([{kind: 'desc', field: sort.field}]);
  const fields = SPAN_SORT_TO_FIELDS[sort.field];
  sortedEventView.fields = fields ? fields.map(field => ({field})) : [];

  const {projects} = useProjects();

  return (
    <SuspectSpansQuery
      location={location}
      orgSlug={organization.slug}
      eventView={sortedEventView}
      limit={4}
      perSuspect={0}
      cursor={cursor}
    >
      {({suspectSpans, isLoading, pageLinks}) => (
        <Fragment>
          <SuspectSpansHeader
            location={location}
            organization={organization}
            projectId={projectId}
            transactionName={transactionName}
            pageLinks={pageLinks}
          />
          <SuspectSpansTable
            location={location}
            organization={organization}
            transactionName={transactionName}
            project={projects.find(p => p.id === projectId)}
            isLoading={isLoading}
            suspectSpans={suspectSpans ?? []}
            totals={totals}
            sort={SpanSortOthers.SUM_EXCLUSIVE_TIME}
          />
        </Fragment>
      )}
    </SuspectSpansQuery>
  );
}

type HeaderProps = {
  location: Location;
  organization: Organization;
  pageLinks: string | null;
  projectId: string;
  transactionName: string;
};

function SuspectSpansHeader(props: HeaderProps) {
  const {location, organization, projectId, transactionName, pageLinks} = props;

  const viewAllTarget = spansRouteWithQuery({
    orgSlug: organization.slug,
    transaction: transactionName,
    projectID: projectId,
    query: location.query,
  });

  const handleCursor: CursorHandler = (cursor, pathname, query) => {
    browserHistory.push({
      pathname,
      query: {...query, [SPANS_CURSOR_NAME]: cursor},
    });
  };

  return (
    <Header>
      <SectionHeading>{t('Suspect Spans')}</SectionHeading>
      <Button to={viewAllTarget} size="xs" data-test-id="suspect-spans-open-tab">
        {t('View All Spans')}
      </Button>
      <StyledPagination pageLinks={pageLinks} onCursor={handleCursor} size="xs" />
    </Header>
  );
}

const Header = styled('div')`
  display: grid;
  grid-template-columns: 1fr auto auto;
  margin-bottom: ${space(1)};
  align-items: center;
`;

const StyledPagination = styled(Pagination)`
  margin: 0 0 0 ${space(1)};
`;
