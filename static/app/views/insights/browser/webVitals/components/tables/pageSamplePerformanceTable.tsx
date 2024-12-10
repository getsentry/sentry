import {useCallback, useMemo} from 'react';
import styled from '@emotion/styled';

import ProjectAvatar from 'sentry/components/avatar/projectAvatar';
import {Button, LinkButton} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import type {GridColumnHeader, GridColumnOrder} from 'sentry/components/gridEditable';
import GridEditable, {COL_WIDTH_UNDEFINED} from 'sentry/components/gridEditable';
import SortLink from 'sentry/components/gridEditable/sortLink';
import ExternalLink from 'sentry/components/links/externalLink';
import Link from 'sentry/components/links/link';
import Pagination from 'sentry/components/pagination';
import {TransactionSearchQueryBuilder} from 'sentry/components/performance/transactionSearchQueryBuilder';
import {SegmentedControl} from 'sentry/components/segmentedControl';
import {Tooltip} from 'sentry/components/tooltip';
import {IconChevron, IconPlay, IconProfiling} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {defined} from 'sentry/utils';
import {trackAnalytics} from 'sentry/utils/analytics';
import {decodeProjects} from 'sentry/utils/discover/eventView';
import type {Sort} from 'sentry/utils/discover/fields';
import {generateLinkToEventInTraceView} from 'sentry/utils/discover/urls';
import getDuration from 'sentry/utils/duration/getDuration';
import {getShortEventId} from 'sentry/utils/events';
import {generateProfileFlamechartRoute} from 'sentry/utils/profiling/routes';
import {decodeList, decodeScalar} from 'sentry/utils/queryString';
import useReplayExists from 'sentry/utils/replayCount/useReplayExists';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import {useRoutes} from 'sentry/utils/useRoutes';
import {PerformanceBadge} from 'sentry/views/insights/browser/webVitals/components/performanceBadge';
import {useTransactionSamplesWebVitalsScoresQuery} from 'sentry/views/insights/browser/webVitals/queries/storedScoreQueries/useTransactionSamplesWebVitalsScoresQuery';
import {useInpSpanSamplesWebVitalsQuery} from 'sentry/views/insights/browser/webVitals/queries/useInpSpanSamplesWebVitalsQuery';
import {MODULE_DOC_LINK} from 'sentry/views/insights/browser/webVitals/settings';
import type {
  InteractionSpanSampleRowWithScore,
  TransactionSampleRowWithScore,
} from 'sentry/views/insights/browser/webVitals/types';
import {
  DEFAULT_INDEXED_SORT,
  SORTABLE_INDEXED_FIELDS,
} from 'sentry/views/insights/browser/webVitals/types';
import decodeBrowserTypes from 'sentry/views/insights/browser/webVitals/utils/queryParameterDecoders/browserType';
import useProfileExists from 'sentry/views/insights/browser/webVitals/utils/useProfileExists';
import {useWebVitalsSort} from 'sentry/views/insights/browser/webVitals/utils/useWebVitalsSort';
import {
  ModuleName,
  SpanIndexedField,
  SpanMetricsField,
  type SubregionCode,
} from 'sentry/views/insights/types';
import {TraceViewSources} from 'sentry/views/performance/newTraceDetails/traceHeader/breadcrumbs';
import {generateReplayLink} from 'sentry/views/performance/transactionSummary/utils';

type Column = GridColumnHeader<keyof TransactionSampleRowWithScore>;
type InteractionsColumn = GridColumnHeader<keyof InteractionSpanSampleRowWithScore>;

const PAGELOADS_COLUMN_ORDER: GridColumnOrder<keyof TransactionSampleRowWithScore>[] = [
  {key: 'id', width: COL_WIDTH_UNDEFINED, name: t('Event ID')},
  {key: 'user.display', width: COL_WIDTH_UNDEFINED, name: t('User')},
  {key: 'measurements.lcp', width: COL_WIDTH_UNDEFINED, name: 'LCP'},
  {key: 'measurements.fcp', width: COL_WIDTH_UNDEFINED, name: 'FCP'},
  {key: 'measurements.cls', width: COL_WIDTH_UNDEFINED, name: 'CLS'},
  {key: 'measurements.ttfb', width: COL_WIDTH_UNDEFINED, name: 'TTFB'},
  {key: 'profile.id', width: COL_WIDTH_UNDEFINED, name: t('Profile')},
  {key: 'replayId', width: COL_WIDTH_UNDEFINED, name: t('Replay')},
  {key: 'totalScore', width: COL_WIDTH_UNDEFINED, name: t('Score')},
];

