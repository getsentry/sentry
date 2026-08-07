import type {ReactNode} from 'react';
import styled from '@emotion/styled';

import {Text} from '@sentry/scraps/text';

import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {t} from 'sentry/locale';
import {formatNumberWithDynamicDecimalPoints} from 'sentry/utils/number/formatNumberWithDynamicDecimalPoints';
import type {BuildDetailsApiResponse} from 'sentry/views/preprod/types/buildDetailsTypes';
import {getInstallBuildPath} from 'sentry/views/preprod/utils/buildLinkUtils';

import {
  PreprodBuildsCreatedHeaderCell,
  PreprodBuildsCreatedRowCell,
  PreprodBuildsHeaderCells,
  PreprodBuildsRowCells,
} from './preprodBuildsTableCommon';
import {BuildsTableGrid} from './preprodBuildsTableStyles';

interface PreprodBuildsDistributionTableProps {
  builds: BuildDetailsApiResponse[];
  organizationSlug: string;
  showProjectColumn: boolean;
  content?: ReactNode;
  onRowClick?: (build: BuildDetailsApiResponse) => void;
}

export function PreprodBuildsDistributionTable({
  builds,
  content,
  onRowClick,
  organizationSlug,
  showProjectColumn,
}: PreprodBuildsDistributionTableProps) {
  const rows = builds.map(build => {
    const linkUrl =
      getInstallBuildPath({
        organizationSlug,
        baseArtifactId: build.id,
      }) ?? '';
    const isInstallable = build.distribution_info?.is_installable ?? false;
    const isRowDisabled = !isInstallable;
    const downloadCount = build.distribution_info?.download_count ?? 0;
    const RowComponent = isRowDisabled ? DisabledRow : SimpleTable.Row;

    return (
      <RowComponent key={build.id} variant={isRowDisabled ? 'faded' : 'default'}>
        <PreprodBuildsRowCells
          build={build}
          rowLink={
            isRowDisabled ? undefined : {to: linkUrl, onClick: () => onRowClick?.(build)}
          }
          showInteraction={!isRowDisabled}
          showInstallGroups
          showInstallabilityIndicator
          showProjectColumn={showProjectColumn}
        />
        <SimpleTable.RowCell>
          <Text>{formatNumberWithDynamicDecimalPoints(downloadCount, 0)}</Text>
        </SimpleTable.RowCell>
        <PreprodBuildsCreatedRowCell build={build} />
      </RowComponent>
    );
  });

  return (
    <BuildsTableGrid
      tracks={distributionTableColumns}
      showProjectColumn={showProjectColumn}
      header={
        <SimpleTable.HeaderRow>
          <PreprodBuildsHeaderCells showProjectColumn={showProjectColumn} />
          <SimpleTable.HeaderCell>{t('Download Count')}</SimpleTable.HeaderCell>
          <PreprodBuildsCreatedHeaderCell />
        </SimpleTable.HeaderRow>
      }
    >
      {content ?? rows}
    </BuildsTableGrid>
  );
}

const distributionTableColumns = {
  withProject: `minmax(250px, 2fr) minmax(120px, 1fr) minmax(250px, 2fr)
    minmax(120px, 1fr) minmax(80px, 120px)`,
  withoutProject: `minmax(250px, 2fr) minmax(250px, 2fr) minmax(120px, 1fr)
    minmax(80px, 120px)`,
};

const DisabledRow = styled(SimpleTable.Row)`
  [role='cell'] {
    color: ${p => p.theme.tokens.content.secondary};
    cursor: not-allowed;
    opacity: 0.5;
  }
`;
