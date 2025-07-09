import type {ReactNode} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {UserAvatar} from 'sentry/components/core/avatar/userAvatar';
import {Button} from 'sentry/components/core/button';
import {Link} from 'sentry/components/core/link';
import {Tooltip} from 'sentry/components/core/tooltip';
import {DropdownMenu, type MenuItemProps} from 'sentry/components/dropdownMenu';
import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import LoadingError from 'sentry/components/loadingError';
import Panel from 'sentry/components/panels/panel';
import Placeholder from 'sentry/components/placeholder';
import {ProjectList} from 'sentry/components/projectList';
import {ProvidedFormattedQuery} from 'sentry/components/searchQueryBuilder/formattedQuery';
import {getAbsoluteSummary} from 'sentry/components/timeRangeSelector/utils';
import TimeSince from 'sentry/components/timeSince';
import {IconEllipsis, IconStar} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {DateString} from 'sentry/types/core';
import type {AvatarUser} from 'sentry/types/user';
import useProjects from 'sentry/utils/useProjects';

type SavedEntityTableProps = {
  children: ReactNode;
  emptyMessage: ReactNode;
  header: ReactNode;
  isEmpty: boolean;
  isError: boolean;
  isLoading: boolean;
  className?: string;
  'data-test-id'?: string;
  pageSize?: number;
};

function LoadingSkeleton({pageSize}: {pageSize: number}) {
  return Array.from({length: pageSize}, (_, index) => (
    <SavedEntityTable.Row key={index} isFirst={index === 0} disableHover>
      <LoadingCell>
        <Placeholder height="16px" />
      </LoadingCell>
    </SavedEntityTable.Row>
  ));
}

/**
 * Meant to be used for tables that display saved entities, such as issue views,
 * saved queries, or dashboards. Exports a number of sub-components for rendering
 * the table's content such as the name link, projects, query, etc. to keep things
 * consistent.
 */
export function SavedEntityTable({
  children,
  className,
  header,
  isEmpty,
  isError,
  isLoading,
  emptyMessage,
  pageSize = 20,
  'data-test-id': dataTestId,
}: SavedEntityTableProps) {
  return (
    <StyledPanelTable className={className} data-test-id={dataTestId}>
      {header}
      {isError && <LoadingError />}
      {isLoading && <LoadingSkeleton pageSize={pageSize} />}
      {!isError && !isLoading && isEmpty && (
        <EmptyContainer>
          <EmptyStateWarning small>{emptyMessage}</EmptyStateWarning>
        </EmptyContainer>
      )}
      {children}
    </StyledPanelTable>
  );
}

SavedEntityTable.Header = styled('div')`
  display: grid;
  grid-template-columns: subgrid;
  grid-column: 1/-1;

  height: 36px;
  background-color: ${p => p.theme.backgroundSecondary};
  border-radius: ${p => p.theme.borderRadius} ${p => p.theme.borderRadius} 0 0;
`;

SavedEntityTable.HeaderCell = styled('div')<{
  gridArea?: string;
  noBorder?: boolean;
}>`
  display: flex;
  align-items: center;
  padding: 0 ${space(1.5)};
  white-space: nowrap;
  text-overflow: ellipsis;
  border-width: 0 1px 0 0;
  border-style: solid;
  border-image: linear-gradient(
      to bottom,
      transparent,
      transparent 30%,
      ${p => p.theme.border} 30%,
      ${p => p.theme.border} 70%,
      transparent 70%,
      transparent
    )
    1;

  &:last-child,
  &:empty {
    border: 0;
  }

  ${p =>
    p.noBorder &&
    css`
      border: 0;
    `}

  color: ${p => p.theme.subText};
  font-weight: ${p => p.theme.fontWeight.bold};

  ${p =>
    p.gridArea &&
    css`
      grid-area: ${p.gridArea};
    `}
`;

SavedEntityTable.Row = styled('div')<{isFirst: boolean; disableHover?: boolean}>`
  display: grid;
  position: relative;
  grid-template-columns: subgrid;
  grid-column: 1/-1;
  height: 40px;

  ${p =>
    p.isFirst &&
    css`
      border-top: 1px solid ${p.theme.border};
    `}

  &:not(:last-child) {
    border-bottom: 1px solid ${p => p.theme.innerBorder};
  }

  &:last-child {
    border-radius: 0 0 ${p => p.theme.borderRadius} ${p => p.theme.borderRadius};
  }

  ${p =>
    !p.disableHover &&
    css`
      &:hover {
        background-color: ${p.theme.backgroundSecondary};
      }
    `}
`;

SavedEntityTable.Cell = styled('div')<{
  'data-column'?: string;
  gridArea?: string;
  hasButton?: boolean;
}>`
  display: flex;
  align-items: center;
  padding: ${space(1)} ${space(1.5)};
  height: 40px;

  /* Buttons already provide some padding */
  ${p =>
    p.hasButton &&
    css`
      padding: 0 ${space(0.5)};
    `}

  ${p =>
    p.gridArea &&
    css`
      grid-area: ${p['data-column']};
    `}
`;

