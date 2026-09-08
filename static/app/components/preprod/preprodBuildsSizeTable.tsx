import type {ReactNode} from 'react';

import {Flex} from '@sentry/scraps/layout';
import type {TableColumnConfig} from '@sentry/scraps/table';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {IconQuestion} from 'sentry/icons';
import type {BuildDetailsApiResponse} from 'sentry/views/preprod/types/buildDetailsTypes';
import {getSizeBuildPath} from 'sentry/views/preprod/utils/buildLinkUtils';
import {
  formattedPrimaryMetricDownloadSize,
  formattedPrimaryMetricInstallSize,
  type Labels,
} from 'sentry/views/preprod/utils/labelUtils';

import {
  PreprodBuildsCreatedHeaderCell,
  PreprodBuildsCreatedRowCell,
  PreprodBuildsHeaderCells,
  PreprodBuildsRowCells,
} from './preprodBuildsTableCommon';
import {BuildsTableGrid, buildsTableColumns} from './preprodBuildsTableStyles';

interface PreprodBuildsSizeTableProps {
  builds: BuildDetailsApiResponse[];
  labels: Labels;
  organizationSlug: string;
  showProjectColumn: boolean;
  content?: ReactNode;
  onRowClick?: (build: BuildDetailsApiResponse) => void;
}

export function PreprodBuildsSizeTable({
  builds,
  content,
  labels,
  onRowClick,
  organizationSlug,
  showProjectColumn,
}: PreprodBuildsSizeTableProps) {
  const rows = builds.map(build => {
    const linkUrl =
      getSizeBuildPath({
        organizationSlug,
        baseArtifactId: build.id,
      }) ?? '';
    return (
      <SimpleTable.Row key={build.id}>
        <PreprodBuildsRowCells
          build={build}
          rowLink={{to: linkUrl, onClick: () => onRowClick?.(build)}}
          showInteraction
          showProjectColumn={showProjectColumn}
        />
        <SimpleTable.RowCell>
          <Text>{formattedPrimaryMetricInstallSize(build.size_info)}</Text>
        </SimpleTable.RowCell>
        <SimpleTable.RowCell>
          <Text>{formattedPrimaryMetricDownloadSize(build.size_info)}</Text>
        </SimpleTable.RowCell>
        <PreprodBuildsCreatedRowCell build={build} />
      </SimpleTable.Row>
    );
  });

  return (
    <BuildsTableGrid
      columns={buildsTableColumns(sizeTableColumns, showProjectColumn)}
      header={
        <SimpleTable.HeaderRow>
          <PreprodBuildsHeaderCells showProjectColumn={showProjectColumn} />
          <SimpleTable.HeaderCell>
            {labels.installSizeLabelTooltip ? (
              <Tooltip title={labels.installSizeLabelTooltip}>
                <Flex align="center" gap="xs">
                  <Text as="span" variant="muted">
                    {labels.installSizeLabel}
                  </Text>
                  <IconQuestion size="xs" variant="muted" />
                </Flex>
              </Tooltip>
            ) : (
              labels.installSizeLabel
            )}
          </SimpleTable.HeaderCell>
          <SimpleTable.HeaderCell>{labels.downloadSizeLabel}</SimpleTable.HeaderCell>
          <PreprodBuildsCreatedHeaderCell />
        </SimpleTable.HeaderRow>
      }
    >
      {content ?? rows}
    </BuildsTableGrid>
  );
}

const sizeTableColumns: TableColumnConfig[] = [
  {key: 'app', width: 'minmax(250px, 2fr)'},
  {key: 'project', width: 'minmax(120px, 1fr)'},
  {key: 'build', width: 'minmax(250px, 2fr)'},
  {key: 'installSize', width: 'minmax(100px, 1fr)'},
  {key: 'downloadSize', width: 'minmax(100px, 1fr)'},
  {key: 'created', width: 'minmax(80px, 120px)'},
];
