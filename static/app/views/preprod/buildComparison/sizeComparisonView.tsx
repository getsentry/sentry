import {Fragment} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import {Alert} from 'sentry/components/core/alert';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import {IconChevron, IconDownload, IconInfo, IconTrending} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {UseApiQueryResult} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';

interface SizeAnalysisComparison {
  comparison_id: number | null;
  error_code: string | null;
  error_message: string | null;
  identifier: string;
  metrics_artifact_type: string;
  state: 'SUCCESS' | 'FAILED' | 'PROCESSING' | 'PENDING';
}

interface SizeComparisonResponse {
  base_artifact_id: number;
  comparisons: SizeAnalysisComparison[];
  head_artifact_id: number;
}

interface SizeComparisonViewProps {
  baseArtifactId: string;
  headArtifactId: string;
  sizeComparisonQuery: UseApiQueryResult<SizeComparisonResponse, RequestError>;
}

interface FileChange {
  change: 'Modified' | 'Added' | 'Removed';
  filePath: string;
  size: string;
  sizeDiff: string;
  type: string;
}

// Mock data based on the image - this would come from the API response
const mockSummaryData = {
  sizeDifference: '200 KB',
  percentageChange: 5,
  installSizeIncrease: 100,
  downloadSizeIncrease: 100,
};

const mockMetrics = [
  {
    title: 'Install Size',
    value: '4.4 MB',
    change: '+2.2 MB (100% larger)',
    comparison: '2.2 MB',
    icon: IconInfo,
  },
  {
    title: 'Download Size',
    value: '4.4 MB',
    change: '+2.2 MB (100% larger)',
    comparison: '2.2 MB',
    icon: IconDownload,
  },
  {
    title: 'Potential Savings',
    value: '-10 MB',
    change: '4 new insights',
    comparison: '',
    icon: IconTrending,
    isPositive: true,
  },
  {
    title: 'Largest file change',
    value: '3 MB',
    change: '+1 MB (50% larger)',
    comparison: '2 MB',
    icon: IconChevron,
  },
];

const mockFileChanges: FileChange[] = [
  {
    change: 'Modified',
    filePath:
      'Hacker News/base-master.apk/Dex/androidx/androidx.datastore/androidx.datastore.core/androidx.datastore.c...',
    type: 'XML',
    size: '19.23 MB',
    sizeDiff: '(+18.4 MB)',
  },
  {
    change: 'Modified',
    filePath:
      'Hacker News/base-master.apk/Dex/androidx/androidx.collection/androidx.collection.KeysIterator$1',
    type: 'Binary XML',
    size: '54.56 MB',
    sizeDiff: '(+15.6 MB)',
  },
  // Add more mock data as needed...
];

export function SizeComparisonView({
  sizeComparisonQuery,
  // headArtifactId,
  // baseArtifactId,
}: SizeComparisonViewProps) {
  const theme = useTheme();

  if (sizeComparisonQuery.isLoading) {
    return <LoadingIndicator />;
  }

  if (sizeComparisonQuery.isError || !sizeComparisonQuery.data) {
    return (
      <Alert type="error">
        {sizeComparisonQuery.error?.message || 'Failed to load size comparison data'}
      </Alert>
    );
  }

  const isIncrease = mockSummaryData.percentageChange > 0;

  return (
    <Fragment>
      {/* Summary Section */}
      <SummaryPanel>
        <SummaryHeader>
          <IconTrending size="sm" color={theme.purple300} />
          <SummaryTitle>{t('Size Summary')}</SummaryTitle>
        </SummaryHeader>
        <SummaryContent>
          <SummaryText>
            Your build is{' '}
            <SizeChange isIncrease={isIncrease}>
              {mockSummaryData.sizeDifference} {isIncrease ? 'larger' : 'smaller'} (
              {mockSummaryData.percentageChange}% {isIncrease ? 'increase' : 'decrease'})
            </SizeChange>
          </SummaryText>
          <SummaryDetails>
            <SummaryDetail>
              • Install size went up by {mockSummaryData.installSizeIncrease}%
            </SummaryDetail>
            <SummaryDetail>
              • Download size went up by {mockSummaryData.downloadSizeIncrease}%
            </SummaryDetail>
          </SummaryDetails>
        </SummaryContent>
      </SummaryPanel>

      {/* Metrics Grid */}
      <MetricsGrid>
        {mockMetrics.map((metric, index) => (
          <MetricCard key={index}>
            <MetricHeader>
              <metric.icon size="sm" />
              <MetricTitle>{metric.title}</MetricTitle>
            </MetricHeader>
            <MetricValue isPositive={metric.isPositive}>{metric.value}</MetricValue>
            <MetricChange>{metric.change}</MetricChange>
            {metric.comparison && (
              <MetricComparison>Comparison: {metric.comparison}</MetricComparison>
            )}
          </MetricCard>
        ))}
      </MetricsGrid>

      {/* Files Changed Section */}
      <Panel>
        <PanelHeader>
          <FilesChangedHeader>
            <span>Files Changed: 14 (-21 MB)</span>
            <Button size="sm" icon={<IconChevron direction="down" />}>
              Size Diff
            </Button>
          </FilesChangedHeader>
        </PanelHeader>
        <PanelBody>
          <FilesTable>
            <TableHeader>
              <HeaderCell>Change</HeaderCell>
              <HeaderCell>File Path</HeaderCell>
              <HeaderCell>Type</HeaderCell>
              <HeaderCell>Size</HeaderCell>
              <HeaderCell>Size Diff</HeaderCell>
            </TableHeader>
            <TableBody>
              {mockFileChanges.map((file, index) => (
                <TableRow key={index}>
                  <ChangeCell>
                    <ChangeTag changeType={file.change}>{file.change}</ChangeTag>
                  </ChangeCell>
                  <FilePathCell>{file.filePath}</FilePathCell>
                  <TypeCell>{file.type}</TypeCell>
                  <SizeCell>{file.size}</SizeCell>
                  <SizeDiffCell>{file.sizeDiff}</SizeDiffCell>
                </TableRow>
              ))}
            </TableBody>
          </FilesTable>
        </PanelBody>
      </Panel>
    </Fragment>
  );
}

