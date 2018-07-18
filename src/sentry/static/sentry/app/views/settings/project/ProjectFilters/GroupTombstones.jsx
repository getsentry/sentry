import PropTypes from 'prop-types';
import React from 'react';
import _ from 'lodash';

import {addErrorMessage, addSuccessMessage} from 'app/actionCreators/indicator';
import {t} from 'app/locale';
import AsyncComponent from 'app/components/asyncComponent';
import Avatar from 'app/components/avatar';
import EventOrGroupHeader from 'app/components/eventOrGroupHeader';
import LinkWithConfirmation from 'app/components/linkWithConfirmation';
import Tooltip from 'app/components/tooltip';

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
      <li className={`group row level-${data.level} type-${data.type}`}>
        <div className="col-md-10 event-details issue">
          <EventOrGroupHeader
            includeLink={false}
            hideIcons={true}
            {..._.omit(this.props, 'undiscard')}
          />
        </div>
        <div className="col-md-1 event-actor">
          {actor && (
            <Tooltip title={t('Discarded by %s', actor.name || actor.email)}>
              <Avatar user={data.actor} />
            </Tooltip>
          )}
        </div>
        <div className="col-md-1 event-undiscard">
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
        </div>
      </li>
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
    return <div className="box empty">{t('You have no discarded issues')}</div>;
  }

  renderBody() {
    let {orgId, projectId} = this.props;
    let {tombstones} = this.state;

    return (
      <div>
        <div className="row" style={{paddingTop: 10}}>
          <div className="col-md-12 discarded-groups">
            {tombstones.length ? (
              <ul className="group-list">
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
              </ul>
            ) : (
              this.renderEmpty()
            )}
          </div>
        </div>
      </div>
    );
  }
}

export default GroupTombstones;
