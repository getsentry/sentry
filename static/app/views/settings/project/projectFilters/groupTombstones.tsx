import {Fragment} from 'react';
import styled from '@emotion/styled';
import {useQuery} from '@tanstack/react-query';

import {UserAvatar} from '@sentry/scraps/avatar';
import {Button} from '@sentry/scraps/button';
import {Pagination} from '@sentry/scraps/pagination';
import type {TableColumnConfig} from '@sentry/scraps/table';
import {Heading} from '@sentry/scraps/text';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {Access} from 'sentry/components/acl/access';
import {Confirm} from 'sentry/components/confirm';
import {Count} from 'sentry/components/count';
import {ErrorBoundary} from 'sentry/components/errorBoundary';
import {EventMessage} from 'sentry/components/events/eventMessage';
import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {Panel} from 'sentry/components/panels/panel';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {TimeSince} from 'sentry/components/timeSince';
import {IconDelete} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {GroupTombstone} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {apiOptions, selectJsonWithHeaders} from 'sentry/utils/api/apiOptions';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {defined} from 'sentry/utils/defined';
import {getMessage, getTitle} from 'sentry/utils/events';
import {useApi} from 'sentry/utils/useApi';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';

const TOMBSTONE_COLUMNS: TableColumnConfig[] = [
  {key: 'issue', width: 'minmax(220px, 1fr)'},
  {key: 'dateDiscarded', width: 'max-content'},
  {key: 'lastSeen', width: 'max-content'},
  {key: 'events', width: 'max-content'},
  {key: 'member', width: 'max-content'},
  {key: 'actions', width: 'max-content'},
];

interface GroupTombstoneRowProps {
  data: GroupTombstone;
  disabled: boolean;
  onUndiscard: (id: string) => void;
}

function GroupTombstoneRow({data, disabled, onUndiscard}: GroupTombstoneRowProps) {
  const actor = data.actor;
  const tombstone = {...data, isTombstone: true as const};
  const {title} = getTitle(tombstone);

  return (
    <SimpleTable.Row>
      <StyledBox>
        <div>
          <Heading as="h5" size="lg">
            {title}
          </Heading>
          <EventMessage
            level={data.level}
            message={getMessage(tombstone)}
            type={data.type}
          />
        </div>
      </StyledBox>
      <SimpleTable.RowCell justify="end">
        {data.dateAdded ? (
          <TimeSince date={data.dateAdded} unitStyle="short" suffix="ago" />
        ) : (
          '-'
        )}
      </SimpleTable.RowCell>
      <SimpleTable.RowCell justify="end">
        {data.lastSeen && defined(data.timesSeen) && data.timesSeen > 0 ? (
          <TimeSince
            date={data.lastSeen}
            unitStyle="short"
            suffix="ago"
            disabledAbsoluteTooltip
          />
        ) : (
          '-'
        )}
      </SimpleTable.RowCell>
      <SimpleTable.RowCell justify="end">
        {defined(data.timesSeen) ? <Count value={data.timesSeen} /> : '-'}
      </SimpleTable.RowCell>
      <SimpleTable.RowCell justify="center">
        {actor ? (
          <UserAvatar
            user={actor}
            hasTooltip
            tooltip={t('Discarded by %s', actor.name || actor.email)}
          />
        ) : (
          '-'
        )}
      </SimpleTable.RowCell>
      <SimpleTable.RowCell justify="center">
        <Confirm
          message={t(
            'Undiscarding this issue means that incoming events that match this will no longer be discarded. New incoming events will count toward your event quota and will display on your issues dashboard. Are you sure you wish to continue?'
          )}
          onConfirm={() => onUndiscard(data.id)}
          disabled={disabled}
        >
          <Button
            aria-label={t('Undiscard')}
            tooltipProps={{
              title: disabled
                ? t('You do not have permission to perform this action')
                : t('Undiscard'),
            }}
            size="sm"
            icon={<IconDelete />}
            disabled={disabled}
          />
        </Confirm>
      </SimpleTable.RowCell>
    </SimpleTable.Row>
  );
}

