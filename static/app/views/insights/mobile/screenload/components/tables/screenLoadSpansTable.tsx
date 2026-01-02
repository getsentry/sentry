import {Fragment, useMemo} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import * as qs from 'query-string';

import {ExternalLink, Link} from 'sentry/components/core/link';
import {Tooltip} from 'sentry/components/core/tooltip';
import type {CursorHandler} from 'sentry/components/pagination';
import Pagination from 'sentry/components/pagination';
import type {GridColumnHeader} from 'sentry/components/tables/gridEditable';
import GridEditable, {COL_WIDTH_UNDEFINED} from 'sentry/components/tables/gridEditable';
import SortLink from 'sentry/components/tables/gridEditable/sortLink';
import useQueryBasedColumnResize from 'sentry/components/tables/gridEditable/useQueryBasedColumnResize';
import {t, tct} from 'sentry/locale';
import type {MetaType} from 'sentry/utils/discover/eventView';
import {isFieldSortable} from 'sentry/utils/discover/eventView';
import {getFieldRenderer} from 'sentry/utils/discover/fieldRenderers';
import type {Sort} from 'sentry/utils/discover/fields';
import {fieldAlignment} from 'sentry/utils/discover/fields';
import {decodeScalar, decodeSorts} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import {OverflowEllipsisTextContainer} from 'sentry/views/insights/common/components/textAlign';
import {useSpans} from 'sentry/views/insights/common/queries/useDiscover';
import {useTTFDConfigured} from 'sentry/views/insights/common/queries/useHasTtfdConfigured';
import {appendReleaseFilters} from 'sentry/views/insights/common/utils/releaseComparison';
import {useModuleURL} from 'sentry/views/insights/common/utils/useModuleURL';
import {QueryParameterNames} from 'sentry/views/insights/common/views/queryParameters';
import useCrossPlatformProject from 'sentry/views/insights/mobile/common/queries/useCrossPlatformProject';
import {TTID_CONTRIBUTING_SPAN_OPS} from 'sentry/views/insights/mobile/screenload/components/spanOpSelector';
import {MobileCursors} from 'sentry/views/insights/mobile/screenload/constants';
import {useAffectsSelection} from 'sentry/views/insights/mobile/screenload/data/useAffectsSelection';
import {MODULE_DOC_LINK} from 'sentry/views/insights/mobile/screenload/settings';
import {ModuleName, SpanFields} from 'sentry/views/insights/types';
import type {SpanProperty} from 'sentry/views/insights/types';

const {SPAN_SELF_TIME, SPAN_DESCRIPTION, SPAN_GROUP, SPAN_OP, PROJECT_ID} = SpanFields;
const COLUMN_RESIZE_PARAM_NAME = 'events';

type Props = {
  primaryRelease?: string;
  transaction?: string;
};

