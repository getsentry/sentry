import type {ReactNode} from 'react';
import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Flex} from '@sentry/scraps/layout';

import {Text} from 'sentry/components/core/text';
import {Tooltip} from 'sentry/components/core/tooltip';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {IconQuestion} from 'sentry/icons';
import type {BuildDetailsApiResponse} from 'sentry/views/preprod/types/buildDetailsTypes';
import {
  formattedPrimaryMetricDownloadSize,
  formattedPrimaryMetricInstallSize,
  type Labels,
} from 'sentry/views/preprod/utils/labelUtils';

import {
  FullRowLink,
  PreprodBuildsCreatedHeaderCell,
  PreprodBuildsCreatedRowCell,
  PreprodBuildsHeaderCells,
  PreprodBuildsRowCells,
} from './preprodBuildsTableCommon';

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
    const linkUrl = `/organizations/${organizationSlug}/preprod/${build.project_id}/${build.id}`;
    return (
      <SimpleTable.Row key={build.id}>
        <FullRowLink to={linkUrl} onClick={() => onRowClick?.(build)}>
          <Fragment>
            <PreprodBuildsRowCells
              build={build}
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
          </Fragment>
        </FullRowLink>
      </SimpleTable.Row>
    );
  });

  return (
    <BuildsSizeTable showProjectColumn={showProjectColumn}>
      <SimpleTable.Header>
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
      </SimpleTable.Header>
      {content ?? rows}
    </BuildsSizeTable>
  );
}

const sizeTableColumns = {
  withProject: `minmax(250px, 2fr) minmax(120px, 1fr) minmax(250px, 2fr)
    minmax(100px, 1fr) minmax(100px, 1fr) minmax(80px, 120px)`,
  withoutProject: `minmax(250px, 2fr) minmax(250px, 2fr) minmax(100px, 1fr)
    minmax(100px, 1fr) minmax(80px, 120px)`,
};

const BuildsSizeTable = styled(SimpleTable)<{showProjectColumn?: boolean}>`
  overflow-x: auto;
  overflow-y: auto;
  grid-template-columns: ${p =>
    p.showProjectColumn ? sizeTableColumns.withProject : sizeTableColumns.withoutProject};
`;
