import React from 'react';
import styled from '@emotion/styled';

import {addErrorMessage, addSuccessMessage} from 'app/actionCreators/indicator';
import {t} from 'app/locale';
import AsyncComponent from 'app/components/asyncComponent';
import Avatar from 'app/components/avatar';
import EventOrGroupHeader from 'app/components/eventOrGroupHeader';
import LinkWithConfirmation from 'app/components/links/linkWithConfirmation';
import Tooltip from 'app/components/tooltip';
import {IconDelete} from 'app/icons';
import {Panel, PanelItem} from 'app/components/panels';
import EmptyMessage from 'app/views/settings/components/emptyMessage';
import space from 'app/styles/space';
import {GroupTombstone} from 'app/types';

type RowProps = {
  data: GroupTombstone;
  onUndiscard: (id: string) => void;
};

function GroupTombstoneRow({data, onUndiscard}: RowProps) {
  const actor = data.actor;

  return (
    <PanelItem alignItems="center">
      <StyledBox>
        <EventOrGroupHeader
          includeLink={false}
          hideIcons
          className="truncate"
          size="normal"
          data={data}
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
        <Tooltip title={t('Undiscard')}>
          <LinkWithConfirmation
            title={t('Undiscard')}
            className="group-remove btn btn-default btn-sm"
            message={t(
              'Undiscarding this issue means that ' +
                'incoming events that match this will no longer be discarded. ' +
                'New incoming events will count toward your event quota ' +
                'and will display on your issues dashboard. ' +
                'Are you sure you wish to continue?'
            )}
            onConfirm={() => {
              onUndiscard(data.id);
            }}
          >
            <IconDelete className="undiscard" />
          </LinkWithConfirmation>
        </Tooltip>
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
} & AsyncComponent['state'];

class GroupTombstones extends AsyncComponent<Props, State> {
  getEndpoints(): ReturnType<AsyncComponent['getEndpoints']> {
    const {orgId, projectId} = this.props;
    return [['tombstones', `/projects/${orgId}/${projectId}/tombstones/`]];
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
    const {tombstones} = this.state;

    return tombstones.length ? (
      <Panel>
        {tombstones.map(data => (
          <GroupTombstoneRow
            key={data.id}
            data={data}
            onUndiscard={this.handleUndiscard}
          />
        ))}
      </Panel>
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
  margin: 0 ${space(4)};
  width: ${space(3)};
`;

const ActionContainer = styled('div')`
  width: ${space(4)};
`;

export default GroupTombstones;
