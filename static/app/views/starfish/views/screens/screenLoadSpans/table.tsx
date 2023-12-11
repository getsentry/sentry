import {Fragment} from 'react';
import styled from '@emotion/styled';
import * as qs from 'query-string';

import {getInterval} from 'sentry/components/charts/utils';
import GridEditable, {
  COL_WIDTH_UNDEFINED,
  GridColumnHeader,
} from 'sentry/components/gridEditable';
import SortLink from 'sentry/components/gridEditable/sortLink';
import ExternalLink from 'sentry/components/links/externalLink';
import Link from 'sentry/components/links/link';
import Pagination from 'sentry/components/pagination';
import {Tooltip} from 'sentry/components/tooltip';
import {t, tct} from 'sentry/locale';
import {NewQuery} from 'sentry/types';
import {TableDataRow} from 'sentry/utils/discover/discoverQuery';
import EventView, {
  fromSorts,
  isFieldSortable,
  MetaType,
} from 'sentry/utils/discover/eventView';
import {getFieldRenderer} from 'sentry/utils/discover/fieldRenderers';
import {fieldAlignment, Sort} from 'sentry/utils/discover/fields';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {decodeScalar} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import {OverflowEllipsisTextContainer} from 'sentry/views/starfish/components/textAlign';
import {useTTFDConfigured} from 'sentry/views/starfish/queries/useHasTtfdConfigured';
import {SpanMetricsField} from 'sentry/views/starfish/types';
import {formatVersionAndCenterTruncate} from 'sentry/views/starfish/utils/centerTruncate';
import {STARFISH_CHART_INTERVAL_FIDELITY} from 'sentry/views/starfish/utils/constants';
import {appendReleaseFilters} from 'sentry/views/starfish/utils/releaseComparison';
import {QueryParameterNames} from 'sentry/views/starfish/views/queryParameters';
import {SpanOpSelector} from 'sentry/views/starfish/views/screens/screenLoadSpans/spanOpSelector';
import {useTableQuery} from 'sentry/views/starfish/views/screens/screensTable';

const {SPAN_SELF_TIME, SPAN_DESCRIPTION, SPAN_GROUP, SPAN_OP, PROJECT_ID} =
  SpanMetricsField;

type Props = {
  primaryRelease?: string;
  secondaryRelease?: string;
  transaction?: string;
};