const SummaryPanel = styled(Panel)`
  margin-bottom: ${space(3)};
`;

const SummaryHeader = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(1)};
  padding: ${space(2)};
  border-bottom: 1px solid ${p => p.theme.border};
`;

const SummaryTitle = styled('h3')`
  margin: 0;
  font-size: ${p => p.theme.fontSize.sm};
  color: ${p => p.theme.purple300};
`;

const SummaryContent = styled('div')`
  padding: ${space(3)};
`;

const SummaryText = styled('div')`
  font-size: ${p => p.theme.fontSize.lg};
  margin-bottom: ${space(2)};
`;

const SizeChange = styled('span')<{isIncrease: boolean}>`
  color: ${p => (p.isIncrease ? p.theme.red300 : p.theme.green300)};
  font-weight: 600;
`;

const SummaryDetails = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(0.5)};
`;

const SummaryDetail = styled('div')`
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSize.sm};
`;

const MetricsGrid = styled('div')`
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: ${space(2)};
  margin-bottom: ${space(3)};
`;

const MetricCard = styled(Panel)`
  padding: ${space(2)};
`;

const MetricHeader = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(1)};
  margin-bottom: ${space(1)};
`;

const MetricTitle = styled('span')`
  font-size: ${p => p.theme.fontSize.sm};
  color: ${p => p.theme.subText};
`;

const MetricValue = styled('div')<{isPositive?: boolean}>`
  font-size: ${p => p.theme.fontSize.xl};
  font-weight: 600;
  margin-bottom: ${space(0.5)};
  color: ${p => (p.isPositive ? p.theme.green300 : p.theme.textColor)};
`;

const MetricChange = styled('div')`
  font-size: ${p => p.theme.fontSize.sm};
  color: ${p => p.theme.red300};
`;

const MetricComparison = styled('div')`
  font-size: ${p => p.theme.fontSize.xs};
  color: ${p => p.theme.subText};
  margin-top: ${space(0.5)};
`;

const FilesChangedHeader = styled('div')`
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
`;

const FilesTable = styled('table')`
  width: 100%;
  border-collapse: collapse;
`;

const TableHeader = styled('thead')`
  background-color: ${p => p.theme.backgroundSecondary};
`;

const HeaderCell = styled('th')`
  padding: ${space(1)} ${space(2)};
  text-align: left;
  font-size: ${p => p.theme.fontSize.sm};
  font-weight: 600;
  color: ${p => p.theme.subText};
  border-bottom: 1px solid ${p => p.theme.border};
`;

const TableBody = styled('tbody')``;

const TableRow = styled('tr')`
  &:hover {
    background-color: ${p => p.theme.backgroundSecondary};
  }
`;

const TableCell = styled('td')`
  padding: ${space(1)} ${space(2)};
  font-size: ${p => p.theme.fontSize.sm};
  border-bottom: 1px solid ${p => p.theme.innerBorder};
`;

const ChangeCell = styled(TableCell)``;

const ChangeTag = styled('span')<{changeType: string}>`
  padding: ${space(0.25)} ${space(0.75)};
  border-radius: 3px;
  font-size: ${p => p.theme.fontSize.xs};
  font-weight: 600;
  background-color: ${p => {
    switch (p.changeType) {
      case 'Modified':
        return p.theme.yellow100;
      case 'Added':
        return p.theme.green100;
      case 'Removed':
        return p.theme.red100;
      default:
        return p.theme.gray100;
    }
  }};
  color: ${p => {
    switch (p.changeType) {
      case 'Modified':
        return p.theme.yellow400;
      case 'Added':
        return p.theme.green400;
      case 'Removed':
        return p.theme.red400;
      default:
        return p.theme.gray400;
    }
  }};
`;

const FilePathCell = styled(TableCell)`
  max-width: 400px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const TypeCell = styled(TableCell)``;

const SizeCell = styled(TableCell)`
  text-align: right;
`;

const SizeDiffCell = styled(TableCell)`
  text-align: right;
  color: ${p => p.theme.red300};
`;