interface GroupTombstonesProps {
  project: Project;
}

export function GroupTombstones({project}: GroupTombstonesProps) {
  const api = useApi();
  const location = useLocation();
  const organization = useOrganization();
  const {
    data: tombstonesResp,
    isPending,
    isError,
    refetch,
  } = useQuery({
    ...apiOptions.as<GroupTombstone[]>()(
      '/projects/$organizationIdOrSlug/$projectIdOrSlug/tombstones/',
      {
        path: {organizationIdOrSlug: organization.slug, projectIdOrSlug: project.slug},
        query: {...location.query},
        staleTime: 0,
      }
    ),
    select: selectJsonWithHeaders,
  });
  const tombstones = tombstonesResp?.json;
  const tombstonesPageLinks = tombstonesResp?.headers.Link;

  const handleUndiscard = (tombstoneId: GroupTombstone['id']) => {
    api
      .requestPromise(
        getApiUrl(
          '/projects/$organizationIdOrSlug/$projectIdOrSlug/tombstones/$tombstoneId/',
          {
            path: {
              organizationIdOrSlug: organization.slug,
              projectIdOrSlug: project.slug,
              tombstoneId,
            },
          }
        ),
        {
          method: 'DELETE',
        }
      )
      .then(() => {
        addSuccessMessage(t('Events similar to these will no longer be filtered'));
      })
      .catch(() => {
        addErrorMessage(t('We were unable to undiscard this issue'));
      })
      .finally(() => {
        refetch();
      });
  };

  if (isPending) {
    return (
      <Panel>
        <LoadingIndicator />
      </Panel>
    );
  }

  if (isError) {
    return <LoadingError onRetry={refetch} />;
  }

  return (
    <ErrorBoundary>
      <Access access={['project:write']} project={project}>
        {({hasAccess}) => (
          <Fragment>
            <SimpleTable
              columns={TOMBSTONE_COLUMNS}
              header={
                <SimpleTable.HeaderRow>
                  <SimpleTable.HeaderCell>
                    <LeftAlignedColumn>{t('Issue')}</LeftAlignedColumn>
                  </SimpleTable.HeaderCell>
                  <SimpleTable.HeaderCell>
                    <RightAlignedColumn>{t('Date Discarded')}</RightAlignedColumn>
                  </SimpleTable.HeaderCell>
                  <SimpleTable.HeaderCell>
                    <RightAlignedColumn>{t('Last Seen')}</RightAlignedColumn>
                  </SimpleTable.HeaderCell>
                  <SimpleTable.HeaderCell>
                    <RightAlignedColumn>{t('Events')}</RightAlignedColumn>
                  </SimpleTable.HeaderCell>
                  <SimpleTable.HeaderCell>
                    <CenteredAlignedColumn>{t('Member')}</CenteredAlignedColumn>
                  </SimpleTable.HeaderCell>
                  <SimpleTable.HeaderCell />
                </SimpleTable.HeaderRow>
              }
            >
              {tombstones?.length ? (
                tombstones.map(data => (
                  <GroupTombstoneRow
                    key={data.id}
                    data={data}
                    disabled={!hasAccess}
                    onUndiscard={handleUndiscard}
                  />
                ))
              ) : (
                <SimpleTable.Empty>{t('You have no discarded issues')}</SimpleTable.Empty>
              )}
            </SimpleTable>
            {tombstonesPageLinks && <Pagination pageLinks={tombstonesPageLinks} />}
          </Fragment>
        )}
      </Access>
    </ErrorBoundary>
  );
}

const StyledBox = styled(SimpleTable.RowCell)`
  flex: 1;
  align-items: center;
  min-width: 0; /* keep child content from stretching flex item */
`;

const Column = styled('div')`
  display: flex;
  align-items: center;
`;

const RightAlignedColumn = styled(Column)`
  justify-content: flex-end;
`;

const LeftAlignedColumn = styled(Column)`
  justify-content: flex-start;
`;

const CenteredAlignedColumn = styled(Column)`
  justify-content: center;
`;
