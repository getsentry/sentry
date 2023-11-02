import {useMemo} from 'react';
import {Link} from 'react-router';
import styled from '@emotion/styled';

import ProjectAvatar from 'sentry/components/avatar/projectAvatar';
import {LinkButton} from 'sentry/components/button';
import GridEditable, {
  COL_WIDTH_UNDEFINED,
  GridColumnHeader,
  GridColumnOrder,
} from 'sentry/components/gridEditable';
import {Tooltip} from 'sentry/components/tooltip';
import {IconLightning, IconPlay, IconProfiling} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {defined} from 'sentry/utils';
import {generateEventSlug} from 'sentry/utils/discover/urls';
import {getDuration} from 'sentry/utils/formatters';
import {getTransactionDetailsUrl} from 'sentry/utils/performance/urls';
import {generateProfileFlamechartRoute} from 'sentry/utils/profiling/routes';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import {useRoutes} from 'sentry/utils/useRoutes';
import {PerformanceBadge} from 'sentry/views/performance/browser/webVitals/components/performanceBadge';
import {
  PERFORMANCE_SCORE_MEDIANS,
  PERFORMANCE_SCORE_P90S,
} from 'sentry/views/performance/browser/webVitals/utils/calculatePerformanceScore';
import {TransactionSampleRow} from 'sentry/views/performance/browser/webVitals/utils/types';
import {useTransactionSamplesWebVitalsQuery} from 'sentry/views/performance/browser/webVitals/utils/useTransactionSamplesWebVitalsQuery';
import {generateReplayLink} from 'sentry/views/performance/transactionSummary/utils';

export type TransactionSampleRowWithScoreAndExtra = TransactionSampleRow & {
  score: number;
  view: any;
};

type Column = GridColumnHeader<keyof TransactionSampleRowWithScoreAndExtra>;

export const COLUMN_ORDER: GridColumnOrder<
  keyof TransactionSampleRowWithScoreAndExtra
>[] = [
  {key: 'user.display', width: COL_WIDTH_UNDEFINED, name: 'User'},
  {key: 'transaction.duration', width: COL_WIDTH_UNDEFINED, name: 'Duration'},
  {key: 'measurements.lcp', width: COL_WIDTH_UNDEFINED, name: 'LCP'},
  {key: 'measurements.fcp', width: COL_WIDTH_UNDEFINED, name: 'FCP'},
  {key: 'measurements.fid', width: COL_WIDTH_UNDEFINED, name: 'FID'},
  {key: 'measurements.cls', width: COL_WIDTH_UNDEFINED, name: 'CLS'},
  {key: 'measurements.ttfb', width: COL_WIDTH_UNDEFINED, name: 'TTFB'},
  {key: 'score', width: COL_WIDTH_UNDEFINED, name: 'Score'},
  {key: 'view', width: COL_WIDTH_UNDEFINED, name: 'View'},
];

type Props = {
  transaction: string;
  columnOrder?: GridColumnOrder<keyof TransactionSampleRowWithScoreAndExtra>[];
  limit?: number;
  search?: string;
};

