import {useEffect, useRef} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {PlatformIcon} from 'platformicons';

import {Flex} from 'sentry/components/core/layout';
import TextOverflow from 'sentry/components/textOverflow';
import TimeSince from 'sentry/components/timeSince';
import {IconCheckmark, IconCommit} from 'sentry/icons';
import {t} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';
import type {
  TabularColumn,
  TabularData,
  TabularMeta,
} from 'sentry/views/dashboards/widgets/common/types';
import {
  TableWidgetVisualization,
  type FieldRenderer,
} from 'sentry/views/dashboards/widgets/tableWidget/tableWidgetVisualization';
import type {BuildDetailsApiResponse} from 'sentry/views/preprod/types/buildDetailsTypes';
import type {Platform} from 'sentry/views/preprod/types/sharedTypes';
import {
  formattedDownloadSize,
  formattedInstallSize,
  getPlatformIconFromPlatform,
} from 'sentry/views/preprod/utils/labelUtils';

const COLUMNS: TabularColumn[] = [
  {key: 'app', sortable: false, width: 320},
  {key: 'build', sortable: false, width: 320},
  {key: 'install_size', sortable: false, width: 140},
  {key: 'download_size', sortable: false, width: 140},
  {key: 'created', sortable: false, width: 160},
];

const ALIASES: Record<string, string> = {
  app: 'APP',
  build: 'BUILD',
  install_size: 'INSTALL SIZE',
  download_size: 'DOWNLOAD SIZE',
  created: 'CREATED',
};

interface BuildTableProps {
  builds: BuildDetailsApiResponse[];
  projectId: string;
  isLoading?: boolean;
}

export function BuildTable({builds, projectId, isLoading}: BuildTableProps) {
  const organization = useOrganization();
  const tableRef = useRef<HTMLDivElement>(null);

  // Transform builds data for table
  const transformedBuilds = builds.map((build: BuildDetailsApiResponse) => ({
    id: build.id,
    app_name: build.app_info?.name || 'Unknown App',
    app_id: build.app_info?.app_id || 'Unknown ID',
    platform: build.app_info?.platform || '',
    version: build.app_info?.version || 'Unknown',
    build_number: build.app_info?.build_number || 'Unknown',
    build_state: build.state,
    commit_sha: build.vcs_info?.head_sha || 'N/A',
    commit_ref: build.vcs_info?.head_ref || 'main',
    install_size: formattedInstallSize(build),
    download_size: formattedDownloadSize(build),
    date_added: build.app_info?.date_added || null,
    build_id: build.id, // Keep reference to original build ID for navigation
  }));

  const tableData: TabularData = {
    data: transformedBuilds,
    meta: {
      fields: {
        app: 'string',
        build: 'string',
        install_size: 'string',
        download_size: 'string',
        created: 'date',
      },
      units: {},
    } as TabularMeta,
  };

  // Add click handlers to table rows
  useEffect(() => {
    const tableElement = tableRef.current;
    if (!tableElement) {
      return undefined;
    }

    const handleRowClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const row = target.closest('tbody tr');
      if (!row) return;

      const rowIndex = Array.from(row.parentElement?.children || []).indexOf(row);
      if (rowIndex >= 0 && rowIndex < transformedBuilds.length) {
        const build = transformedBuilds[rowIndex];
        if (build?.build_id) {
          window.location.href = `/organizations/${organization.slug}/preprod/${projectId}/${build.build_id}`;
        }
      }
    };

    tableElement.addEventListener('click', handleRowClick);
    return () => {
      tableElement.removeEventListener('click', handleRowClick);
    };
  }, [transformedBuilds, organization.slug, projectId]);

  if (isLoading) {
    return (
      <TableWrapper>
        <TableWidgetVisualization.LoadingPlaceholder
          columns={COLUMNS}
          aliases={ALIASES}
        />
      </TableWrapper>
    );
  }

  if (builds.length === 0) {
    return <div>{t('No builds found')}</div>;
  }

  return (
    <TableWrapper>
      <ClickableTableWrapper ref={tableRef}>
        <TableWidgetVisualization
          tableData={tableData}
          columns={COLUMNS}
          aliases={ALIASES}
          getRenderer={(field, data, meta) => getRenderer(field, data, meta, projectId)}
          scrollable
          fit="max-content"
          allowedCellActions={[]}
          resizable={false}
        />
      </ClickableTableWrapper>
    </TableWrapper>
  );
}