export function ScreenLoadSpansTable({
  transaction,
  primaryRelease,
  secondaryRelease,
}: Props) {
  const location = useLocation();
  const {selection} = usePageFilters();
  const organization = useOrganization();

  const spanOp = decodeScalar(location.query[SpanMetricsField.SPAN_OP]) ?? '';
  const truncatedPrimary = formatVersionAndCenterTruncate(primaryRelease ?? '', 15);
  const truncatedSecondary = formatVersionAndCenterTruncate(secondaryRelease ?? '', 15);
  const {hasTTFD, isLoading: hasTTFDLoading} = useTTFDConfigured([
    `transaction:"${transaction}"`,
  ]);

  const searchQuery = new MutableSearch([
    'transaction.op:ui.load',
    `transaction:${transaction}`,
    'has:span.description',
    ...(spanOp
      ? [`${SpanMetricsField.SPAN_OP}:${spanOp}`]
      : [
          'span.op:[file.read,file.write,ui.load,http.client,db,db.sql.room,db.sql.query,db.sql.transaction]',
        ]),
  ]);
  const queryStringPrimary = appendReleaseFilters(
    searchQuery,
    primaryRelease,
    secondaryRelease
  );

  const sort = fromSorts(
    decodeScalar(location.query[QueryParameterNames.SPANS_SORT])
  )[0] ?? {
    kind: 'desc',
    field: 'time_spent_percentage()',
  };

  const newQuery: NewQuery = {
    name: '',
    fields: [
      PROJECT_ID,
      SPAN_OP,
      SPAN_GROUP,
      SPAN_DESCRIPTION,
      `avg_if(${SPAN_SELF_TIME},release,${primaryRelease})`,
      `avg_if(${SPAN_SELF_TIME},release,${secondaryRelease})`,
      'ttid_contribution_rate()',
      'ttfd_contribution_rate()',
      'count()',
      'time_spent_percentage()',
      `sum(${SPAN_SELF_TIME})`,
    ],
    query: queryStringPrimary,
    dataset: DiscoverDatasets.SPANS_METRICS,
    version: 2,
    projects: selection.projects,
    interval: getInterval(selection.datetime, STARFISH_CHART_INTERVAL_FIDELITY),
  };

  const eventView = EventView.fromNewQueryWithLocation(newQuery, location);
  eventView.sorts = [sort];

  const {data, isLoading, pageLinks} = useTableQuery({
    eventView,
    enabled: true,
    referrer: 'api.starfish.mobile-span-table',
  });

  const columnNameMap = {
    [SPAN_OP]: t('Operation'),
    [SPAN_DESCRIPTION]: t('Span Description'),
    'count()': t('Total Count'),
    affects: hasTTFD ? t('Affects') : t('Affects TTID'),
    'time_spent_percentage()': t('Total Time Spent'),
    [`avg_if(${SPAN_SELF_TIME},release,${primaryRelease})`]: t(
      'Duration (%s)',
      truncatedPrimary
    ),
    [`avg_if(${SPAN_SELF_TIME},release,${secondaryRelease})`]: t(
      'Duration (%s)',
      truncatedSecondary
    ),
  };

  function renderBodyCell(column, row): React.ReactNode {
    if (!data?.meta || !data?.meta.fields) {
      return row[column.key];
    }

    if (column.key === SPAN_DESCRIPTION) {
      const label = row[SpanMetricsField.SPAN_DESCRIPTION];

      const pathname = normalizeUrl(
        `/organizations/${organization.slug}/performance/mobile/screens/spans/`
      );
      const query = {
        ...location.query,
        transaction,
        spanGroup: row[SpanMetricsField.SPAN_GROUP],
        spanDescription: row[SpanMetricsField.SPAN_DESCRIPTION],
      };

      return (
        <Link to={`${pathname}?${qs.stringify(query)}`}>
          <OverflowEllipsisTextContainer>{label}</OverflowEllipsisTextContainer>
        </Link>
      );
    }

    if (column.key === 'affects' && hasTTFD) {
      const ttid_contribution_rate = row['ttid_contribution_rate()']
        ? parseFloat(row['ttid_contribution_rate()'])
        : 0;
      const ttfd_contribution_rate = row['ttfd_contribution_rate()']
        ? parseFloat(row['ttfd_contribution_rate()'])
        : 0;

      if (!isNaN(ttid_contribution_rate) && ttid_contribution_rate === 1) {
        const tooltipValue = tct(
          'This span always ends before TTID and TTFD and may affect initial and final display. [link: Learn more.]',
          {
            link: <ExternalLink href="https://docs.sentry.io" />,
          }
        );
        return (
          <Tooltip isHoverable title={tooltipValue} showUnderline>
            <Container>{t('TTID, TTFD')}</Container>
          </Tooltip>
        );
      }

      if (!isNaN(ttfd_contribution_rate) && ttfd_contribution_rate === 1) {
        const tooltipValue = tct(
          'This span always ends before TTFD and may affect final display. [link: Learn more.]',
          {
            link: <ExternalLink href="https://docs.sentry.io" />,
          }
        );
        return (
          <Tooltip isHoverable title={tooltipValue} showUnderline>
            <Container>{t('TTFD')}</Container>
          </Tooltip>
        );
      }

      return <Container>{'--'}</Container>;
    }

    if (column.key === 'affects') {
      const ttid_contribution_rate = row['ttid_contribution_rate()']
        ? parseFloat(row['ttid_contribution_rate()'])
        : 0;

      if (!isNaN(ttid_contribution_rate) && ttid_contribution_rate === 1) {
        const tooltipValue = tct(
          'This span always ends before TTID and may affect initial display. [link: Learn more.]',
          {
            link: <ExternalLink href="https://docs.sentry.io" />,
          }
        );
        return (
          <Tooltip isHoverable title={tooltipValue} showUnderline>
            <Container>{t('Yes')}</Container>
          </Tooltip>
        );
      }

      const tooltipValue = tct(
        'This span may not affect initial display. [link: Learn more.]',
        {
          link: <ExternalLink href="https://docs.sentry.io" />,
        }
      );

      return (
        <Tooltip isHoverable title={tooltipValue} showUnderline>
          <Container>{t('No')}</Container>
        </Tooltip>
      );
    }

    const renderer = getFieldRenderer(column.key, data?.meta.fields, false);
    const rendered = renderer(row, {
      location,
      organization,
      unit: data?.meta.units?.[column.key],
    });
    return rendered;
  }

  function renderHeadCell(
    column: GridColumnHeader,
    tableMeta?: MetaType
  ): React.ReactNode {
    const fieldType = tableMeta?.fields?.[column.key];

    let alignment = fieldAlignment(column.key as string, fieldType);
    if (column.key === 'affects') {
      alignment = 'right';
    }
    const field = {
      field: column.key as string,
      width: column.width,
    };

    function generateSortLink() {
      if (!tableMeta) {
        return undefined;
      }

      let newSortDirection: Sort['kind'] = 'desc';
      if (sort?.field === column.key) {
        if (sort.kind === 'desc') {
          newSortDirection = 'asc';
        }
      }

      const newSort = `${newSortDirection === 'desc' ? '-' : ''}${column.key}`;

      return {
        ...location,
        query: {...location.query, [QueryParameterNames.SPANS_SORT]: newSort},
      };
    }

    const canSort = isFieldSortable(field, tableMeta?.fields, true);

    const sortLink = (
      <SortLink
        align={alignment}
        title={column.name}
        direction={sort?.field === column.key ? sort.kind : undefined}
        canSort={canSort}
        generateSortLink={generateSortLink}
      />
    );
    return sortLink;
  }

  const columnSortBy = eventView.getSorts();

  return (
    <Fragment>
      <SpanOpSelector
        primaryRelease={primaryRelease}
        transaction={transaction}
        secondaryRelease={secondaryRelease}
      />
      <GridEditable
        isLoading={isLoading || hasTTFDLoading}
        data={data?.data as TableDataRow[]}
        columnOrder={[
          String(SPAN_OP),
          String(SPAN_DESCRIPTION),
          `avg_if(${SPAN_SELF_TIME},release,${primaryRelease})`,
          `avg_if(${SPAN_SELF_TIME},release,${secondaryRelease})`,
          'affects',
          'count()',
          'time_spent_percentage()',
        ].map(col => {
          return {key: col, name: columnNameMap[col] ?? col, width: COL_WIDTH_UNDEFINED};
        })}
        columnSortBy={columnSortBy}
        location={location}
        grid={{
          renderHeadCell: column => renderHeadCell(column, data?.meta),
          renderBodyCell,
        }}
      />
      <Pagination pageLinks={pageLinks} />
    </Fragment>
  );
}

const Container = styled('div')`
  ${p => p.theme.overflowEllipsis};
  text-align: right;
`;
