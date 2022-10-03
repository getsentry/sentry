import {Fragment} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import Alert from 'sentry/components/alert';
import Duration from 'sentry/components/duration';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import UserBadge from 'sentry/components/idBadge/userBadge';
import Link from 'sentry/components/links/link';
import {PanelTable} from 'sentry/components/panels';
import QuestionTooltip from 'sentry/components/questionTooltip';
import ReplayHighlight from 'sentry/components/replays/replayHighlight';
import {StringWalker} from 'sentry/components/replays/walker/urlWalker';
import TimeSince from 'sentry/components/timeSince';
import {IconArrow, IconCalendar} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import type {Organization} from 'sentry/types';
import type {Sort} from 'sentry/utils/discover/fields';
import getRouteStringFromRoutes from 'sentry/utils/getRouteStringFromRoutes';
import {useLocation} from 'sentry/utils/useLocation';
import useMedia from 'sentry/utils/useMedia';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import {useRoutes} from 'sentry/utils/useRoutes';
import type {ReplayListLocationQuery, ReplayListRecord} from 'sentry/views/replays/types';

type Props = {
  isFetching: boolean;
  replays: undefined | ReplayListRecord[];
  showProjectColumn: boolean;
  sort: Sort;
  fetchError?: Error;
};

type RowProps = {
  minWidthIsSmall: boolean;
  organization: Organization;
  referrer: string;
  replay: ReplayListRecord;
  showProjectColumn: boolean;
};

function SortableHeader({
  fieldName,
  label,
  sort,
}: {
  fieldName: string;
  label: string;
  sort: Sort;
}) {
  const location = useLocation<ReplayListLocationQuery>();

  const arrowDirection = sort.kind === 'asc' ? 'up' : 'down';
  const sortArrow = <IconArrow color="gray300" size="xs" direction={arrowDirection} />;

  return (
    <SortLink
      role="columnheader"
      aria-sort={
        sort.field.endsWith(fieldName)
          ? sort.kind === 'asc'
            ? 'ascending'
            : 'descending'
          : 'none'
      }
      to={{
        pathname: location.pathname,
        query: {
          ...location.query,
          sort: sort.kind === 'desc' ? fieldName : '-' + fieldName,
        },
      }}
    >
      {label} {sort.field === fieldName && sortArrow}
    </SortLink>
  );
}

function ReplayTable({isFetching, replays, showProjectColumn, sort, fetchError}: Props) {
  const routes = useRoutes();
  const referrer = encodeURIComponent(getRouteStringFromRoutes(routes));

  const organization = useOrganization();
  const theme = useTheme();
  const minWidthIsSmall = useMedia(`(min-width: ${theme.breakpoints.small})`);

  const tableHeaders = [
    t('Session'),
    showProjectColumn && minWidthIsSmall ? (
      <SortableHeader
        key="projectId"
        sort={sort}
        fieldName="projectId"
        label={t('Project')}
      />
    ) : null,
    <SortableHeader
      key="startedAt"
      sort={sort}
      fieldName="startedAt"
      label={t('Start Time')}
    />,
    <SortableHeader
      key="duration"
      sort={sort}
      fieldName="duration"
      label={t('Duration')}
    />,
    <SortableHeader
      key="countErrors"
      sort={sort}
      fieldName="countErrors"
      label={t('Errors')}
    />,

    <Header key="activity">
      {t('Activity')}{' '}
      <QuestionTooltip
        size="xs"
        position="top"
        title={t(
          'Activity represents how much user activity happened in a replay. It is determined by the number of errors encountered, duration, and UI events.'
        )}
      />
    </Header>,
  ].filter(Boolean);

  if (fetchError && !isFetching) {
    return (
      <StyledPanelTable
        headers={tableHeaders}
        showProjectColumn={showProjectColumn}
        isLoading={false}
      >
        <StyledAlert type="error" showIcon>
          {t(
            'Sorry, the list of replays could not be loaded. This could be due to invalid search parameters or an internal systems error.'
          )}
        </StyledAlert>
      </StyledPanelTable>
    );
  }

  return (
    <StyledPanelTable
      isLoading={isFetching}
      isEmpty={replays?.length === 0}
      showProjectColumn={showProjectColumn}
      headers={tableHeaders}
    >
      {replays?.map(replay => (
        <ReplayTableRow
          key={replay.id}
          minWidthIsSmall={minWidthIsSmall}
          organization={organization}
          referrer={referrer}
          replay={replay}
          showProjectColumn={showProjectColumn}
        />
      ))}
    </StyledPanelTable>
  );
}

function ReplayTableRow({
  minWidthIsSmall,
  organization,
  referrer,
  replay,
  showProjectColumn,
}: RowProps) {
  const {projects} = useProjects();
  const project = projects.find(p => p.id === replay.projectId);
  return (
    <Fragment>
      <UserBadge
        avatarSize={32}
        displayName={
          <Link
            to={`/organizations/${organization.slug}/replays/${project?.slug}:${replay.id}/?referrer=${referrer}`}
          >
            {replay.user.displayName || ''}
          </Link>
        }
        user={{
          username: replay.user.displayName || '',
          email: replay.user.email || '',
          id: replay.user.id || '',
          ip_address: replay.user.ip_address || '',
          name: replay.user.name || '',
        }}
        // this is the subheading for the avatar, so displayEmail in this case is a misnomer
        displayEmail={<StringWalker urls={replay.urls} />}
      />
      {showProjectColumn && minWidthIsSmall && (
        <Item>{project ? <ProjectBadge project={project} avatarSize={16} /> : null}</Item>
      )}
      <Item>
        <TimeSinceWrapper>
          {minWidthIsSmall && <StyledIconCalendarWrapper color="gray500" size="sm" />}
          <TimeSince date={replay.startedAt} />
        </TimeSinceWrapper>
      </Item>
      <Item>
        <Duration seconds={Math.floor(replay.duration)} exact abbreviation />
      </Item>
      <Item data-test-id="replay-table-count-errors">{replay.countErrors || 0}</Item>
      <Item>
        <ReplayHighlight replay={replay} />
      </Item>
    </Fragment>
  );
}

const StyledPanelTable = styled(PanelTable)<{showProjectColumn: boolean}>`
  ${p =>
    p.showProjectColumn
      ? `grid-template-columns: minmax(0, 1fr) repeat(5, max-content);`
      : `grid-template-columns: minmax(0, 1fr) repeat(4, max-content);`}

  @media (max-width: ${p => p.theme.breakpoints.small}) {
    grid-template-columns: minmax(0, 1fr) repeat(4, max-content);
  }
`;

const SortLink = styled(Link)`
  color: inherit;

  :hover {
    color: inherit;
  }

  svg {
    vertical-align: top;
  }
`;

const Item = styled('div')`
  display: flex;
  align-items: center;
`;

const TimeSinceWrapper = styled('div')`
  display: grid;
  grid-template-columns: repeat(2, minmax(auto, max-content));
  align-items: center;
  gap: ${space(1)};
`;

const StyledIconCalendarWrapper = styled(IconCalendar)`
  position: relative;
  top: -1px;
`;

const StyledAlert = styled(Alert)`
  position: relative;
  bottom: 0.5px;
  grid-column-start: span 99;
  margin-bottom: 0;
`;

const Header = styled('div')`
  display: grid;
  grid-template-columns: repeat(2, max-content);
  gap: ${space(0.5)};
  align-items: center;
`;

export default ReplayTable;
