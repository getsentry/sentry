import {useMemo, useState} from 'react';
import {Link} from 'react-router';
import styled from '@emotion/styled';

import ProjectAvatar from 'sentry/components/avatar/projectAvatar';
import {Button, LinkButton} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import SearchBar from 'sentry/components/events/searchBar';
import type {GridColumnHeader, GridColumnOrder} from 'sentry/components/gridEditable';
import GridEditable, {COL_WIDTH_UNDEFINED} from 'sentry/components/gridEditable';
import SortLink from 'sentry/components/gridEditable/sortLink';
import ExternalLink from 'sentry/components/links/externalLink';
import Pagination from 'sentry/components/pagination';
import {SegmentedControl} from 'sentry/components/segmentedControl';
import {Tooltip} from 'sentry/components/tooltip';
import {IconChevron, IconPlay, IconProfiling} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {defined} from 'sentry/utils';
import type {Sort} from 'sentry/utils/discover/fields';
import {generateEventSlug} from 'sentry/utils/discover/urls';
import {getShortEventId} from 'sentry/utils/events';
import {getDuration} from 'sentry/utils/formatters';
import {getTransactionDetailsUrl} from 'sentry/utils/performance/urls';
import {generateProfileFlamechartRoute} from 'sentry/utils/profiling/routes';
import {decodeScalar} from 'sentry/utils/queryString';
import useReplayExists from 'sentry/utils/replayCount/useReplayExists';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import useRouter from 'sentry/utils/useRouter';
import {useRoutes} from 'sentry/utils/useRoutes';
import {PerformanceBadge} from 'sentry/views/performance/browser/webVitals/components/performanceBadge';
import {useInpSpanSamplesWebVitalsQuery} from 'sentry/views/performance/browser/webVitals/utils/queries/useInpSpanSamplesWebVitalsQuery';
import {useTransactionSamplesWebVitalsQuery} from 'sentry/views/performance/browser/webVitals/utils/queries/useTransactionSamplesWebVitalsQuery';
import type {
  InteractionSpanSampleRowWithScore,
  TransactionSampleRowWithScore,
} from 'sentry/views/performance/browser/webVitals/utils/types';
import {
  DEFAULT_INDEXED_SORT,
  SORTABLE_INDEXED_FIELDS,
  SORTABLE_INDEXED_SCORE_FIELDS,
} from 'sentry/views/performance/browser/webVitals/utils/types';
import {useReplaceFidWithInpSetting} from 'sentry/views/performance/browser/webVitals/utils/useReplaceFidWithInpSetting';
import {useStoredScoresSetting} from 'sentry/views/performance/browser/webVitals/utils/useStoredScoresSetting';
import {useWebVitalsSort} from 'sentry/views/performance/browser/webVitals/utils/useWebVitalsSort';
import {generateReplayLink} from 'sentry/views/performance/transactionSummary/utils';
import {SpanIndexedField, SpanMeasurements} from 'sentry/views/starfish/types';

type Column = GridColumnHeader<keyof TransactionSampleRowWithScore>;
type InteractionsColumn = GridColumnHeader<keyof InteractionSpanSampleRowWithScore>;

const PAGELOADS_COLUMN_ORDER: GridColumnOrder<keyof TransactionSampleRowWithScore>[] = [
  {key: 'id', width: COL_WIDTH_UNDEFINED, name: 'Event ID'},
  {key: 'user.display', width: COL_WIDTH_UNDEFINED, name: 'User'},
  {key: 'measurements.lcp', width: COL_WIDTH_UNDEFINED, name: 'LCP'},
  {key: 'measurements.fcp', width: COL_WIDTH_UNDEFINED, name: 'FCP'},
  {key: 'measurements.fid', width: COL_WIDTH_UNDEFINED, name: 'FID'},
  {key: 'measurements.cls', width: COL_WIDTH_UNDEFINED, name: 'CLS'},
  {key: 'measurements.ttfb', width: COL_WIDTH_UNDEFINED, name: 'TTFB'},
  {key: 'profile.id', width: COL_WIDTH_UNDEFINED, name: 'Profile'},
  {key: 'replayId', width: COL_WIDTH_UNDEFINED, name: 'Replay'},
  {key: 'totalScore', width: COL_WIDTH_UNDEFINED, name: 'Score'},
];

const INTERACTION_SAMPLES_COLUMN_ORDER: GridColumnOrder<
  keyof InteractionSpanSampleRowWithScore
>[] = [
  {key: 'user.display', width: COL_WIDTH_UNDEFINED, name: 'User'},
  {key: SpanMeasurements.INP, width: COL_WIDTH_UNDEFINED, name: 'INP'},
  {key: 'profile.id', width: COL_WIDTH_UNDEFINED, name: 'Profile'},
  {key: 'replayId', width: COL_WIDTH_UNDEFINED, name: 'Replay'},
  {key: 'inpScore', width: COL_WIDTH_UNDEFINED, name: 'Score'},
];

