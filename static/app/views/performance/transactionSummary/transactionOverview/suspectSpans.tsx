import {Fragment} from 'react';
import {browserHistory} from 'react-router';
import styled from '@emotion/styled';
import {Location} from 'history';

import Button from 'sentry/components/button';
import {SectionHeading} from 'sentry/components/charts/styles';
import FeatureBadge from 'sentry/components/featureBadge';
import GridEditable, {
  COL_WIDTH_UNDEFINED,
  GridColumnOrder,
  GridColumnSortBy,
} from 'sentry/components/gridEditable';
import SortLink from 'sentry/components/gridEditable/sortLink';
import Link from 'sentry/components/links/link';
import Pagination, {CursorHandler} from 'sentry/components/pagination';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Organization} from 'sentry/types';
import {defined} from 'sentry/utils';
import EventView from 'sentry/utils/discover/eventView';
import {getFieldRenderer} from 'sentry/utils/discover/fieldRenderers';
import {ColumnType, fieldAlignment} from 'sentry/utils/discover/fields';
import SuspectSpansQuery from 'sentry/utils/performance/suspectSpans/suspectSpansQuery';
import {decodeScalar} from 'sentry/utils/queryString';

import {SpanSortOthers, SpanSortPercentiles} from '../transactionSpans/types';
import {
  getSuspectSpanSortFromLocation,
  spansRouteWithQuery,
} from '../transactionSpans/utils';
import {generateTransactionLink} from '../utils';

type SuspectSpanTableColumnKeys =
  | 'op'
  | 'description'
  | 'p75ExclusiveTime'
  | 'count'
  | 'sumExclusiveTime'
  | 'id'
  | 'spans';

type SuspectSpanTableColumn = GridColumnOrder<SuspectSpanTableColumnKeys>;

type SuspectSpanTableDataRow = Record<SuspectSpanTableColumnKeys, any>;

const SUSPECT_SPANS_TABLE_COLUMN_ORDER: SuspectSpanTableColumn[] = [
  {
    key: 'op',
    name: t('Operation'),
    width: COL_WIDTH_UNDEFINED,
  },
  {
    key: 'description',
    name: t('Description'),
    width: COL_WIDTH_UNDEFINED,
  },
  {
    key: 'p75ExclusiveTime',
    name: t('P75 Exclusive Time'),
    width: COL_WIDTH_UNDEFINED,
  },
  {
    key: 'count',
    name: t('Total Count'),
    width: COL_WIDTH_UNDEFINED,
  },
  {
    key: 'sumExclusiveTime',
    name: t('Total Exclusive Time'),
    width: COL_WIDTH_UNDEFINED,
  },
  {
    key: 'id',
    name: t('Example Transaction'),
    width: COL_WIDTH_UNDEFINED,
  },
];

const SPANS_CURSOR_NAME = 'spansCursor';

type Props = {
  location: Location;
  organization: Organization;
  eventView: EventView;
  projectId: string;
  transactionName: string;
};

export default function SuspectSpans(props: Props) {
  const {location, organization, eventView, projectId, transactionName} = props;
  const sort = getSuspectSpanSortFromLocation(location, 'spanSort');
  const cursor = decodeScalar(location.query?.[SPANS_CURSOR_NAME]);

  const sortedEventView = eventView
    .withColumns(
      [...Object.values(SpanSortOthers), ...Object.values(SpanSortPercentiles)].map(
        field => ({kind: 'field', field})
      )
    )
    .withSorts([{kind: 'desc', field: sort.field}]);
  const sortColumn: GridColumnSortBy<SuspectSpanTableColumnKeys> = {
    key: sort.field as SuspectSpanTableColumnKeys,
    width: COL_WIDTH_UNDEFINED,
    order: 'desc',
  };

  return (
    <SuspectSpansQuery
      location={location}
      orgSlug={organization.slug}
      eventView={sortedEventView}
      perSuspect={1}
      cursor={cursor}
    >
      {({suspectSpans, isLoading, pageLinks}) => {
        const data = (suspectSpans ?? []).map(suspectSpan => {
          const example = suspectSpan.examples[0];
          return {
            project: suspectSpan.project,
            op: suspectSpan.op,
            description: example?.description ?? null,
            p75ExclusiveTime: suspectSpan.p75ExclusiveTime,
            count: suspectSpan.frequency,
            sumExclusiveTime: suspectSpan.sumExclusiveTime,
            id: example?.id ?? null,
            spans: example?.spans,
          };
        });

        return (
          <Fragment>
            <SuspectSpansHeader
              location={location}
              organization={organization}
              projectId={projectId}
              transactionName={transactionName}
              pageLinks={pageLinks}
            />
            <GridEditable
              isLoading={isLoading}
              data={data}
              columnOrder={SUSPECT_SPANS_TABLE_COLUMN_ORDER}
              columnSortBy={[sortColumn]}
              grid={{
                renderHeadCell: renderHeadCellWithMeta(location, sortColumn),
                renderBodyCell: renderBodyCellWithMeta({
                  location,
                  organization,
                  transactionName,
                }),
              }}
              location={location}
            />
          </Fragment>
        );
      }}
    </SuspectSpansQuery>
  );
}

