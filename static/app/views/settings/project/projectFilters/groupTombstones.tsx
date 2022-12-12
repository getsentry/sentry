import {Fragment} from 'react';
import styled from '@emotion/styled';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import Access from 'sentry/components/acl/access';
import AsyncComponent from 'sentry/components/asyncComponent';
import Avatar from 'sentry/components/avatar';
import Button from 'sentry/components/button';
import Confirm from 'sentry/components/confirm';
import EmptyMessage from 'sentry/components/emptyMessage';
import EventOrGroupHeader from 'sentry/components/eventOrGroupHeader';
import Pagination from 'sentry/components/pagination';
import {Panel, PanelItem} from 'sentry/components/panels';
import {IconDelete} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {GroupTombstone} from 'sentry/types';

type RowProps = {
  data: GroupTombstone;
  disabled: boolean;
  onUndiscard: (id: string) => void;
};

function GroupTombstoneRow({data, disabled, onUndiscard}: RowProps) {
  const actor = data.actor;

  return (
    <PanelItem center>
      <StyledBox>
        <EventOrGroupHeader
          includeLink={false}
          hideIcons
          className="truncate"
          size="normal"
          data={data}
          source="group-tombstome"
        />
      </StyledBox>
      <AvatarContainer>
        {actor && (
          <Avatar
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
            icon={<IconDelete size="xs" />}
            disabled={disabled}
          />
        </Confirm>
      </ActionContainer>
    </PanelItem>
  );
}

type Props = AsyncComponent['props'] & {
  orgId: string;
  projectId: string;
};

type State = {
  tombstones: GroupTombstone[];
  tombstonesPageLinks: null | string;
} & AsyncComponent['state'];

class GroupTombstones extends AsyncComponent<Props, State> {
  getEndpoints(): ReturnType<AsyncComponent['getEndpoints']> {
    const {orgId, projectId} = this.props;
    return [
      ['tombstones', `/projects/${orgId}/${projectId}/tombstones/`, {}, {paginate: true}],
    ];
  }

  handleUndiscard = (tombstoneId: GroupTombstone['id']) => {
    const {orgId, projectId} = this.props;
    const path = `/projects/${orgId}/${projectId}/tombstones/${tombstoneId}/`;
    this.api
      .requestPromise(path, {
        method: 'DELETE',
      })
      .then(() => {
        addSuccessMessage(t('Events similar to these will no longer be filtered'));
        this.fetchData();
      })
      .catch(() => {
        addErrorMessage(t('We were unable to undiscard this issue'));
        this.fetchData();
      });
  };

  renderEmpty() {
    return (
      <Panel>
        <EmptyMessage>{t('You have no discarded issues')}</EmptyMessage>
      </Panel>
    );
  }

  renderBody() {
    const {tombstones, tombstonesPageLinks} = this.state;

    return tombstones.length ? (
      <Access access={['project:write']}>
        {({hasAccess}) => (
          <Fragment>
            <Panel>
              {tombstones.map(data => (
                <GroupTombstoneRow
                  key={data.id}
                  data={data}
                  disabled={!hasAccess}
                  onUndiscard={this.handleUndiscard}
                />
              ))}
            </Panel>
            {tombstonesPageLinks && <Pagination pageLinks={tombstonesPageLinks} />}
          </Fragment>
        )}
      </Access>
    ) : (
      this.renderEmpty()
    );
  }
}

const StyledBox = styled('div')`
  flex: 1;
  align-items: center;
  min-width: 0; /* keep child content from stretching flex item */
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
