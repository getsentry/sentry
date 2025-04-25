import {Fragment, useCallback, useMemo} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {Tooltip} from 'sentry/components/core/tooltip';
import Count from 'sentry/components/count';
import GlobalSelectionLink from 'sentry/components/globalSelectionLink';
import type {GridColumnHeader, GridColumnOrder} from 'sentry/components/gridEditable';
import GridEditable from 'sentry/components/gridEditable';
import useQueryBasedSorting from 'sentry/components/gridEditable/useQueryBasedSorting';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import Link from 'sentry/components/links/link';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import Pagination from 'sentry/components/pagination';
import renderSortableHeaderCell from 'sentry/components/replays/renderSortableHeaderCell';
import TextOverflow from 'sentry/components/textOverflow';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {PageFilters} from 'sentry/types/core';
import type {Release, ReleaseProject} from 'sentry/types/release';
import type {EventsMetaType} from 'sentry/utils/discover/eventView';
import {getFieldRenderer} from 'sentry/utils/discover/fieldRenderers';
import {useApiQuery} from 'sentry/utils/queryClient';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import {formatVersion} from 'sentry/utils/versions/formatVersion';
import {
  cleanReleaseCursors,
  ReleasesDrawerFields,
} from 'sentry/views/releases/drawer/utils';
import {getReleaseNewIssuesUrl} from 'sentry/views/releases/utils';

type ReleaseHealthItem = {
  date: string;
  error_count: number;
  project: ReleaseProject;
  project_id: number;
  release: string;
};

interface Props extends PageFilters {
  onMouseOutRelease: (release: string) => void;
  onMouseOverRelease: (release: string) => void;
}

type ReleaseHealthGridItem = Pick<ReleaseHealthItem, 'date' | 'release' | 'error_count'>;
type Column = GridColumnHeader<keyof ReleaseHealthGridItem>;

const BASE_COLUMNS: Array<GridColumnOrder<keyof ReleaseHealthGridItem>> = [
  {key: 'release', name: 'release', width: 320},
  {key: 'error_count', name: 'new issues', width: 110},
  {key: 'date', name: 'created', width: 200},
];

/**
 * This is copied/modified of
 * `views/insights/sessions/components/tables/releaseHealthTable`, we
 * can't re-use because this will eventually be a bit different,
 * especially with the in-drawer navigation.
 */
export function ReleaseDrawerTable({
  datetime,
  environments,
  projects,
  onMouseOverRelease,
  onMouseOutRelease,
}: Props) {
  const theme = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const organization = useOrganization();
  const {data, isLoading, isError, getResponseHeader} = useApiQuery<Release[]>(
    [
      `/organizations/${organization.slug}/releases/`,
      {
        query: {
          project: projects,
          environment: environments,
          cursor: location.query[ReleasesDrawerFields.LIST_CURSOR],
          ...normalizeDateTimeParams(datetime),
          per_page: 15,
        },
      },
    ],
    {staleTime: 0}
  );
  const pageLinks = getResponseHeader?.('Link');

  const releaseData = data?.map(d => ({
    project: d.projects[0]!,
    release: d.version,
    date: d.dateCreated,
    error_count: d.projects[0]?.newGroups ?? 0,
    project_id: d.projects[0]?.id ?? 0,
  }));

  const {currentSort, makeSortLinkGenerator} = useQueryBasedSorting({
    defaultSort: {field: 'date', kind: 'desc'},
    location,
  });

  const renderHeadCell = useMemo(
    () =>
      renderSortableHeaderCell({
        currentSort,
        makeSortLinkGenerator,
        onClick: () => {},
        rightAlignedColumns: [],
        sortableColumns: [],
      }),
    [currentSort, makeSortLinkGenerator]
  );

  const renderBodyCell = useCallback(
    (column: Column, dataRow: ReleaseHealthItem) => {
      const meta: EventsMetaType = {
        fields: {
          release: 'string',
          date: 'date',
          error_count: 'integer',
        },
        units: {},
      };

      if (column.key === 'release') {
        const value = dataRow[column.key];
        // Custom release renderer -- we want to keep navigation within drawer
        return (
          <ReleaseLink
            onMouseOver={() => {
              onMouseOverRelease(dataRow.release);
            }}
            onMouseOut={() => {
              onMouseOutRelease(dataRow.release);
            }}
            to={{
              query: {
                ...cleanReleaseCursors(location.query),
                [ReleasesDrawerFields.RELEASE]: value,
                [ReleasesDrawerFields.RELEASE_PROJECT_ID]: dataRow.project_id,
              },
            }}
          >
            <ProjectBadge project={dataRow.project} disableLink hideName />
            <TextOverflow>{formatVersion(value)}</TextOverflow>
          </ReleaseLink>
        );
      }

      if (column.key === 'error_count') {
        const value = dataRow[column.key];
        return value > 0 ? (
          <Tooltip title={t('Open in Issues')} position="auto-start">
            <GlobalSelectionLink
              to={getReleaseNewIssuesUrl(
                organization.slug,
                dataRow.project_id,
                dataRow.release
              )}
            >
              <Count value={value} />
            </GlobalSelectionLink>
          </Tooltip>
        ) : (
          <Count value={value} />
        );
      }
      if (!meta?.fields) {
        return dataRow[column.key];
      }

      const renderer = getFieldRenderer(column.key, meta.fields, false);

      return (
        <CellWrapper>
          {renderer(dataRow, {
            location,
            organization,
            unit: meta.units[column.key],
            theme,
          })}
        </CellWrapper>
      );
    },
    [organization, location, onMouseOutRelease, onMouseOverRelease, theme]
  );

  const tableEmptyMessage = (
    <MessageContainer>
      <Title>{t('No releases')}</Title>
      <Subtitle>{t('There are no releases within this timeframe')}</Subtitle>
    </MessageContainer>
  );

  return (
    <Fragment>
      <GridEditable
        error={isError}
        isLoading={isLoading}
        data={releaseData ?? []}
        columnOrder={BASE_COLUMNS}
        emptyMessage={tableEmptyMessage}
        columnSortBy={[]}
        stickyHeader
        grid={{
          renderHeadCell,
          renderBodyCell,
        }}
      />
      <PaginationNoMargin
        pageLinks={pageLinks}
        onCursor={(cursor, path, searchQuery) => {
          navigate({
            pathname: path,
            query: {...searchQuery, [ReleasesDrawerFields.LIST_CURSOR]: cursor},
          });
        }}
      />
    </Fragment>
  );
}

const Subtitle = styled('div')`
  font-size: ${p => p.theme.fontSizeMedium};
`;

const Title = styled('div')`
  font-size: 24px;
`;

const MessageContainer = styled('div')`
  display: grid;
  grid-auto-flow: row;
  gap: ${space(1)};
  justify-items: center;
  text-align: center;
  padding: ${space(4)};
`;

const CellWrapper = styled('div')`
  & div {
    text-align: left;
  }
`;
const PaginationNoMargin = styled(Pagination)`
  margin: 0;
`;

const ReleaseLink = styled(Link)`
  display: flex;
  align-items: center;
  gap: ${space(1)};
`;
