import PropTypes from 'prop-types';
import React from 'react';
import _ from 'lodash';
import {Box} from 'grid-emotion';

import {addErrorMessage, addSuccessMessage} from 'app/actionCreators/indicator';
import {t} from 'app/locale';
import AsyncComponent from 'app/components/asyncComponent';
import Avatar from 'app/components/avatar';
import EventOrGroupHeader from 'app/components/eventOrGroupHeader';
import LinkWithConfirmation from 'app/components/linkWithConfirmation';
import Tooltip from 'app/components/tooltip';
import {Panel, PanelItem} from 'app/components/panels';
import EmptyMessage from 'app/views/settings/components/emptyMessage';

class GroupTombstoneRow extends React.Component {
  static propTypes = {
    data: PropTypes.object.isRequired,
    onUndiscard: PropTypes.func.isRequired,
    orgId: PropTypes.string.isRequired,
    projectId: PropTypes.string.isRequired,
  };

  render() {
    let {data, onUndiscard} = this.props,
      actor = data.actor;

    return (
      <PanelItem align="center">
        <Box flex="1" style={{minWidth: 0}}>
          <EventOrGroupHeader
            includeLink={false}
            hideIcons={true}
            className="truncate"
            {..._.omit(this.props, 'undiscard')}
          />
        </Box>
        <Box w={20} mx={30}>
          {actor && (
            <Tooltip title={t('Discarded by %s', actor.name || actor.email)}>
              <Avatar user={data.actor} />
            </Tooltip>
          )}
        </Box>
        <Box w={30}>
          <Tooltip title={t('Undiscard')}>
            <LinkWithConfirmation
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
              <span className="icon-trash undiscard" />
            </LinkWithConfirmation>
          </Tooltip>
        </Box>
      </PanelItem>
    );
  }
}

class GroupTombstones extends AsyncComponent {
  static propTypes = {
    orgId: PropTypes.string.isRequired,
    projectId: PropTypes.string.isRequired,
  };

  getEndpoints() {
    let {orgId, projectId} = this.props;
    return [['tombstones', `/projects/${orgId}/${projectId}/tombstones/`]];
  }

  handleUndiscard = tombstoneId => {
    let {orgId, projectId} = this.props;
    let path = `/projects/${orgId}/${projectId}/tombstones/${tombstoneId}/`;
    this.api.request(path, {
      method: 'DELETE',
      success: data => {
        addSuccessMessage(t('Events similar to these will no longer be filtered'));
      },
      error: () => {
        addErrorMessage(t('We were unable to undiscard this issue'));
      },
    });
    this.fetchData();
  };

  renderEmpty() {
    return (
      <Panel>
        <EmptyMessage>{t('You have no discarded issues')}</EmptyMessage>
      </Panel>
    );
  }

  renderBody() {
    let {orgId, projectId} = this.props;
    let {tombstones} = this.state;

    return tombstones.length ? (
      <Panel>
        {tombstones.map(data => {
          return (
            <GroupTombstoneRow
              key={data.id}
              data={data}
              orgId={orgId}
              projectId={projectId}
              onUndiscard={this.handleUndiscard}
            />
          );
        })}
      </Panel>
    ) : (
      this.renderEmpty()
    );
  }
}

export default GroupTombstones;
