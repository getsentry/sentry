import {Fragment, useMemo} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import * as qs from 'query-string';

import {Tooltip} from 'sentry/components/core/tooltip';
import ExternalLink from 'sentry/components/links/externalLink';
import Link from 'sentry/components/links/link';
import type {CursorHandler} from 'sentry/components/pagination';
import Pagination from 'sentry/components/pagination';
import type {GridColumnHeader} from 'sentry/components/tables/gridEditable';
import GridEditable, {COL_WIDTH_UNDEFINED} from 'sentry/components/tables/gridEditable';
import SortLink from 'sentry/components/tables/gridEditable/sortLink';
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
import {
  PRIMARY_RELEASE_ALIAS,
  SECONDARY_RELEASE_ALIAS,
} from 'sentry/views/insights/common/components/releaseSelector';
import {OverflowEllipsisTextContainer} from 'sentry/views/insights/common/components/textAlign';
import {useSpanMetrics} from 'sentry/views/insights/common/queries/useDiscover';
import {useTTFDConfigured} from 'sentry/views/insights/common/queries/useHasTtfdConfigured';
import {appendReleaseFilters} from 'sentry/views/insights/common/utils/releaseComparison';
import {useModuleURL} from 'sentry/views/insights/common/utils/useModuleURL';
import {QueryParameterNames} from 'sentry/views/insights/common/views/queryParameters';
import useCrossPlatformProject from 'sentry/views/insights/mobile/common/queries/useCrossPlatformProject';
import {
  SpanOpSelector,
  TTID_CONTRIBUTING_SPAN_OPS,
} from 'sentry/views/insights/mobile/screenload/components/spanOpSelector';
import {MobileCursors} from 'sentry/views/insights/mobile/screenload/constants';
import {MODULE_DOC_LINK} from 'sentry/views/insights/mobile/screenload/settings';
import {ModuleName, SpanMetricsField} from 'sentry/views/insights/types';

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
  const organization = useOrganization();
  const moduleURL = useModuleURL(ModuleName.MOBILE_VITALS);
  const baseURL = `${moduleURL}/details/`;

  const theme = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const cursor = decodeScalar(location.query?.[MobileCursors.SPANS_TABLE]);
  const {isProjectCrossPlatform, selectedPlatform} = useCrossPlatformProject();

  const spanOp = decodeScalar(location.query[SpanMetricsField.SPAN_OP]) ?? '';
  const {hasTTFD, isPending: hasTTFDLoading} = useTTFDConfigured([
    `transaction:"${transaction}"`,
  ]);

  const queryStringPrimary = useMemo(() => {
    const searchQuery = new MutableSearch([
      'transaction.op:[ui.load,navigation]',
      `transaction:${transaction}`,
      'has:span.description',
      ...(spanOp
        ? [`${SpanMetricsField.SPAN_OP}:${spanOp}`]
        : [`span.op:[${TTID_CONTRIBUTING_SPAN_OPS.join(',')}]`]),
    ]);

    if (isProjectCrossPlatform) {
      searchQuery.addFilterValue('os.name', selectedPlatform);
    }

    return appendReleaseFilters(searchQuery, primaryRelease, secondaryRelease);
  }, [
    isProjectCrossPlatform,
    primaryRelease,
    secondaryRelease,
    selectedPlatform,
    spanOp,
    transaction,
  ]);

  const sort = decodeSorts(location.query[QueryParameterNames.SPANS_SORT])[0] ?? {
    kind: 'desc',
    field: 'sum(span.self_time)',
  };

  const {data, meta, isPending, pageLinks} = useSpanMetrics(
    {
      cursor,
      search: queryStringPrimary,
      sorts: [sort],
      limit: 25,
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
        `sum(${SPAN_SELF_TIME})`,
      ],
    },
    'api.starfish.mobile-span-table'
  );

  const columnNameMap = {
    [SPAN_OP]: t('Operation'),
    [SPAN_DESCRIPTION]: t('Span Description'),
    'count()': t('Total Count'),
    affects: hasTTFD ? t('Affects') : t('Affects TTID'),
    [`sum(${SPAN_SELF_TIME})`]: t('Total Time Spent'),
    [`avg_if(${SPAN_SELF_TIME},release,${primaryRelease})`]: t(
      'Avg Duration (%s)',
      PRIMARY_RELEASE_ALIAS
    ),
    [`avg_if(${SPAN_SELF_TIME},release,${secondaryRelease})`]: t(
      'Avg Duration (%s)',
      SECONDARY_RELEASE_ALIAS
    ),
  };

  function renderBodyCell(column: any, row: any): React.ReactNode {
    if (!meta?.fields) {
      return row[column.key];
    }

    if (column.key === SPAN_DESCRIPTION) {
      const label = row[SpanMetricsField.SPAN_DESCRIPTION];

      const query = {
        ...location.query,
        transaction,
        spanGroup: row[SpanMetricsField.SPAN_GROUP],
        spanDescription: row[SpanMetricsField.SPAN_DESCRIPTION],
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

  return (
    <Fragment>
      <SpanOpSelector
        primaryRelease={primaryRelease}
        transaction={transaction}
        secondaryRelease={secondaryRelease}
      />
      <GridEditable
        isLoading={isPending || hasTTFDLoading}
        data={data}
        columnOrder={[
          String(SPAN_OP),
          String(SPAN_DESCRIPTION),
          `avg_if(${SPAN_SELF_TIME},release,${primaryRelease})`,
          `avg_if(${SPAN_SELF_TIME},release,${secondaryRelease})`,
          ...(organization.features.includes('insights-initial-modules')
            ? ['affects']
            : []),
          ...['count()', `sum(${SPAN_SELF_TIME})`],
        ].map(col => {
          return {key: col, name: columnNameMap[col] ?? col, width: COL_WIDTH_UNDEFINED};
        })}
        columnSortBy={[{key: sort.field, order: sort.kind}]}
        grid={{
          renderHeadCell: column => renderHeadCell(column, meta),
          renderBodyCell,
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
