import {useMemo} from 'react';
import {Link} from 'react-router';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import * as qs from 'query-string';

import ProjectAvatar from 'sentry/components/avatar/projectAvatar';
import GridEditable, {
  COL_WIDTH_UNDEFINED,
  GridColumnHeader,
  GridColumnOrder,
  GridColumnSortBy,
} from 'sentry/components/gridEditable';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {getDuration} from 'sentry/utils/formatters';
import {
  PageErrorAlert,
  PageErrorProvider,
} from 'sentry/utils/performance/contexts/pageError';
import {useLocation} from 'sentry/utils/useLocation';
import useProjects from 'sentry/utils/useProjects';
import {getScoreColor} from 'sentry/views/performance/browser/webVitals/utils/getScoreColor';
import {
  Row,
  RowWithScore,
  WebVitals,
} from 'sentry/views/performance/browser/webVitals/utils/types';
import {useTransactionWebVitalsQuery} from 'sentry/views/performance/browser/webVitals/utils/useTransactionWebVitalsQuery';
import {ClsDescription} from 'sentry/views/performance/browser/webVitals/webVitalsDescriptions/cls';
import {FcpDescription} from 'sentry/views/performance/browser/webVitals/webVitalsDescriptions/fcp';
import {FidDescription} from 'sentry/views/performance/browser/webVitals/webVitalsDescriptions/fid';
import {LcpDescription} from 'sentry/views/performance/browser/webVitals/webVitalsDescriptions/lcp';
import {TtfbDescription} from 'sentry/views/performance/browser/webVitals/webVitalsDescriptions/ttfb';
import DetailPanel from 'sentry/views/starfish/components/detailPanel';

type Column = GridColumnHeader;

const columnOrder: GridColumnOrder[] = [
  {key: 'transaction', width: COL_WIDTH_UNDEFINED, name: 'Transaction'},
  {key: 'count()', width: COL_WIDTH_UNDEFINED, name: 'Count'},
  {key: 'webVital', width: COL_WIDTH_UNDEFINED, name: 'Web Vital'},
  {key: 'score', width: COL_WIDTH_UNDEFINED, name: 'Score'},
];

const sort: GridColumnSortBy<keyof Row> = {key: 'count()', order: 'desc'};

export function WebVitalsDetailPanel({
  webVital,
  onClose,
}: {
  onClose: () => void;
  webVital: WebVitals | null;
}) {
  const location = useLocation();
  const {projects} = useProjects();
  const theme = useTheme();

  const project = useMemo(
    () => projects.find(p => p.id === String(location.query.project)),
    [projects, location.query.project]
  );

  const {data, isLoading} = useTransactionWebVitalsQuery({
    orderBy: webVital,
    limit: 10,
  });

  const detailKey = webVital;

  const renderHeadCell = (col: Column) => {
    if (col.key === 'transaction') {
      return <NoOverflow>{col.name}</NoOverflow>;
    }
    if (col.key === 'webVital') {
      return <AlignRight>{`${webVital}`}</AlignRight>;
    }
    if (col.key === 'score') {
      return <AlignRight>{`${webVital} ${col.name}`}</AlignRight>;
    }
    return <AlignRight>{col.name}</AlignRight>;
  };

  const renderBodyCell = (col: Column, row: RowWithScore) => {
    const {key} = col;
    if (key === 'score') {
      return (
        <AlignRight color={getScoreColor(row[`${webVital}Score`], theme)}>
          {row[`${webVital}Score`]}
        </AlignRight>
      );
    }
    if (col.key === 'webVital') {
      let value: string | number = row[mapWebVitalToColumn(webVital)];
      if (webVital && ['lcp', 'fcp', 'ttfb', 'fid'].includes(webVital)) {
        value = getDuration(value / 1000, 2, true);
      } else if (webVital === 'cls') {
        value = value?.toFixed(2);
      }
      return <AlignRight>{value}</AlignRight>;
    }
    if (key === 'count()') {
      return <AlignRight>{row['count()']}</AlignRight>;
    }
    if (key === 'transaction') {
      const link = `/performance/summary/?${qs.stringify({
        project: project?.id,
        transaction: row.transaction,
      })}`;
      return (
        <NoOverflow>
          <Link to={link}>{row.transaction}</Link>
        </NoOverflow>
      );
    }
    return <NoOverflow>{row[key]}</NoOverflow>;
  };

  return (
    <PageErrorProvider>
      <DetailPanel detailKey={detailKey ?? undefined} onClose={onClose}>
        {project && (
          <SpanSummaryProjectAvatar
            project={project}
            direction="left"
            size={40}
            hasTooltip
            tooltip={project.slug}
          />
        )}
        {webVital === 'lcp' && <LcpDescription />}
        {webVital === 'fcp' && <FcpDescription />}
        {webVital === 'ttfb' && <TtfbDescription />}
        {webVital === 'cls' && <ClsDescription />}
        {webVital === 'fid' && <FidDescription />}

        <h5>{t('Pages to Improve')}</h5>
        <GridEditable
          data={data}
          isLoading={isLoading}
          columnOrder={columnOrder}
          columnSortBy={[sort]}
          grid={{
            renderHeadCell,
            renderBodyCell,
          }}
          location={location}
        />
        <PageErrorAlert />
      </DetailPanel>
    </PageErrorProvider>
  );
}

const mapWebVitalToColumn = (webVital?: WebVitals | null) => {
  switch (webVital) {
    case 'lcp':
      return 'p75(measurements.lcp)';
    case 'fcp':
      return 'p75(measurements.fcp)';
    case 'cls':
      return 'p75(measurements.cls)';
    case 'ttfb':
      return 'p75(measurements.ttfb)';
    case 'fid':
      return 'p75(measurements.fid)';
    default:
      return 'count()';
  }
};

const SpanSummaryProjectAvatar = styled(ProjectAvatar)`
  padding-top: ${space(1)};
  padding-bottom: ${space(2)};
`;

const NoOverflow = styled('span')`
  overflow: hidden;
  text-overflow: ellipsis;
`;

const AlignRight = styled('span')<{color?: string}>`
  text-align: right;
  width: 100%;
  ${p => (p.color ? `color: ${p.color};` : '')}
`;
