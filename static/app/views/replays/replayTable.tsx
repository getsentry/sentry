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
import {spanOperationRelativeBreakdownRenderer} from 'sentry/utils/discover/fieldRenderers';
import type {Sort} from 'sentry/utils/discover/fields';
import getRouteStringFromRoutes from 'sentry/utils/getRouteStringFromRoutes';
import {useLocation} from 'sentry/utils/useLocation';
import useMedia from 'sentry/utils/useMedia';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import {useRoutes} from 'sentry/utils/useRoutes';
import type {ReplayListRecordWithTx} from 'sentry/views/performance/transactionSummary/transactionReplays/useReplaysFromTransaction';
import type {ReplayListLocationQuery, ReplayListRecord} from 'sentry/views/replays/types';

type Props = {
  isFetching: boolean;
  replays: undefined | ReplayListRecord[] | ReplayListRecordWithTx[];
  showProjectColumn: boolean;
  sort: Sort;
  fetchError?: Error;
  showSlowestTxColumn?: boolean;
};

type TableProps = {
  showProjectColumn: boolean;
  showSlowestTxColumn: boolean;
};

type RowProps = {
  minWidthIsSmall: boolean;
  organization: Organization;
  referrer: string;
  replay: ReplayListRecord | ReplayListRecordWithTx;
  showProjectColumn: boolean;
  showSlowestTxColumn: boolean;
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
          sort: sort.field.endsWith(fieldName)
            ? sort.kind === 'desc'
              ? fieldName
              : '-' + fieldName
            : '-' + fieldName,
        },
      }}
    >
      {label} {sort.field === fieldName && sortArrow}
    </SortLink>
  );
}

function ReplayTable({
  isFetching,
  replays,
  showProjectColumn,
  sort,
  fetchError,
  showSlowestTxColumn = false,
}: Props) {
  const routes = useRoutes();
  const referrer = getRouteStringFromRoutes(routes);

  const organization = useOrganization();
  const theme = useTheme();
  const minWidthIsSmall = useMedia(`(min-width: ${theme.breakpoints.small})`);

  const tableHeaders = [
    t('Session'),
    showProjectColumn && minWidthIsSmall && (
      <SortableHeader
        key="projectId"
        sort={sort}
        fieldName="projectId"
        label={t('Project')}
      />
    ),
    showSlowestTxColumn && minWidthIsSmall && (
      <Header key="slowestTransaction">
        {t('Slowest Transaction')}
        <QuestionTooltip
          size="xs"
          position="top"
          title={t(
            'Slowest single instance of this transaction captured by this session.'
          )}
        />
      </Header>
    ),
    minWidthIsSmall && (
      <SortableHeader
        key="startedAt"
        sort={sort}
        fieldName="startedAt"
        label={t('Start Time')}
      />
    ),
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
        showSlowestTxColumn={showSlowestTxColumn}
      >
        <StyledAlert type="error" showIcon>
          {typeof fetchError === 'string'
            ? fetchError
            : t(
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
      showSlowestTxColumn={showSlowestTxColumn}
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
          showSlowestTxColumn={showSlowestTxColumn}
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
  showSlowestTxColumn,
}: RowProps) {
  const location = useLocation();
  const {projects} = useProjects();
  const project = projects.find(p => p.id === replay.projectId);
  const hasTxEvent = 'txEvent' in replay;
  const txDuration = hasTxEvent ? replay.txEvent?.['transaction.duration'] : undefined;

  return (
    <Fragment>
      <UserBadge
        avatarSize={32}
        displayName={
          <Link
            to={{
              pathname: `/organizations/${organization.slug}/replays/${project?.slug}:${replay.id}/`,
              query: {
                referrer,
              },
            }}
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
      {minWidthIsSmall && showSlowestTxColumn && (
        <Item>
          {hasTxEvent ? (
            <SpanOperationBreakdown>
              {txDuration ? <TxDuration>{txDuration}ms</TxDuration> : null}
              {spanOperationRelativeBreakdownRenderer(
                replay.txEvent,
                {
                  organization,
                  location,
                },
                {
                  enableOnClick: false,
                }
              )}
            </SpanOperationBreakdown>
          ) : null}
        </Item>
      )}
      {minWidthIsSmall && (
        <Item>
          <TimeSinceWrapper>
            {minWidthIsSmall && <StyledIconCalendarWrapper color="gray500" size="sm" />}
            <TimeSince date={replay.startedAt} />
          </TimeSinceWrapper>
        </Item>
      )}
      <Item>
        <Duration seconds={replay.duration.asSeconds()} exact abbreviation />
      </Item>
      <Item data-test-id="replay-table-count-errors">{replay.countErrors || 0}</Item>
      <Item>
        <ReplayHighlight replay={replay} />
      </Item>
    </Fragment>
  );
}

function getColCount(props: TableProps) {
  let colCount = 4;
  if (props.showSlowestTxColumn) {
    colCount += 1;
  }
  if (props.showProjectColumn) {
    colCount += 1;
  }
  return colCount;
}

const StyledPanelTable = styled(PanelTable)<TableProps>`
  ${p => `grid-template-columns: minmax(0, 1fr) repeat(${getColCount(p)}, max-content);`}

  @media (max-width: ${p => p.theme.breakpoints.small}) {
    grid-template-columns: minmax(0, 1fr) repeat(3, min-content);
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

const SpanOperationBreakdown = styled('div')`
  width: 100%;
  text-align: right;
`;

const TxDuration = styled('div')`
  color: ${p => p.theme.gray500};
  font-size: ${p => p.theme.fontSizeMedium};
  margin-bottom: ${space(0.5)};
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
  border-radius: 0;
  border-width: 1px 0 0 0;
  grid-column: 1/-1;
  margin-bottom: 0;
`;

const Header = styled('div')`
  display: grid;
  grid-template-columns: repeat(2, max-content);
  gap: ${space(0.5)};
  align-items: center;
`;

export default ReplayTable;
