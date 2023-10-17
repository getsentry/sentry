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
import {IconPlay} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {eventDetailsRoute, generateEventSlug} from 'sentry/utils/discover/urls';
import {getDuration} from 'sentry/utils/formatters';
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

type TransactionSampleRowWithScoreAndExtra = TransactionSampleRow & {
  score: number;
  view: any;
};

type Column = GridColumnHeader<keyof TransactionSampleRowWithScoreAndExtra>;

const columnOrder: GridColumnOrder<keyof TransactionSampleRowWithScoreAndExtra>[] = [
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
};

export function PageSamplePerformanceTable({transaction}: Props) {
  const location = useLocation();
  const {projects} = useProjects();
  const organization = useOrganization();
  const routes = useRoutes();
  const replayLinkGenerator = generateReplayLink(routes);

  const project = useMemo(
    () => projects.find(p => p.id === String(location.query.project)),
    [projects, location.query.project]
  );

  // Do 3 queries filtering on LCP to get a spread of good, meh, and poor events
  // We can't query by performance score yet, so we're using LCP as a best estimate
  const {data: goodData, isLoading: isGoodTransactionWebVitalsQueryLoading} =
    useTransactionSamplesWebVitalsQuery({
      limit: 3,
      transaction,
      query: `measurements.lcp:<${PERFORMANCE_SCORE_P90S.lcp}`,
    });

  const {data: mehData, isLoading: isMehTransactionWebVitalsQueryLoading} =
    useTransactionSamplesWebVitalsQuery({
      limit: 3,
      transaction,
      query: `measurements.lcp:<${PERFORMANCE_SCORE_MEDIANS.lcp} measurements.lcp:>=${PERFORMANCE_SCORE_P90S.lcp}`,
    });

  const {data: poorData, isLoading: isPoorTransactionWebVitalsQueryLoading} =
    useTransactionSamplesWebVitalsQuery({
      limit: 3,
      transaction,
      query: `measurements.lcp:>=${PERFORMANCE_SCORE_MEDIANS.lcp}`,
    });

  // In case we don't have enough data, get some transactions with no LCP data
  const {data: noLcpData, isLoading: isNoLcpTransactionWebVitalsQueryLoading} =
    useTransactionSamplesWebVitalsQuery({
      limit: 9,
      transaction,
      query: `!has:measurements.lcp`,
    });

  const data = [...goodData, ...mehData, ...poorData];

  // If we don't have enough data, fill in the rest with no LCP data
  if (data.length < 9) {
    data.push(...noLcpData.slice(0, 9 - data.length));
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
            <NoValue>{t('(no value)')}</NoValue>
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
      const eventSlug = generateEventSlug({...row, project: project?.slug});
      const eventTarget = eventDetailsRoute({
        orgSlug: organization.slug,
        eventSlug,
      });
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

      return (
        <NoOverflow>
          <Flex>
            <LinkButton to={eventTarget} size="xs">
              {t('Event')}
            </LinkButton>
            {row.replayId && replayTarget && (
              <LinkButton to={replayTarget} size="xs">
                <IconPlay size="xs" />
              </LinkButton>
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
          columnOrder={columnOrder}
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