enum Dataset {
  PAGELOADS = 'pageloads',
  INTERACTIONS = 'interactions',
}

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
  const router = useRouter();
  const shouldUseStoredScores = useStoredScoresSetting();
  const shouldReplaceFidWithInp = useReplaceFidWithInpSetting();

  const [dataset, setDataset] = useState(Dataset.PAGELOADS);

  const samplesColumnOrder = useMemo(() => {
    if (shouldReplaceFidWithInp) {
      return PAGELOADS_COLUMN_ORDER.filter(col => col.key !== 'measurements.fid');
    }
    return PAGELOADS_COLUMN_ORDER;
  }, [shouldReplaceFidWithInp]);

  const sortableFields = shouldUseStoredScores
    ? SORTABLE_INDEXED_FIELDS
    : SORTABLE_INDEXED_FIELDS.filter(
        field => !SORTABLE_INDEXED_SCORE_FIELDS.includes(field)
      );

  let sort = useWebVitalsSort({
    defaultSort: DEFAULT_INDEXED_SORT,
    sortableFields: sortableFields as unknown as string[],
  });
  // Need to map fid back to inp for rendering
  if (shouldReplaceFidWithInp && sort.field === 'measurements.fid') {
    sort = {...sort, field: 'measurements.inp'};
  }
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
  } = useTransactionSamplesWebVitalsQuery({
    limit,
    transaction,
    query: search,
    withProfiles: true,
    enabled: dataset === Dataset.PAGELOADS,
  });

  const interactionsPageLinks = null;

  const {data: interactionsTableData, isFetching: isInteractionsLoading} =
    useInpSpanSamplesWebVitalsQuery({
      transaction,
      enabled: dataset === Dataset.INTERACTIONS,
      limit: 9,
    });

  const getFormattedDuration = (value: number) => {
    return getDuration(value, value < 1 ? 0 : 2, true);
  };

  function renderHeadCell(col: Column | InteractionsColumn) {
    function generateSortLink() {
      const key = col.key === 'inpScore' ? 'measurements.score.total' : col.key;
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
        'measurements.fid',
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
                    <ExternalLink href="https://docs.sentry.io/product/performance/web-vitals/#performance-score">
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
        'measurements.fid',
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
      const profileTarget =
        defined(row.projectSlug) && defined(row[key])
          ? generateProfileFlamechartRoute({
              orgSlug: organization.slug,
              projectSlug: row.projectSlug,
              profileId: String(row[key]),
            })
          : null;
      return (
        <NoOverflow>
          <AlignCenter>
            {profileTarget && (
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

    if (key === 'replayId' && 'id' in row) {
      const replayTarget =
        row['transaction.duration'] !== undefined &&
        replayLinkGenerator(
          organization,
          {
            replayId: row[key],
            id: row.id,
            'transaction.duration':
              dataset === Dataset.INTERACTIONS
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
      const eventSlug = generateEventSlug({...row, project: row.projectSlug});
      const eventTarget = getTransactionDetailsUrl(organization.slug, eventSlug);
      return (
        <NoOverflow>
          <Tooltip title={t('View Transaction')}>
            <Link to={eventTarget}>{getShortEventId(row.id)}</Link>
          </Tooltip>
        </NoOverflow>
      );
    }
    return <NoOverflow>{row[key]}</NoOverflow>;
  }

  return (
    <span>
      <SearchBarContainer>
        {shouldReplaceFidWithInp && (
          <SegmentedControl
            size="md"
            value={dataset}
            onChange={newDataSet => {
              // Reset pagination and sort when switching datasets
              router.replace({
                ...location,
                query: {...location.query, sort: undefined, cursor: undefined},
              });
              setDataset(newDataSet);
            }}
          >
            <SegmentedControl.Item key={Dataset.PAGELOADS}>
              {t('Pageloads')}
            </SegmentedControl.Item>
            <SegmentedControl.Item key={Dataset.INTERACTIONS}>
              {t('Interactions')}
            </SegmentedControl.Item>
          </SegmentedControl>
        )}

        <StyledSearchBar
          query={query}
          organization={organization}
          onSearch={queryString =>
            router.replace({
              ...location,
              query: {...location.query, query: queryString},
            })
          }
        />
        <StyledPagination
          pageLinks={dataset === Dataset.INTERACTIONS ? interactionsPageLinks : pageLinks}
          disabled={dataset === Dataset.INTERACTIONS ? isInteractionsLoading : isLoading}
          size="md"
        />
        {/* The Pagination component disappears if pageLinks is not defined,
        which happens any time the table data is loading. So we render a
        disabled button bar if pageLinks is not defined to minimize ui shifting */}
        {!(dataset === Dataset.INTERACTIONS ? interactionsPageLinks : pageLinks) && (
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
      </SearchBarContainer>
      <GridContainer>
        {dataset === Dataset.PAGELOADS && (
          <GridEditable
            isLoading={isLoading}
            columnOrder={samplesColumnOrder}
            columnSortBy={[]}
            data={tableData}
            grid={{
              renderHeadCell,
              renderBodyCell,
            }}
            location={location}
            minimumColWidth={70}
          />
        )}
        {dataset === Dataset.INTERACTIONS && (
          <GridEditable
            isLoading={isInteractionsLoading}
            columnOrder={INTERACTION_SAMPLES_COLUMN_ORDER}
            columnSortBy={[]}
            data={interactionsTableData as unknown as InteractionSpanSampleRowWithScore[]}
            grid={{
              renderHeadCell,
              renderBodyCell,
            }}
            location={location}
            minimumColWidth={70}
          />
        )}
      </GridContainer>
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

// Not pretty but we need to override gridEditable styles since the original
// styles have too much padding for small spaces
const GridContainer = styled('div')`
  margin-bottom: ${space(1)};
  th {
    padding: 0 ${space(1)};
  }
  th:first-child {
    padding-left: ${space(2)};
  }
  th:last-child {
    padding-right: ${space(2)};
  }
  td {
    padding: ${space(1)};
  }
  td:first-child {
    padding-right: ${space(1)};
    padding-left: ${space(2)};
  }
`;

const NoValue = styled('span')`
  color: ${p => p.theme.gray300};
`;

const SearchBarContainer = styled('div')`
  display: flex;
  margin-top: ${space(2)};
  margin-bottom: ${space(1)};
  gap: ${space(1)};
`;

const StyledSearchBar = styled(SearchBar)`
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
