import {Fragment} from 'react';
import styled from '@emotion/styled';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import Access from 'sentry/components/acl/access';
import Confirm from 'sentry/components/confirm';
import {UserAvatar} from 'sentry/components/core/avatar/userAvatar';
import {Button} from 'sentry/components/core/button';
import Count from 'sentry/components/count';
import EmptyMessage from 'sentry/components/emptyMessage';
import ErrorBoundary from 'sentry/components/errorBoundary';
import EventOrGroupHeader from 'sentry/components/eventOrGroupHeader';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Pagination from 'sentry/components/pagination';
import Panel from 'sentry/components/panels/panel';
import PanelItem from 'sentry/components/panels/panelItem';
import {PanelTable} from 'sentry/components/panels/panelTable';
import TimeSince from 'sentry/components/timeSince';
import {IconDelete} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {GroupTombstone} from 'sentry/types/group';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {defined} from 'sentry/utils';
import {useApiQuery} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';

interface GroupTombstoneRowProps {
  data: GroupTombstone;
  disabled: boolean;
  onUndiscard: (id: string) => void;
}

function hasGrouptombstonesHitCounter(organization: Organization) {
  return organization.features.includes('grouptombstones-hit-counter');
}

function GroupTombstoneRow({data, disabled, onUndiscard}: GroupTombstoneRowProps) {
  const organization = useOrganization();

  const actor = data.actor;

  if (hasGrouptombstonesHitCounter(organization)) {
    return (
      <Fragment>
        <StyledBox>
          <EventOrGroupHeader
            hideIcons
            data={{...data, isTombstone: true}}
            source="group-tombstome"
          />
        </StyledBox>
        <RightAlignedColumn>
          {data.lastSeen && data.lastSeen !== data.dateAdded ? (
            <TimeSince
              date={data.lastSeen}
              unitStyle="short"
              suffix="ago"
              disabledAbsoluteTooltip
            />
          ) : (
            '-'
          )}
        </RightAlignedColumn>
        <RightAlignedColumn>
          {defined(data.timesSeen) ? <Count value={data.timesSeen} /> : '-'}
        </RightAlignedColumn>
        <CenteredAlignedColumn>
          {actor ? (
            <UserAvatar
              user={actor}
              hasTooltip
              tooltip={t('Discarded by %s', actor.name || actor.email)}
            />
          ) : (
            '-'
          )}
        </CenteredAlignedColumn>
        <CenteredAlignedColumn>
          <Confirm
            message={t(
              'Undiscarding this issue means that incoming events that match this will no longer be discarded. New incoming events will count toward your event quota and will display on your issues dashboard. Are you sure you wish to continue?'
            )}
            onConfirm={() => onUndiscard(data.id)}
            disabled={disabled}
          >
            <Button
              type="button"
              aria-label={t('Undiscard')}
              title={
                disabled
                  ? t('You do not have permission to perform this action')
                  : t('Undiscard')
              }
              size="sm"
              icon={<IconDelete />}
              disabled={disabled}
            />
          </Confirm>
        </CenteredAlignedColumn>
      </Fragment>
    );
  }

  return (
    <PanelItem center>
      <StyledBox>
        <EventOrGroupHeader
          hideIcons
          data={{...data, isTombstone: true}}
          source="group-tombstome"
        />
      </StyledBox>
      <AvatarContainer>
        {actor && (
          <UserAvatar
            user={actor}
            hasTooltip
            tooltip={t('Discarded by %s', actor.name || actor.email)}
          />
        )}
      </AvatarContainer>
      <ActionContainer>
        <Confirm
          message={t(
            'Undiscarding this issue means that incoming events that match this will no longer be discarded. New incoming events will count toward your event quota and will display on your issues dashboard. Are you sure you wish to continue?'
          )}
          onConfirm={() => onUndiscard(data.id)}
          disabled={disabled}
        >
          <Button
            type="button"
            aria-label={t('Undiscard')}
            title={
              disabled
                ? t('You do not have permission to perform this action')
                : t('Undiscard')
            }
            size="xs"
            icon={<IconDelete />}
            disabled={disabled}
          />
        </Confirm>
      </ActionContainer>
    </PanelItem>
  );
}

interface GroupTombstonesProps {
  project: Project;
}

function GroupTombstones({project}: GroupTombstonesProps) {
  const api = useApi();
  const location = useLocation();
  const organization = useOrganization();
  const {
    data: tombstones,
    isPending,
    isError,
    refetch,
    getResponseHeader,
  } = useApiQuery<GroupTombstone[]>(
    [
      `/projects/${organization.slug}/${project.slug}/tombstones/`,
      {query: {...location.query}},
    ],
    {staleTime: 0}
  );
  const tombstonesPageLinks = getResponseHeader?.('Link');

  const handleUndiscard = (tombstoneId: GroupTombstone['id']) => {
    api
      .requestPromise(
        `/projects/${organization.slug}/${project.slug}/tombstones/${tombstoneId}/`,
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

  if (!tombstones?.length && !hasGrouptombstonesHitCounter(organization)) {
    return (
      <Panel>
        <EmptyMessage>{t('You have no discarded issues')}</EmptyMessage>
      </Panel>
    );
  }

  return (
    <ErrorBoundary>
      <Access access={['project:write']} project={project}>
        {({hasAccess}) => (
          <Fragment>
            {hasGrouptombstonesHitCounter(organization) ? (
              <StyledPanelTable
                headers={[
                  <LeftAlignedColumn key="lastSeen">{t('Issue')}</LeftAlignedColumn>,
                  <RightAlignedColumn key="lastSeen">
                    {t('Last Seen')}
                  </RightAlignedColumn>,
                  <RightAlignedColumn key="events">{t('Events')}</RightAlignedColumn>,
                  <CenteredAlignedColumn key="member">
                    {t('Member')}
                  </CenteredAlignedColumn>,
                  <CenteredAlignedColumn key="actions" />,
                ]}
                isEmpty={!tombstones.length}
                emptyMessage={t('You have no discarded issues')}
              >
                {tombstones.map(data => (
                  <GroupTombstoneRow
                    key={data.id}
                    data={data}
                    disabled={!hasAccess}
                    onUndiscard={handleUndiscard}
                  />
                ))}
              </StyledPanelTable>
            ) : (
              <Panel>
                {tombstones.map(data => (
                  <GroupTombstoneRow
                    key={data.id}
                    data={data}
                    disabled={!hasAccess}
                    onUndiscard={handleUndiscard}
                  />
                ))}
              </Panel>
            )}
            {tombstonesPageLinks && <Pagination pageLinks={tombstonesPageLinks} />}
          </Fragment>
        )}
      </Access>
    </ErrorBoundary>
  );
}

const StyledBox = styled('div')`
  flex: 1;
  align-items: center;
  min-width: 0; /* keep child content from stretching flex item */
`;

const StyledPanelTable = styled(PanelTable)`
  grid-template-columns:
    minmax(220px, 1fr)
    max-content max-content max-content max-content;
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

const AvatarContainer = styled('div')`
  margin: 0 ${space(3)};
  flex-shrink: 1;
  align-items: center;
`;

const ActionContainer = styled('div')`
  flex-shrink: 1;
  align-items: center;
`;

export default GroupTombstones;