export function PageSamplePerformanceTable({
  transaction,
  columnOrder,
  search,
  limit = 9,
}: Props) {
  const location = useLocation();
  const {projects} = useProjects();
  const organization = useOrganization();
  const routes = useRoutes();
  const replayLinkGenerator = generateReplayLink(routes);

  const project = useMemo(
    () => projects.find(p => p.id === String(location.query.project)),
    [projects, location.query.project]
  );

  const limitInThirds = Math.floor(limit / 3);

  // Do 3 queries filtering on LCP to get a spread of good, meh, and poor events
  // We can't query by performance score yet, so we're using LCP as a best estimate
  const {data: goodData, isLoading: isGoodTransactionWebVitalsQueryLoading} =
    useTransactionSamplesWebVitalsQuery({
      limit: limitInThirds,
      transaction,
      query: `measurements.lcp:<${PERFORMANCE_SCORE_P90S.lcp} ${search ?? ''}`,
      withProfiles: true,
    });

  const {data: mehData, isLoading: isMehTransactionWebVitalsQueryLoading} =
    useTransactionSamplesWebVitalsQuery({
      limit: limitInThirds,
      transaction,
      query: `measurements.lcp:<${PERFORMANCE_SCORE_MEDIANS.lcp} measurements.lcp:>=${
        PERFORMANCE_SCORE_P90S.lcp
      } ${search ?? ''}`,
      withProfiles: true,
    });

  const {data: poorData, isLoading: isPoorTransactionWebVitalsQueryLoading} =
    useTransactionSamplesWebVitalsQuery({
      limit: limitInThirds,
      transaction,
      query: `measurements.lcp:>=${PERFORMANCE_SCORE_MEDIANS.lcp} ${search ?? ''}`,
      withProfiles: true,
    });

  // In case we don't have enough data, get some transactions with no LCP data
  const {data: noLcpData, isLoading: isNoLcpTransactionWebVitalsQueryLoading} =
    useTransactionSamplesWebVitalsQuery({
      limit,
      transaction,
      query: `!has:measurements.lcp ${search ?? ''}`,
      withProfiles: true,
    });

  const data = [...goodData, ...mehData, ...poorData];

  // If we have enough data, but not enough with profiles, replace rows without profiles with no LCP data that have profiles
  if (
    data.length >= 9 &&
    data.filter(row => row['profile.id']).length < 9 &&
    noLcpData.filter(row => row['profile.id']).length > 0
  ) {
    const noLcpDataWithProfiles = noLcpData.filter(row => row['profile.id']);
    let numRowsToReplace = Math.min(
      data.filter(row => !row['profile.id']).length,
      noLcpDataWithProfiles.length
    );
    while (numRowsToReplace > 0) {
      const index = data.findIndex(row => !row['profile.id']);
      data[index] = noLcpDataWithProfiles.pop()!;
      numRowsToReplace--;
    }
  }

  // If we don't have enough data, fill in the rest with no LCP data
  if (data.length < limit) {
    data.push(...noLcpData.slice(0, limit - data.length));
  }

  const isTransactionWebVitalsQueryLoading =
    isGoodTransactionWebVitalsQueryLoading ||
    isMehTransactionWebVitalsQueryLoading ||
    isPoorTransactionWebVitalsQueryLoading ||
    isNoLcpTransactionWebVitalsQueryLoading;

  const tableData: TransactionSampleRowWithScoreAndExtra[] = data
    .map(row => ({
      ...row,
      view: null,
    }))
    .sort((a, b) => a.score - b.score);
  const getFormattedDuration = (value: number) => {
    return getDuration(value, value < 1 ? 0 : 2, true);
  };

  function renderHeadCell(col: Column) {
    if (
      [
        'measurements.fcp',
        'measurements.lcp',
        'measurements.ttfb',
        'measurements.fid',
        'measurements.cls',
        'transaction.duration',
      ].includes(col.key)
    ) {
      return (
        <AlignRight>
          <span>{col.name}</span>
        </AlignRight>
      );
    }
    if (col.key === 'score') {
      return (
        <AlignCenter>
          <span>{col.name}</span>
        </AlignCenter>
      );
    }
    return <span>{col.name}</span>;
  }

  function renderBodyCell(col: Column, row: TransactionSampleRowWithScoreAndExtra) {
    const {key} = col;
    if (key === 'score') {
      return (
        <AlignCenter>
          <PerformanceBadge score={row.score} />
        </AlignCenter>
      );
    }
    if (key === 'transaction') {
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
        'transaction.duration',
      ].includes(key)
    ) {
      return (
        <AlignRight>
          {row[key] === null ? (
            <NoValue>{' \u2014 '}</NoValue>
          ) : (
            getFormattedDuration((row[key] as number) / 1000)
          )}
        </AlignRight>
      );
    }
    if (['measurements.cls', 'opportunity'].includes(key)) {
      return <AlignRight>{Math.round((row[key] as number) * 100) / 100}</AlignRight>;
    }
    if (key === 'view') {
      const eventSlug = generateEventSlug({...row, project: row.projectSlug});
      const eventTarget = getTransactionDetailsUrl(organization.slug, eventSlug);
      const replayTarget =
        row['transaction.duration'] !== null &&
        replayLinkGenerator(
          organization,
          {
            replayId: row.replayId,
            id: row.id,
            'transaction.duration': row['transaction.duration'],
            timestamp: row.timestamp,
          },
          undefined
        );
      const profileTarget =
        defined(project) && defined(row['profile.id'])
          ? generateProfileFlamechartRoute({
              orgSlug: organization.slug,
              projectSlug: project.slug,
              profileId: String(row['profile.id']),
            })
          : null;

      return (
        <NoOverflow>
          <Flex>
            <Tooltip title={t('View Transaction')}>
              <LinkButton to={eventTarget} size="xs">
                <IconLightning size="xs" />
              </LinkButton>
            </Tooltip>
            {profileTarget && (
              <Tooltip title={t('View Profile')}>
                <LinkButton to={profileTarget} size="xs">
                  <IconProfiling size="xs" />
                </LinkButton>
              </Tooltip>
            )}
            {row.replayId && replayTarget && (
              <Tooltip title={t('View Replay')}>
                <LinkButton to={replayTarget} size="xs">
                  <IconPlay size="xs" />
                </LinkButton>
              </Tooltip>
            )}
          </Flex>
        </NoOverflow>
      );
    }
    return <NoOverflow>{row[key]}</NoOverflow>;
  }

  return (
    <span>
      <GridContainer>
        <GridEditable
          isLoading={isTransactionWebVitalsQueryLoading}
          columnOrder={columnOrder ?? COLUMN_ORDER}
          columnSortBy={[]}
          data={tableData}
          grid={{
            renderHeadCell,
            renderBodyCell,
          }}
          location={location}
        />
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

const AlignCenter = styled('span')`
  text-align: center;
  width: 100%;
`;

const StyledProjectAvatar = styled(ProjectAvatar)`
  top: ${space(0.25)};
  position: relative;
  padding-right: ${space(1)};
`;

const GridContainer = styled('div')`
  margin-bottom: ${space(1)};
`;

const Flex = styled('div')`
  display: flex;
  gap: ${space(1)};
`;

const NoValue = styled('span')`
  color: ${p => p.theme.gray300};
`;