const SUSPECT_SPANS_TABLE_COLUMN_TYPE: Omit<
  Record<SuspectSpanTableColumnKeys, ColumnType>,
  'spans'
> = {
  op: 'string',
  description: 'string',
  p75ExclusiveTime: 'duration',
  count: 'integer',
  sumExclusiveTime: 'duration',
  id: 'string',
};

function renderHeadCellWithMeta(
  location: Location,
  sortColumn: GridColumnSortBy<SuspectSpanTableColumnKeys>
) {
  return (column: SuspectSpanTableColumn, _index: number): React.ReactNode => {
    const columnType = SUSPECT_SPANS_TABLE_COLUMN_TYPE[column.key];
    const align = fieldAlignment(column.key, columnType);

    const canSort = columnType === 'integer' || columnType === 'duration';
    const direction =
      canSort && column.key === sortColumn.key ? sortColumn.order : undefined;

    function generateSortLink() {
      return {
        ...location,
        query: {
          ...location.query,
          spanSort: column.key,
          [SPANS_CURSOR_NAME]: undefined,
        },
      };
    }

    return (
      <SortLink
        title={column.name}
        align={align}
        direction={direction}
        canSort={canSort}
        generateSortLink={generateSortLink}
      />
    );
  };
}

function renderBodyCellWithMeta({
  location,
  organization,
  transactionName,
}: {
  location: Location;
  organization: Organization;
  transactionName: string;
}) {
  return (
    column: SuspectSpanTableColumn,
    dataRow: SuspectSpanTableDataRow
  ): React.ReactNode => {
    const fieldRenderer = getFieldRenderer(column.key, SUSPECT_SPANS_TABLE_COLUMN_TYPE);
    const rendered = fieldRenderer(dataRow, {location, organization});

    if (column.key === 'id') {
      if (defined(dataRow.id)) {
        const worstSpan = dataRow.spans?.length
          ? dataRow.spans.reduce((worst, span) =>
              worst.exclusiveTime >= span.exclusiveTime ? worst : span
            )
          : null;

        const target = generateTransactionLink(transactionName)(
          organization,
          dataRow,
          location.query,
          worstSpan.id
        );

        return <Link to={target}>{rendered}</Link>;
      }

      return emptyValue;
    }

    return rendered;
  };
}

type HeaderProps = {
  location: Location;
  organization: Organization;
  projectId: string;
  transactionName: string;
  pageLinks: string | null;
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
      <div>
        <SectionHeading>{t('Suspect Spans')}</SectionHeading>
        <FeatureBadge type="alpha" />
      </div>
      <Button to={viewAllTarget} size="small" data-test-id="suspect-spans-open-tab">
        {t('View All Spans')}
      </Button>
      <StyledPagination pageLinks={pageLinks} onCursor={handleCursor} size="small" />
    </Header>
  );
}

const Header = styled('div')`
  display: grid;
  grid-template-columns: 1fr auto auto;
  margin-bottom: ${space(1)};
`;

const StyledPagination = styled(Pagination)`
  margin: 0 0 0 ${space(1)};
`;

const EmptyValueContainer = styled('span')`
  color: ${p => p.theme.gray300};
`;
const emptyValue = <EmptyValueContainer>{t('n/a')}</EmptyValueContainer>;
