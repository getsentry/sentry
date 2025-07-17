import styled from '@emotion/styled';

import {ActivityAvatar} from 'sentry/components/activity/item/avatar';
import {UserAvatar} from 'sentry/components/core/avatar/userAvatar';
import {Tooltip} from 'sentry/components/core/tooltip';
import type {CursorHandler} from 'sentry/components/pagination';
import Pagination from 'sentry/components/pagination';
import {SavedEntityTable} from 'sentry/components/savedEntityTable';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import type {DashboardListItem} from 'sentry/views/dashboards/types';

export interface DashboardTableProps {
  cursorKey: string;
  dashboards: DashboardListItem[];
  isLoading: boolean;
  title: string;
  pageLinks?: string;
}

export function DashboardTable({
  dashboards,
  isLoading,
  title,
  pageLinks,
  cursorKey,
}: DashboardTableProps) {
  const organization = useOrganization();
  const navigate = useNavigate();

  const handleCursor: CursorHandler = (_cursor, pathname, query) => {
    navigate({
      pathname,
      query: {...query, [cursorKey]: _cursor},
    });
  };

  return (
    <Container>
      <TableHeading>{title}</TableHeading>
      <SavedEntityTableWithColumns
        isLoading={isLoading}
        isError={false}
        header={
          <SavedEntityTable.Header>
            <SavedEntityTable.HeaderCell data-column="star" />
            <SavedEntityTable.HeaderCell data-column="name">
              {t('Name')}
            </SavedEntityTable.HeaderCell>
            <SavedEntityTable.HeaderCell data-column="project">
              {t('Project')}
            </SavedEntityTable.HeaderCell>
            <SavedEntityTable.HeaderCell data-column="envs">
              {t('Envs')}
            </SavedEntityTable.HeaderCell>
            <SavedEntityTable.HeaderCell data-column="filter">
              {t('Filter')}
            </SavedEntityTable.HeaderCell>
            <SavedEntityTable.HeaderCell data-column="num-widgets">
              {t('Widgets')}
            </SavedEntityTable.HeaderCell>
            <SavedEntityTable.HeaderCell data-column="created-by">
              {t('Creator')}
            </SavedEntityTable.HeaderCell>
            <SavedEntityTable.HeaderCell data-column="last-viewed">
              {t('Last Viewed')}
            </SavedEntityTable.HeaderCell>
            <SavedEntityTable.HeaderCell data-column="created" noBorder>
              {t('Date Created')}
            </SavedEntityTable.HeaderCell>
            <SavedEntityTable.HeaderCell data-column="actions" />
          </SavedEntityTable.Header>
        }
        isEmpty={dashboards.length === 0}
        // TODO: DAIN-715 Update empty message
        emptyMessage={t('No dashboards found')}
      >
        {dashboards.map((dashboard, index) => (
          <SavedEntityTable.Row
            key={dashboard.id}
            isFirst={index === 0}
            data-test-id={`table-row-${index}`}
          >
            <SavedEntityTable.Cell hasButton data-column="star">
              <SavedEntityTable.CellStar
                isStarred={dashboard.isFavorited ?? false}
                // TODO: DAIN-718 Add star functionality
                onClick={() => {}}
              />
            </SavedEntityTable.Cell>
            <SavedEntityTable.Cell data-column="name">
              <SavedEntityTable.CellName
                to={`/organizations/${organization.slug}/dashboards/${dashboard.id}`}
              >
                {dashboard.title}
              </SavedEntityTable.CellName>
            </SavedEntityTable.Cell>
            <SavedEntityTable.Cell data-column="project">
              <SavedEntityTable.CellProjects projects={dashboard.projects} />
            </SavedEntityTable.Cell>
            <SavedEntityTable.Cell data-column="envs">
              {/* TODO: DAIN-712 Add environments after they are exposed in the API */}
              <SavedEntityTable.CellEnvironments environments={[]} />
            </SavedEntityTable.Cell>
            {/* TODO: DAIN-716 Add release filter as tokens */}
            <SavedEntityTable.Cell data-column="filter">{'\u2014'}</SavedEntityTable.Cell>
            <SavedEntityTable.Cell data-column="num-widgets">
              {dashboard.widgetPreview.length}
            </SavedEntityTable.Cell>
            <SavedEntityTable.Cell data-column="created-by">
              {dashboard.createdBy === null ? (
                <Tooltip title={'Sentry'}>
                  <ActivityAvatar type="system" size={20} />
                </Tooltip>
              ) : dashboard.createdBy ? (
                <UserAvatar user={dashboard.createdBy} hasTooltip />
              ) : null}
            </SavedEntityTable.Cell>
            <SavedEntityTable.Cell data-column="last-viewed">
              <SavedEntityTable.CellTimeSince date={null} />
              {/* TODO: DAIN-713 Add last viewed after it is exposed in the API */}
            </SavedEntityTable.Cell>
            <SavedEntityTable.Cell data-column="created">
              <SavedEntityTable.CellTimeSince date={dashboard.dateCreated ?? null} />
            </SavedEntityTable.Cell>
            <SavedEntityTable.Cell data-column="actions" hasButton>
              <SavedEntityTable.CellActions
                // TODO: DAIN-717 Add action handlers
                items={[
                  ...(dashboard.createdBy === null
                    ? []
                    : [
                        {
                          key: 'rename',
                          label: t('Rename'),
                          onAction: () => {},
                        },
                      ]),
                  {
                    key: 'duplicate',
                    label: t('Duplicate'),
                    onAction: () => {},
                  },
                  ...(dashboard.createdBy === null
                    ? []
                    : [
                        {
                          key: 'delete',
                          label: t('Delete'),
                          priority: 'danger' as const,
                          onAction: () => {},
                        },
                      ]),
                ]}
              />
            </SavedEntityTable.Cell>
          </SavedEntityTable.Row>
        ))}
      </SavedEntityTableWithColumns>
      <Pagination pageLinks={pageLinks} onCursor={handleCursor} />
    </Container>
  );
}

const Container = styled('div')`
  container-type: inline-size;
`;

// TODO: DAIN-719 Update the widths to be consistent with mockup
const SavedEntityTableWithColumns = styled(SavedEntityTable)`
  grid-template-areas: 'star name project envs filter num-widgets created-by last-viewed created actions';
  grid-template-columns:
    40px 20% minmax(auto, 120px) minmax(auto, 120px) minmax(auto, 120px)
    minmax(auto, 120px) auto auto auto 48px;
`;

const TableHeading = styled('h2')`
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: ${p => p.theme.fontSize.xl};
  margin-top: ${space(3)};
  margin-bottom: ${space(1.5)};
`;
