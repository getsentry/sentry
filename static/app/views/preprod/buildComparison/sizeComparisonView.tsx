import {Fragment, useMemo} from 'react';
import styled from '@emotion/styled';

import {Alert} from 'sentry/components/core/alert';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import {IconChevron, IconDownload, IconInfo} from 'sentry/icons';
import {space} from 'sentry/styles/space';
import {formatBytesBase10} from 'sentry/utils/bytes/formatBytesBase10';
import {useApiQuery} from 'sentry/utils/queryClient';
import type {UseApiQueryResult} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import useOrganization from 'sentry/utils/useOrganization';
import {
  MetricsArtifactType,
  SizeAnalysisComparisonState,
  type SizeComparisonResponse,
} from 'sentry/views/preprod/buildComparison/buildComparison';

// API response interfaces for the comparison download endpoint
interface DiffItem {
  base_size: number | null;
  head_size: number | null;
  path: string;
  size_diff: number;
  type: 'added' | 'removed' | 'increased' | 'decreased' | 'unchanged';
}

interface SizeMetricDiffItem {
  base_download_size: number;
  base_install_size: number;
  head_download_size: number;
  head_install_size: number;
  identifier: string | null;
  metrics_artifact_type: string;
}

interface ComparisonResults {
  diff_items: DiffItem[];
  size_metric_diff_item: SizeMetricDiffItem;
}

interface SizeComparisonViewProps {
  baseArtifactId: string;
  sizeComparisonQuery: UseApiQueryResult<SizeComparisonResponse, RequestError>;
}

interface FileChange {
  change: 'Modified' | 'Added' | 'Removed';
  filePath: string;
  size: string;
  sizeDiff: string;
  type: string;
}

const formatPercentage = (value: number, total: number): number => {
  if (total === 0) return 0;
  return Math.round((value / total) * 100);
};

export function SizeComparisonView({
  sizeComparisonQuery,
  baseArtifactId, // TODO
}: SizeComparisonViewProps) {
  const organization = useOrganization();

  const successfulComparison = sizeComparisonQuery.data?.comparisons.find(
    comp =>
      comp.state === SizeAnalysisComparisonState.SUCCESS &&
      // TODO: Allow user to select artifact type
      comp.metrics_artifact_type === MetricsArtifactType.MAIN_ARTIFACT
  );

  // Query the comparison download endpoint to get detailed data
  const comparisonDataQuery = useApiQuery<ComparisonResults>(
    [
      `/projects/${organization.slug}/${baseArtifactId}/preprodartifacts/size-analysis/compare/${successfulComparison?.head_size_metric_id}/${successfulComparison?.base_size_metric_id}/download/`,
    ],
    {
      staleTime: 0,
      enabled:
        !!successfulComparison?.head_size_metric_id &&
        !!successfulComparison?.base_size_metric_id &&
        !!organization.slug &&
        !!baseArtifactId,
    }
  );

  // Process the comparison data
  const processedData = useMemo(() => {
    if (!comparisonDataQuery.data) {
      return null;
    }

    const {diff_items, size_metric_diff_item} = comparisonDataQuery.data;

    // Calculate summary data
    const installSizeDiff =
      size_metric_diff_item.head_install_size - size_metric_diff_item.base_install_size;
    const downloadSizeDiff =
      size_metric_diff_item.head_download_size - size_metric_diff_item.base_download_size;
    const installSizePercentage = formatPercentage(
      installSizeDiff,
      size_metric_diff_item.base_install_size
    );
    const downloadSizePercentage = formatPercentage(
      downloadSizeDiff,
      size_metric_diff_item.base_download_size
    );

    // Process file changes
    const fileChanges: FileChange[] = diff_items
      .filter(item => item.size_diff !== 0)
      .sort((a, b) => {
        // Sort by absolute size difference (largest first)
        const aSize = Math.abs(a.size_diff);
        const bSize = Math.abs(b.size_diff);
        return bSize - aSize;
      })
      .map(item => {
        let changeType: 'Added' | 'Removed' | 'Modified';
        if (item.type === 'added') {
          changeType = 'Added';
        } else if (item.type === 'removed') {
          changeType = 'Removed';
        } else {
          changeType = 'Modified';
        }

        return {
          change: changeType,
          filePath: item.path,
          size: item.head_size ? formatBytesBase10(item.head_size) : '0 B',
          sizeDiff: `${item.size_diff > 0 ? '+' : ''}${formatBytesBase10(item.size_diff)}`,
          type: 'File', // We could derive this from the file extension if needed
        };
      });

    // Calculate metrics
    const metrics = [
      {
        title: 'Install Size',
        value: formatBytesBase10(size_metric_diff_item.head_install_size),
        change: `${installSizeDiff > 0 ? '+' : ''}${formatBytesBase10(installSizeDiff)} (${installSizePercentage}% ${installSizeDiff > 0 ? 'larger' : 'smaller'})`,
        comparison: formatBytesBase10(size_metric_diff_item.base_install_size),
        icon: IconInfo,
      },
      {
        title: 'Download Size',
        value: formatBytesBase10(size_metric_diff_item.head_download_size),
        change: `${downloadSizeDiff > 0 ? '+' : ''}${formatBytesBase10(downloadSizeDiff)} (${downloadSizePercentage}% ${downloadSizeDiff > 0 ? 'larger' : 'smaller'})`,
        comparison: formatBytesBase10(size_metric_diff_item.base_download_size),
        icon: IconDownload,
      },
      {
        title: 'Largest file change',
        value: fileChanges.length > 0 ? fileChanges[0]?.sizeDiff || '0 B' : '0 B',
        change:
          fileChanges.length > 0
            ? `${fileChanges[0]?.change || 'Modified'}: ${fileChanges[0]?.filePath?.split('/').pop() || 'Unknown'}`
            : 'No changes',
        comparison: fileChanges.length > 0 ? fileChanges[0]?.size || '' : '',
        icon: IconChevron,
      },
    ];

    return {
      metrics,
      fileChanges,
    };
  }, [comparisonDataQuery.data]);

  if (sizeComparisonQuery.isLoading || comparisonDataQuery.isLoading) {
    return <LoadingIndicator />;
  }

  if (sizeComparisonQuery.isError || !sizeComparisonQuery.data) {
    return (
      <Alert type="error">
        {sizeComparisonQuery.error?.message || 'Failed to load size comparison data'}
      </Alert>
    );
  }

  if (comparisonDataQuery.isError || !processedData) {
    return (
      <Alert type="error">
        {comparisonDataQuery.error?.message || 'Failed to load detailed comparison data'}
      </Alert>
    );
  }

  const {metrics, fileChanges} = processedData;

  return (
    <Fragment>
      {/* TODO: Build compare details */}

      {/* Metrics Grid */}
      <MetricsGrid>
        {metrics.map((metric, index) => (
          <MetricCard key={index}>
            <MetricHeader>
              <metric.icon size="sm" />
              <MetricTitle>{metric.title}</MetricTitle>
            </MetricHeader>
            <MetricValue isPositive={metric.change.includes('-')}>
              {metric.value}
            </MetricValue>
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
            <span>Files Changed: {fileChanges.length}</span>
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
              {fileChanges.map((file, index) => (
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