export function ScreenLoadSpansTable({transaction, primaryRelease}: Props) {
  const organization = useOrganization();
  const moduleURL = useModuleURL(ModuleName.MOBILE_VITALS);
  const baseURL = `${moduleURL}/details/`;

  const theme = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const cursor = decodeScalar(location.query?.[MobileCursors.SPANS_TABLE]);
  const {isProjectCrossPlatform, selectedPlatform} = useCrossPlatformProject();
  const {value: affects} = useAffectsSelection();

  const spanOp = decodeScalar(location.query[SpanFields.SPAN_OP]) ?? '';
  const {hasTTFD, isPending: hasTTFDLoading} = useTTFDConfigured([
    `transaction:"${transaction}"`,
  ]);

  const queryStringPrimary = useMemo(() => {
    const searchQuery = new MutableSearch([
      'transaction.op:[ui.load,navigation]',
      `transaction:${transaction}`,
      'has:span.description',
      ...(spanOp
        ? [`${SpanFields.SPAN_OP}:${spanOp}`]
        : [`span.op:[${TTID_CONTRIBUTING_SPAN_OPS.join(',')}]`]),
    ]);

    if (isProjectCrossPlatform) {
      searchQuery.addFilterValue('os.name', selectedPlatform);
    }

    if (affects === 'NONE') {
      searchQuery.addFilterValue(`!${SpanFields.TTFD}`, 'ttfd');
      searchQuery.addFilterValue(`!${SpanFields.TTID}`, 'ttid');
    } else if (affects === 'TTFD') {
      searchQuery.addFilterValue(SpanFields.TTFD, 'ttfd');
    } else if (affects === 'TTID') {
      searchQuery.addFilterValue(SpanFields.TTID, 'ttid');
    }

    return appendReleaseFilters(searchQuery, primaryRelease);
  }, [
    isProjectCrossPlatform,
    primaryRelease,
    selectedPlatform,
    spanOp,
    transaction,
    affects,
  ]);

  const sort = decodeSorts(location.query[QueryParameterNames.SPANS_SORT])[0] ?? {
    kind: 'desc',
    field: 'sum(span.self_time)',
  };

  const fields: SpanProperty[] = [
    PROJECT_ID,
    SPAN_OP,
    SPAN_GROUP,
    SPAN_DESCRIPTION,
    'ttid_contribution_rate()',
    'ttfd_contribution_rate()',
    'count()',
    `sum(${SPAN_SELF_TIME})`,
    `avg(${SPAN_SELF_TIME})`,
  ];

  const {data, meta, isPending, pageLinks} = useSpans(
    {
      cursor,
      search: queryStringPrimary,
      sorts: [sort],
      limit: 25,
      fields,
    },
    'api.insights.mobile-span-table'
  );

  const columnHeaders: GridColumnHeader[] = [
    {key: SPAN_OP, name: t('Operation'), width: COL_WIDTH_UNDEFINED},
    {key: SPAN_DESCRIPTION, name: t('Span Description'), width: COL_WIDTH_UNDEFINED},
    {
      key: `avg(${SPAN_SELF_TIME})`,
      name: t('Avg Duration'),
      width: COL_WIDTH_UNDEFINED,
    },
  ];

  if (organization.features.includes('insight-modules')) {
    columnHeaders.push({key: 'affects', name: t('Affects'), width: COL_WIDTH_UNDEFINED});
  }
  columnHeaders.push({
    key: `sum(${SPAN_SELF_TIME})`,
    name: t('Total Time Spent'),
    width: COL_WIDTH_UNDEFINED,
  });

  function renderBodyCell(column: any, row: any): React.ReactNode {
    if (!meta?.fields) {
      return row[column.key];
    }

    if (column.key === SPAN_DESCRIPTION) {
      const label = row[SpanFields.SPAN_DESCRIPTION];

      const query = {
        ...location.query,
        transaction,
        spanGroup: row[SpanFields.SPAN_GROUP],
        spanDescription: row[SpanFields.SPAN_DESCRIPTION],
      };

      return (
        <OverflowEllipsisTextContainer>
          <Link to={`${baseURL}?${qs.stringify(query)}`}>{label}</Link>
        </OverflowEllipsisTextContainer>
      );
    }

    if (column.key === 'affects' && hasTTFD) {
      const ttid_contribution_rate = row['ttid_contribution_rate()']
        ? parseFloat(row['ttid_contribution_rate()'])
        : 0;
      const ttfd_contribution_rate = row['ttfd_contribution_rate()']
        ? parseFloat(row['ttfd_contribution_rate()'])
        : 0;

      if (!isNaN(ttid_contribution_rate) && ttid_contribution_rate > 0.99) {
        const tooltipValue = tct(
          'This span always ends before TTID and TTFD and may affect initial and final display. [link: Learn more.]',
          {
            link: (
              <ExternalLink href={`${MODULE_DOC_LINK}#ttid-and-ttfd-affecting-spans`} />
            ),
          }
        );
        return (
          <Tooltip isHoverable title={tooltipValue} showUnderline>
            <Container>{t('TTID, TTFD')}</Container>
          </Tooltip>
        );
      }

      if (!isNaN(ttfd_contribution_rate) && ttfd_contribution_rate > 0.99) {
        const tooltipValue = tct(
          'This span always ends before TTFD and may affect final display. [link: Learn more.]',
          {
            link: (
              <ExternalLink href={`${MODULE_DOC_LINK}#ttid-and-ttfd-affecting-spans`} />
            ),
          }
        );
        return (
          <Tooltip isHoverable title={tooltipValue} showUnderline>
            <Container>{t('TTFD')}</Container>
          </Tooltip>
        );
      }

      const tooltipValue = tct(
        'This span may not be contributing to TTID or TTFD. [link: Learn more.]',
        {
          link: (
            <ExternalLink href={`${MODULE_DOC_LINK}#ttid-and-ttfd-affecting-spans`} />
          ),
        }
      );

      return (
        <Tooltip isHoverable title={tooltipValue}>
          <Container>{'--'}</Container>
        </Tooltip>
      );
    }

    if (column.key === 'affects') {
      const ttid_contribution_rate = row['ttid_contribution_rate()']
        ? parseFloat(row['ttid_contribution_rate()'])
        : 0;

      if (!isNaN(ttid_contribution_rate) && ttid_contribution_rate > 0.99) {
        const tooltipValue = tct(
          'This span always ends before TTID and may affect initial display. [link: Learn more.]',
          {
            link: (
              <ExternalLink href={`${MODULE_DOC_LINK}#ttid-and-ttfd-affecting-spans`} />
            ),
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
          link: (
            <ExternalLink href={`${MODULE_DOC_LINK}#ttid-and-ttfd-affecting-spans`} />
          ),
        }
      );

      return (
        <Tooltip isHoverable title={tooltipValue} showUnderline>
          <Container>{t('No')}</Container>
        </Tooltip>
      );
    }

    const renderer = getFieldRenderer(column.key, meta.fields, false);
    const rendered = renderer(row, {
      location,
      organization,
      unit: meta?.units?.[column.key],
      theme,
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

    const affectsIsCurrentSort =
      column.key === 'affects' &&
      (sort?.field === 'ttid_contribution_rate()' ||
        sort?.field === 'ttfd_contribution_rate()');

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

      function getNewSort() {
        if (column.key === 'affects') {
          if (sort?.field === 'ttid_contribution_rate()') {
            return '-ttfd_contribution_rate()';
          }
          return '-ttid_contribution_rate()';
        }
        return `${newSortDirection === 'desc' ? '-' : ''}${column.key}`;
      }

      return {
        ...location,
        query: {...location.query, [QueryParameterNames.SPANS_SORT]: getNewSort()},
      };
    }

    const canSort =
      column.key === 'affects' || isFieldSortable(field, tableMeta?.fields, true);

    const sortLink = (
      <SortLink
        align={alignment}
        title={column.name}
        direction={
          affectsIsCurrentSort
            ? sort?.field === 'ttid_contribution_rate()'
              ? 'desc'
              : 'asc'
            : sort?.field === column.key
              ? sort.kind
              : undefined
        }
        canSort={canSort}
        generateSortLink={generateSortLink}
      />
    );
    return sortLink;
  }

  const handleCursor: CursorHandler = (newCursor, pathname, query) => {
    navigate({
      pathname,
      query: {...query, [MobileCursors.SPANS_TABLE]: newCursor},
    });
  };

  const {columns, handleResizeColumn} = useQueryBasedColumnResize({
    columns: columnHeaders,
    paramName: COLUMN_RESIZE_PARAM_NAME,
  });

  return (
    <Fragment>
      <GridEditable
        isLoading={isPending || hasTTFDLoading}
        data={data}
        columnOrder={columns}
        columnSortBy={[{key: sort.field, order: sort.kind}]}
        grid={{
          renderHeadCell: column => renderHeadCell(column, meta),
          renderBodyCell,
          onResizeColumn: handleResizeColumn,
        }}
      />
      <Pagination pageLinks={pageLinks} onCursor={handleCursor} />
    </Fragment>
  );
}

const Container = styled('div')`
  ${p => p.theme.overflowEllipsis};
  text-align: right;
`;
