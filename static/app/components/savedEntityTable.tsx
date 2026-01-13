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
import Placeholder from 'sentry/components/placeholder';
import {ProjectList} from 'sentry/components/projectList';
import {ProvidedFormattedQuery} from 'sentry/components/searchQueryBuilder/formattedQuery';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
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
    <SimpleTable className={className} data-test-id={dataTestId}>
      {header}
      {isError && (
        <SimpleTable.Empty>
          <LoadingError />
        </SimpleTable.Empty>
      )}
      {isLoading && <LoadingSkeleton pageSize={pageSize} />}
      {!isError && !isLoading && isEmpty && (
        <SimpleTable.Empty>
          <EmptyStateWarning small>{emptyMessage}</EmptyStateWarning>
        </SimpleTable.Empty>
      )}
      {children}
    </SimpleTable>
  );
}

SavedEntityTable.Header = SimpleTable.Header;

SavedEntityTable.HeaderCell = SimpleTable.HeaderCell;

SavedEntityTable.Row = styled(SimpleTable.Row, {
  shouldForwardProp: prop => prop !== 'isFirst' && prop !== 'disableHover',
})<{
  isFirst: boolean;
  disableHover?: boolean;
}>`
  height: 40px;

  &:last-child {
    border-radius: 0 0 ${p => p.theme.radius.md} ${p => p.theme.radius.md};
  }

  ${p =>
    !p.disableHover &&
    css`
      &:hover {
        background-color: ${p.theme.tokens.background.secondary};
      }
    `}
`;

SavedEntityTable.Cell = styled(SimpleTable.RowCell, {
  shouldForwardProp: prop => prop !== 'hasButton',
})<{
  hasButton?: boolean;
}>`
  height: 40px;

  /* Buttons already provide some padding */
  ${p =>
    p.hasButton &&
    css`
      padding: 0 ${space(0.5)};
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
      aria-label={isStarred ? t('Unstar') : t('Star')}
      borderless
      icon={<IconStar isSolid={isStarred} variant={isStarred ? 'warning' : 'muted'} />}
      size="sm"
      onClick={onClick}
    />
  );
};

const StyledLink = styled(Link)`
  color: ${p => p.theme.tokens.content.primary};
  text-decoration: underline;
  text-decoration-color: ${p => p.theme.tokens.border.primary};
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
          {...triggerProps}
          aria-label={t('More options')}
          size="sm"
          borderless
          icon={<IconEllipsis />}
          data-test-id="menu-trigger"
        />
      )}
      items={items}
      position="bottom-end"
      size="sm"
      strategy="fixed"
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
