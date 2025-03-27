import {css} from '@emotion/react';
import styled from '@emotion/styled';

import InteractionStateLayer from 'sentry/components/interactionStateLayer';
import Link from 'sentry/components/links/link';
import LoadingError from 'sentry/components/loadingError';
import {PanelTable} from 'sentry/components/panels/panelTable';
import {FormattedQuery} from 'sentry/components/searchQueryBuilder/formattedQuery';
import {getAbsoluteSummary} from 'sentry/components/timeRangeSelector/utils';
import TimeSince from 'sentry/components/timeSince';
import {Tooltip} from 'sentry/components/tooltip';
import {IconLock, IconStar, IconUser} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import type {GroupSearchView} from 'sentry/views/issueList/types';
import {getSortLabel} from 'sentry/views/issueList/utils';
import {ProjectsRenderer} from 'sentry/views/traces/fieldRenderers';

type IssueViewsTableProps = {
  isError: boolean;
  isPending: boolean;
  views: GroupSearchView[];
};

function StarCellContent({isStarred}: {isStarred: boolean}) {
  return <IconStar isSolid={isStarred} />;
}

function ProjectsCellContent({projects}: {projects: GroupSearchView['projects']}) {
  const {projects: allProjects} = useProjects();

  const projectSlugs = allProjects
    .filter(project => projects.includes(parseInt(project.id, 10)))
    .map(project => project.slug);

  if (projects.length === 0) {
    return t('My Projects');
  }
  if (projects.includes(-1)) {
    return t('All Projects');
  }
  return <ProjectsRenderer projectSlugs={projectSlugs} maxVisibleProjects={5} />;
}

function EnvironmentsCellContent({
  environments,
}: {
  environments: GroupSearchView['environments'];
}) {
  const environmentsLabel =
    environments.length === 0 ? t('All') : environments.join(', ');

  return (
    <PositionedContent>
      <Tooltip title={environmentsLabel}>{environmentsLabel}</Tooltip>
    </PositionedContent>
  );
}

function TimeCellContent({timeFilters}: {timeFilters: GroupSearchView['timeFilters']}) {
  if (timeFilters.period) {
    return timeFilters.period;
  }

  return getAbsoluteSummary(timeFilters.start, timeFilters.end, timeFilters.utc);
}

function SharingCellContent({visibility}: {visibility: GroupSearchView['visibility']}) {
  if (visibility === 'organization') {
    return (
      <Tooltip title={t('Shared with organziation')} skipWrapper>
        <PositionedContent>
          <IconUser />
        </PositionedContent>
      </Tooltip>
    );
  }
  return (
    <Tooltip title={t('Private')} skipWrapper>
      <PositionedContent>
        <IconLock locked />
      </PositionedContent>
    </Tooltip>
  );
}

function LastVisitedCellContent({
  lastVisited,
}: {
  lastVisited: GroupSearchView['lastVisited'];
}) {
  if (!lastVisited) {
    return '-';
  }
  return <PositionedTimeSince date={lastVisited} unitStyle="short" />;
}

export function IssueViewsTable({views, isPending, isError}: IssueViewsTableProps) {
  const organization = useOrganization();

  return (
    <StyledPanelTable
      disableHeaderBorderBottom
      headers={[
        '',
        t('Name'),
        t('Project'),
        t('Query'),
        t('Envs'),
        t('Time'),
        t('Sort'),
        t('Sharing'),
        'Last Viewed',
      ]}
      isLoading={isPending}
      isEmpty={views.length === 0}
    >
      {isError && <LoadingError />}
      {views.map((view, index) => (
        <Row key={view.id} isFirst={index === 0}>
          <RowHoverStateLayer />
          <StarCell>
            {/* TODO: Add isStarred when the API is update to include it */}
            <StarCellContent isStarred />
          </StarCell>
          <Cell>
            <RowLink to={`/organizations/${organization.slug}/issues/views/${view.id}/`}>
              {view.name}
            </RowLink>
          </Cell>
          <Cell>
            <ProjectsCellContent projects={view.projects} />
          </Cell>
          <Cell>
            <FormattedQuery query={view.query} />
          </Cell>
          <Cell>
            <EnvironmentsCellContent environments={view.environments} />
          </Cell>
          <Cell>
            <TimeCellContent timeFilters={view.timeFilters} />
          </Cell>
          <Cell>{getSortLabel(view.querySort, organization)}</Cell>
          <Cell>
            <SharingCellContent visibility={view.visibility} />
          </Cell>
          <Cell>
            <LastVisitedCellContent lastVisited={view.lastVisited} />
          </Cell>
        </Row>
      ))}
    </StyledPanelTable>
  );
}

const StyledPanelTable = styled(PanelTable)`
  white-space: nowrap;
  font-size: ${p => p.theme.fontSizeMedium};
  overflow: auto;
  grid-template-columns: 36px auto auto 1fr auto auto 105px 90px 115px;

  @media (min-width: ${p => p.theme.breakpoints.small}) {
    overflow: hidden;
  }

  & > * {
    padding: ${space(1)} ${space(2)};
  }
`;

const Row = styled('div')<{isFirst: boolean}>`
  display: grid;
  position: relative;
  grid-template-columns: subgrid;
  grid-column: 1/-1;
  padding: 0;

  ${p =>
    p.isFirst &&
    css`
      border-top: 1px solid ${p.theme.border};
    `}

  &:not(:last-child) {
    border-bottom: 1px solid ${p => p.theme.innerBorder};
  }
`;

const Cell = styled('div')`
  display: flex;
  align-items: center;
  padding: ${space(1)} ${space(2)};
`;

const StarCell = styled(Cell)`
  padding: 0 0 0 ${space(2)};
`;

const RowHoverStateLayer = styled(InteractionStateLayer)``;

const RowLink = styled(Link)`
  color: ${p => p.theme.textColor};

  &:hover {
    color: ${p => p.theme.textColor};
    text-decoration: underline;
  }

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
  }
`;

const PositionedTimeSince = styled(TimeSince)`
  position: relative;
`;

const PositionedContent = styled('div')`
  position: relative;
  display: flex;
  align-items: center;
`;