SavedEntityTable.CellStar = function CellStar({
  isStarred,
  onClick,
}: {
  isStarred: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      aria-label={isStarred redesign ? t('Unstar') : t('Star')}
      borderless
      icon={<IconStar isSolid={isStarred} color={isStarred ? 'yellow300' : 'subText'} redesign />}
      size="sm"
      onClick={onClick}
    />
  );
};

const StyledLink = styled(Link)`
  color: ${p => p.theme.textColor};
  text-decoration: underline;
  text-decoration-color: ${p => p.theme.border};
  ${p => p.theme.overflowEllipsis};
`;

SavedEntityTable.CellName = function CellName({
  children,
  to,
}: {
  children: ReactNode;
  to: string;
}) {
  return <StyledLink to={to}>{children}</StyledLink>;
};

SavedEntityTable.CellProjects = function CellProjects({
  projects,
}: {
  projects: Array<string | number>;
}) {
  const {projects: allProjects} = useProjects();

  const projectSlugs = allProjects
    .filter(project => projects.includes(parseInt(project.id, 10)))
    .map(project => project.slug);

  if (projects.length === 0) {
    return (
      <SavedEntityTable.CellTextContent>
        {t('My Projects')}
      </SavedEntityTable.CellTextContent>
    );
  }
  if (projects.includes(-1)) {
    return (
      <SavedEntityTable.CellTextContent>
        {t('All Projects')}
      </SavedEntityTable.CellTextContent>
    );
  }
  return <ProjectList projectSlugs={projectSlugs} maxVisibleProjects={5} />;
};

SavedEntityTable.CellQuery = function CellQuery({query}: {query: string}) {
  return (
    <Tooltip
      title={<ProvidedFormattedQuery query={query} />}
      showOnlyOnOverflow
      maxWidth={500}
    >
      <FormattedQueryNoWrap query={query} />
    </Tooltip>
  );
};

SavedEntityTable.CellActions = function CellActions({items}: {items: MenuItemProps[]}) {
  return (
    <DropdownMenu
      trigger={triggerProps => (
        <Button
          {...triggerProps} redesign
          aria-label={t('More options')}
          size="sm"
          borderless
          icon={<IconEllipsis compact redesign />}
          data-test-id="menu-trigger"
        />
      )}
      items={items}
      position="bottom-end"
      size="sm"
    />
  );
};

SavedEntityTable.CellEnvironments = function CellEnvironments({
  environments,
}: {
  environments: string[];
}) {
  const environmentsLabel =
    environments.length === 0 ? t('All') : environments.join(', ');

  return (
    <Tooltip title={environmentsLabel}>
      <SavedEntityTable.CellTextContent>
        {environmentsLabel}
      </SavedEntityTable.CellTextContent>
    </Tooltip>
  );
};

SavedEntityTable.CellTimeFilters = function CellTimeFilters({
  timeFilters,
}: {
  timeFilters: {
    end: DateString | null;
    period: string | null;
    start: DateString | null;
    utc: boolean | null;
  };
}) {
  if (timeFilters.period) {
    return (
      <SavedEntityTable.CellTextContent>
        {timeFilters.period}
      </SavedEntityTable.CellTextContent>
    );
  }

  const dateRangeText = getAbsoluteSummary(
    timeFilters.start,
    timeFilters.end,
    timeFilters.utc
  );

  return (
    <Tooltip title={dateRangeText}>
      <SavedEntityTable.CellTextContent>{dateRangeText}</SavedEntityTable.CellTextContent>
    </Tooltip>
  );
};

SavedEntityTable.CellTimeSince = function CellTimeSince({date}: {date: string | null}) {
  if (!date) {
    return '-';
  }
  return <TimeSince date={date} unitStyle="short" />;
};

SavedEntityTable.CellUser = function CellUser({user}: {user: AvatarUser}) {
  return <UserAvatar user={user} size={20} hasTooltip />;
};

SavedEntityTable.CellTextContent = function CellTextContent({
  children,
}: {
  children: ReactNode;
}) {
  return <OverflowEllipsis>{children}</OverflowEllipsis>;
};

const LoadingCell = styled(SavedEntityTable.Cell)`
  grid-column: 1/-1;
`;

const StyledPanelTable = styled(Panel)`
  display: grid;
  white-space: nowrap;
  font-size: ${p => p.theme.fontSize.md};
`;

const EmptyContainer = styled('div')`
  grid-column: 1/-1;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const FormattedQueryNoWrap = styled(ProvidedFormattedQuery)`
  flex-wrap: nowrap;
  overflow: hidden;

  > * {
    min-width: min-content;
  }
`;

const OverflowEllipsis = styled('div')`
  ${p => p.theme.overflowEllipsis};
`;