const INTERACTION_SAMPLES_COLUMN_ORDER: GridColumnOrder<
  keyof InteractionSpanSampleRowWithScore
>[] = [
  {
    key: SpanIndexedField.SPAN_DESCRIPTION,
    width: COL_WIDTH_UNDEFINED,
    name: t('Interaction Target'),
  },
  {key: 'user.display', width: COL_WIDTH_UNDEFINED, name: t('User')},
  {key: SpanIndexedField.INP, width: COL_WIDTH_UNDEFINED, name: 'INP'},
  {key: 'profile.id', width: COL_WIDTH_UNDEFINED, name: t('Profile')},
  {key: 'replayId', width: COL_WIDTH_UNDEFINED, name: t('Replay')},
  {key: 'inpScore', width: COL_WIDTH_UNDEFINED, name: t('Score')},
];

enum Datatype {
  PAGELOADS = 'pageloads',
  INTERACTIONS = 'interactions',
}

const DATATYPE_KEY = 'type';

type Props = {
  transaction: string;
  limit?: number;
  search?: string;
};

export function PageSamplePerformanceTable({transaction, search, limit = 9}: Props) {
  const location = useLocation();
  const {projects} = useProjects();
  const organization = useOrganization();
  const {replayExists} = useReplayExists();
  const routes = useRoutes();
  const navigate = useNavigate();

  const browserTypes = decodeBrowserTypes(location.query[SpanIndexedField.BROWSER_NAME]);
  const subregions = decodeList(
    location.query[SpanMetricsField.USER_GEO_SUBREGION]
  ) as SubregionCode[];

  let datatype = Datatype.PAGELOADS;
  switch (decodeScalar(location.query[DATATYPE_KEY], 'pageloads')) {
    case 'interactions':
      datatype = Datatype.INTERACTIONS;
      break;
    default:
      datatype = Datatype.PAGELOADS;
  }

  const sortableFields = SORTABLE_INDEXED_FIELDS;

  const sort = useWebVitalsSort({
    defaultSort: DEFAULT_INDEXED_SORT,
    sortableFields: sortableFields as unknown as string[],
  });

  const replayLinkGenerator = generateReplayLink(routes);

  const project = useMemo(
    () => projects.find(p => p.id === String(location.query.project)),
    [projects, location.query.project]
  );

  const query = decodeScalar(location.query.query);

  const {
    data: tableData,
    isLoading,
    pageLinks,
  } = useTransactionSamplesWebVitalsScoresQuery({
    limit,
    transaction,
    query: search,
    withProfiles: true,
    enabled: datatype === Datatype.PAGELOADS,
    browserTypes,
    subregions,
  });

  const {
    data: interactionsTableData,
    isFetching: isInteractionsLoading,
    pageLinks: interactionsPageLinks,
  } = useInpSpanSamplesWebVitalsQuery({
    transaction,
    enabled: datatype === Datatype.INTERACTIONS,
    limit,
    filters: new MutableSearch(query ?? '').filters,
    browserTypes,
    subregions,
  });

  const {profileExists} = useProfileExists(
    interactionsTableData.filter(row => row['profile.id']).map(row => row['profile.id'])
  );

  const getFormattedDuration = (value: number) => {
    return getDuration(value, value < 1 ? 0 : 2, true);
  };

  function renderHeadCell(col: Column | InteractionsColumn) {
    function generateSortLink() {
      const key = ['totalScore', 'inpScore'].includes(col.key)
        ? 'measurements.score.total'
        : col.key;
      let newSortDirection: Sort['kind'] = 'desc';
      if (sort?.field === key) {
        if (sort.kind === 'desc') {
          newSortDirection = 'asc';
        }
      }

      const newSort = `${newSortDirection === 'desc' ? '-' : ''}${key}`;

      return {
        ...location,
        query: {...location.query, sort: newSort},
      };
    }

    const canSort = (sortableFields as ReadonlyArray<string>).includes(col.key);

    if (
      [
        'measurements.fcp',
        'measurements.lcp',
        'measurements.ttfb',
        'measurements.cls',
        'measurements.inp',
        'transaction.duration',
      ].includes(col.key)
    ) {
      if (canSort) {
        return (
          <SortLink
            align="right"
            title={col.name}
            direction={sort?.field === col.key ? sort.kind : undefined}
            canSort={canSort}
            generateSortLink={generateSortLink}
          />
        );
      }
      return (
        <AlignRight>
          <span>{col.name}</span>
        </AlignRight>
      );
    }
    if (col.key === 'totalScore' || col.key === 'inpScore') {
      return (
        <SortLink
          title={
            <AlignCenter>
              <StyledTooltip
                isHoverable
                title={
                  <span>
                    {t('The overall performance rating of this page.')}
                    <br />
                    <ExternalLink href={`${MODULE_DOC_LINK}#performance-score`}>
                      {t('How is this calculated?')}
                    </ExternalLink>
                  </span>
                }
              >
                <TooltipHeader>{t('Perf Score')}</TooltipHeader>
              </StyledTooltip>
            </AlignCenter>
          }
          direction={sort?.field === col.key ? sort.kind : undefined}
          canSort={canSort}
          generateSortLink={generateSortLink}
          align={undefined}
        />
      );
    }
    if (col.key === 'replayId' || col.key === 'profile.id') {
      return (
        <AlignCenter>
          <span>{col.name}</span>
        </AlignCenter>
      );
    }
    return <span>{col.name}</span>;
  }

  function renderBodyCell(
    col: Column | InteractionsColumn,
    row: TransactionSampleRowWithScore | InteractionSpanSampleRowWithScore
  ) {
    const {key} = col;
    if (key === 'totalScore' || key === 'inpScore') {
      return (
        <AlignCenter>
          <PerformanceBadge score={row[key]} />
        </AlignCenter>
      );
    }
    if (key === 'transaction' && 'transaction' in row) {
      return (
        <NoOverflow>
          {project && (
            <StyledProjectAvatar
              project={project}
              direction="left"
              size={16}
              hasTooltip
              tooltip={project.slug}
            />
          )}
          <Link
            to={{...location, query: {...location.query, transaction: row.transaction}}}
          >
            {row.transaction}
          </Link>
        </NoOverflow>
      );
    }
    if (
      [
        'measurements.fcp',
        'measurements.lcp',
        'measurements.ttfb',
        'measurements.inp',
        'transaction.duration',
      ].includes(key)
    ) {
      return (
        <AlignRight>
          {row[key] === undefined ? (
            <NoValue>{' \u2014 '}</NoValue>
          ) : (
            getFormattedDuration((row[key] as number) / 1000)
          )}
        </AlignRight>
      );
    }
    if (['measurements.cls', 'opportunity'].includes(key)) {
      return (
        <AlignRight>
          {row[key] === undefined ? (
            <NoValue>{' \u2014 '}</NoValue>
          ) : (
            Math.round((row[key] as number) * 100) / 100
          )}
        </AlignRight>
      );
    }
    if (key === 'profile.id') {
      const profileId = String(row[key]);
      const profileTarget =
        defined(row.projectSlug) && defined(row[key])
          ? generateProfileFlamechartRoute({
              orgSlug: organization.slug,
              projectSlug: row.projectSlug,
              profileId,
            })
          : null;
      return (
        <NoOverflow>
          <AlignCenter>
            {profileTarget && profileExists(profileId) && (
              <Tooltip title={t('View Profile')}>
                <LinkButton to={profileTarget} size="xs">
                  <IconProfiling size="xs" />
                </LinkButton>
              </Tooltip>
            )}
          </AlignCenter>
        </NoOverflow>
      );
    }

    if (key === 'replayId') {
      const replayTarget =
        (row['transaction.duration'] !== undefined ||
          row[SpanIndexedField.SPAN_SELF_TIME] !== undefined) &&
        replayLinkGenerator(
          organization,
          {
            replayId: row[key],
            id: '', // id doesn't get used in replayLinkGenerator. This is just to satisfy the type.
            'transaction.duration':
              datatype === Datatype.INTERACTIONS
                ? row[SpanIndexedField.SPAN_SELF_TIME]
                : row['transaction.duration'],
            timestamp: row.timestamp,
          },
          undefined
        );
      return (
        <NoOverflow>
          <AlignCenter>
            {replayTarget &&
              Object.keys(replayTarget).length > 0 &&
              replayExists(row[key]) && (
                <Tooltip title={t('View Replay')}>
                  <LinkButton to={replayTarget} size="xs">
                    <IconPlay size="xs" />
                  </LinkButton>
                </Tooltip>
              )}
          </AlignCenter>
        </NoOverflow>
      );
    }

    if (key === 'id' && 'id' in row) {
      const eventTarget = generateLinkToEventInTraceView({
        projectSlug: row.projectSlug,
        traceSlug: row.trace,
        eventId: row.id,
        timestamp: row.timestamp,
        organization,
        location,
        source: TraceViewSources.WEB_VITALS_MODULE,
      });

      return (
        <NoOverflow>
          <Tooltip title={t('View Transaction')}>
            <Link to={eventTarget}>{getShortEventId(row.id)}</Link>
          </Tooltip>
        </NoOverflow>
      );
    }

    if (key === SpanIndexedField.SPAN_DESCRIPTION) {
      return (
        <NoOverflow>
          <Tooltip title={row[key]}>{row[key]}</Tooltip>
        </NoOverflow>
      );
    }

    return <NoOverflow>{row[key]}</NoOverflow>;
  }

  const handleSearch = useCallback(
    (queryString: string) =>
      navigate({
        ...location,
        query: {...location.query, query: queryString},
      }),
    [location, navigate]
  );

  const projectIds = useMemo(() => decodeProjects(location), [location]);

  return (
    <span>
      <SearchBarContainer>
        <SegmentedControl
          size="md"
          value={datatype}
          aria-label={t('Data Type')}
          onChange={newDataSet => {
            // Reset pagination and sort when switching datatypes
            trackAnalytics('insight.vital.overview.toggle_data_type', {
              organization,
              type: newDataSet,
            });

            navigate({
              ...location,
              query: {
                ...location.query,
                sort: undefined,
                cursor: undefined,
                [DATATYPE_KEY]: newDataSet,
              },
            });
          }}
        >
          <SegmentedControl.Item key={Datatype.PAGELOADS} aria-label={t('Pageloads')}>
            {t('Pageloads')}
          </SegmentedControl.Item>
          <SegmentedControl.Item
            key={Datatype.INTERACTIONS}
            aria-label={t('Interactions')}
          >
            {t('Interactions')}
          </SegmentedControl.Item>
        </SegmentedControl>
        <StyledSearchBar>
          <TransactionSearchQueryBuilder
            projects={projectIds}
            initialQuery={query ?? ''}
            searchSource={`${ModuleName.VITAL}-page-summary`}
            onSearch={handleSearch}
          />
        </StyledSearchBar>
      </SearchBarContainer>
      {datatype === Datatype.PAGELOADS && (
        <GridEditable
          isLoading={isLoading}
          columnOrder={PAGELOADS_COLUMN_ORDER}
          columnSortBy={[]}
          data={tableData}
          grid={{
            renderHeadCell,
            renderBodyCell,
          }}
          minimumColWidth={70}
        />
      )}
      {datatype === Datatype.INTERACTIONS && (
        <GridEditable
          isLoading={isInteractionsLoading}
          columnOrder={INTERACTION_SAMPLES_COLUMN_ORDER}
          columnSortBy={[]}
          data={interactionsTableData}
          grid={{
            renderHeadCell,
            renderBodyCell,
          }}
          minimumColWidth={70}
        />
      )}
      <StyledPagination
        pageLinks={datatype === Datatype.INTERACTIONS ? interactionsPageLinks : pageLinks}
        disabled={datatype === Datatype.INTERACTIONS ? isInteractionsLoading : isLoading}
      />
      {/* The Pagination component disappears if pageLinks is not defined,
        which happens any time the table data is loading. So we render a
        disabled button bar if pageLinks is not defined to minimize ui shifting */}
      {!(datatype === Datatype.INTERACTIONS ? interactionsPageLinks : pageLinks) && (
        <Wrapper>
          <ButtonBar merged>
            <Button
              icon={<IconChevron direction="left" />}
              disabled
              aria-label={t('Previous')}
            />
            <Button
              icon={<IconChevron direction="right" />}
              disabled
              aria-label={t('Next')}
            />
          </ButtonBar>
        </Wrapper>
      )}
    </span>
  );
}

const NoOverflow = styled('span')`
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const AlignRight = styled('span')<{color?: string}>`
  text-align: right;
  width: 100%;
  ${p => (p.color ? `color: ${p.color};` : '')}
`;

const AlignCenter = styled('div')`
  display: block;
  margin: auto;
  text-align: center;
  width: 100%;
`;

const StyledProjectAvatar = styled(ProjectAvatar)`
  top: ${space(0.25)};
  position: relative;
  padding-right: ${space(1)};
`;

const NoValue = styled('span')`
  color: ${p => p.theme.gray300};
`;

const SearchBarContainer = styled('div')`
  display: flex;
  margin-bottom: ${space(2)};
  gap: ${space(1)};
`;

const StyledSearchBar = styled('div')`
  flex-grow: 1;
`;

const StyledPagination = styled(Pagination)`
  margin: 0;
`;

const Wrapper = styled('div')`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  margin: 0;
`;

const TooltipHeader = styled('span')`
  ${p => p.theme.tooltipUnderline()};
`;

const StyledTooltip = styled(Tooltip)`
  top: 1px;
  position: relative;
`;