// Custom field renderers
const createAppRenderer = (projectId: string): FieldRenderer =>
  function appRenderer(data, baggage) {
    const appName = data.app_name as string;
    const appId = data.app_id as string;
    const platform = data.platform as string;

    return (
      <Flex direction="column" gap="xs">
        <Flex align="center" gap="sm">
          {platform && (
            <PlatformIcon platform={getPlatformIconFromPlatform(platform as Platform)} />
          )}
          <AppName>
            <TextOverflow>{appName}</TextOverflow>
          </AppName>
        </Flex>
        <AppDetails>
          <TextOverflow>{appId}</TextOverflow>
        </AppDetails>
      </Flex>
    );
  };

const createBuildRenderer = (projectId: string): FieldRenderer =>
  function buildRenderer(data, baggage) {
    const version = data.version as string;
    const buildNumber = data.build_number as string;
    const buildState = data.build_state as number;
    const commitSha = data.commit_sha as string;
    const commitRef = data.commit_ref as string;

    return (
      <Flex direction="column" gap="xs">
        <Flex align="center" gap="xs">
          <VersionText>
            <TextOverflow>
              {version} ({buildNumber})
            </TextOverflow>
          </VersionText>
          {buildState === 3 && <IconCheckmark size="sm" color="green300" />}
        </Flex>
        <BuildDetails>
          <IconCommit size="xs" />
          <span>#{commitSha.slice(0, 7)}</span>
          <span>-</span>
          <TextOverflow>{commitRef}</TextOverflow>
        </BuildDetails>
      </Flex>
    );
  };

const installSizeRenderer: FieldRenderer = data => {
  const installSize = data.install_size as string;
  return <span>{installSize}</span>;
};

const downloadSizeRenderer: FieldRenderer = data => {
  const downloadSize = data.download_size as string;
  return <span>{downloadSize}</span>;
};

const createdRenderer: FieldRenderer = data => {
  const dateAdded = data.date_added as string | null;
  return (
    <DateContainer>
      {dateAdded ? <TimeSince date={dateAdded} unitStyle="short" /> : <span>-</span>}
    </DateContainer>
  );
};

const getRenderer = (
  field: string,
  _data: any,
  _meta: any,
  projectId: string
): FieldRenderer => {
  switch (field) {
    case 'app':
      return createAppRenderer(projectId);
    case 'build':
      return createBuildRenderer(projectId);
    case 'install_size':
      return installSizeRenderer;
    case 'download_size':
      return downloadSizeRenderer;
    case 'created':
      return createdRenderer;
    default:
      return () => null;
  }
};

const TableWrapper = styled('div')`
  margin-top: ${p => p.theme.space.sm};
`;

const ClickableTableWrapper = styled('div')`
  /* Make entire rows clickable */
  tbody tr {
    cursor: pointer;

    &:hover {
      background-color: ${p => p.theme.backgroundSecondary};
    }
  }
`;

const AppName = styled('div')`
  font-weight: ${p => p.theme.fontWeight.bold};
  font-size: ${p => p.theme.fontSize.lg};
`;

const AppDetails = styled('div')`
  font-size: ${p => p.theme.fontSize.sm};
  color: ${p => p.theme.subText};
`;

const VersionText = styled('div')`
  font-weight: ${p => p.theme.fontWeight.bold};
  font-size: ${p => p.theme.fontSize.lg};
`;

const BuildDetails = styled('div')`
  display: flex;
  align-items: center;
  gap: ${p => p.theme.space.xs};
  font-size: ${p => p.theme.fontSize.sm};
  color: ${p => p.theme.subText};
`;

const DateContainer = styled('div')`
  display: inline-block;
  width: fit-content;
`;
