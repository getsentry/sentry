import type {ReactNode} from 'react';
import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Text} from 'sentry/components/core/text';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {t} from 'sentry/locale';
import {formatNumberWithDynamicDecimalPoints} from 'sentry/utils/number/formatNumberWithDynamicDecimalPoints';
import type {BuildDetailsApiResponse} from 'sentry/views/preprod/types/buildDetailsTypes';

import {
  FullRowLink,
  PreprodBuildsCreatedHeaderCell,
  PreprodBuildsCreatedRowCell,
  PreprodBuildsHeaderCells,
  PreprodBuildsRowCells,
} from './preprodBuildsTableCommon';

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
    const linkUrl = `/organizations/${organizationSlug}/preprod/${build.project_id}/${build.id}/install/`;
    const isInstallable = build.distribution_info?.is_installable ?? false;
    const isRowDisabled = !isInstallable;
    const downloadCount = build.distribution_info?.download_count ?? 0;
    const rowContent = (
      <Fragment>
        <PreprodBuildsRowCells
          build={build}
          showInteraction={!isRowDisabled}
          showInstallabilityIndicator
          showProjectColumn={showProjectColumn}
        />
        <SimpleTable.RowCell>
          <Text>{formatNumberWithDynamicDecimalPoints(downloadCount, 0)}</Text>
        </SimpleTable.RowCell>
        <PreprodBuildsCreatedRowCell build={build} />
      </Fragment>
    );

    const RowComponent = isRowDisabled ? DisabledRow : SimpleTable.Row;

    return (
      <RowComponent key={build.id} variant={isRowDisabled ? 'faded' : 'default'}>
        {isRowDisabled ? (
          rowContent
        ) : (
          <FullRowLink to={linkUrl} onClick={() => onRowClick?.(build)}>
            {rowContent}
          </FullRowLink>
        )}
      </RowComponent>
    );
  });

  return (
    <BuildsDistributionTable showProjectColumn={showProjectColumn}>
      <SimpleTable.Header>
        <PreprodBuildsHeaderCells showProjectColumn={showProjectColumn} />
        <SimpleTable.HeaderCell>{t('Download Count')}</SimpleTable.HeaderCell>
        <PreprodBuildsCreatedHeaderCell />
      </SimpleTable.Header>
      {content ?? rows}
    </BuildsDistributionTable>
  );
}

const distributionTableColumns = {
  withProject: `minmax(250px, 2fr) minmax(120px, 1fr) minmax(250px, 2fr)
    minmax(120px, 1fr) minmax(80px, 120px)`,
  withoutProject: `minmax(250px, 2fr) minmax(250px, 2fr) minmax(120px, 1fr)
    minmax(80px, 120px)`,
};

const BuildsDistributionTable = styled(SimpleTable)<{showProjectColumn?: boolean}>`
  overflow-x: auto;
  overflow-y: auto;
  grid-template-columns: ${p =>
    p.showProjectColumn
      ? distributionTableColumns.withProject
      : distributionTableColumns.withoutProject};
`;

const DisabledRow = styled(SimpleTable.Row)`
  [role='cell'] {
    color: ${p => p.theme.subText};
    cursor: not-allowed;
    opacity: 0.5;
  }
`;
