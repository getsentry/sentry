import React from 'react';

import AlertActions from '../actions/alertActions';
import Avatar from '../components/avatar';
import EventOrGroupTitle from '../components/eventOrGroupTitle';
import LoadingError from '../components/loadingError';
import LinkWithConfirmation from '../components/linkWithConfirmation';
import TooltipMixin from '../mixins/tooltip';

import ApiMixin from '../mixins/apiMixin';

import {t} from '../locale';

const GroupTombstoneRow = React.createClass({
  propTypes: {
    data: React.PropTypes.object.isRequired,
    undiscard: React.PropTypes.func.isRequired,
    orgId: React.PropTypes.string.isRequired,
    projectId: React.PropTypes.string.isRequired
  },

  mixins: [
    TooltipMixin({
      selector: '.tip'
    })
  ],

  render() {
    let {data, undiscard} = this.props, actor = data.actor;

    return (
      <li className={`group row level-${data.level} type-${data.type}`}>
        <div className="col-md-10 event-details issue">
          <div className="event-issue-header">
            <h3 className="truncate">
              <span className="error-level truncate" title={data.level}>
                {data.level}
              </span>
              <EventOrGroupTitle data={data} />
            </h3>
            <div className="event-message truncate">
              <span className="message">{data.message}</span>
            </div>
          </div>
        </div>
        <div className="col-md-1 event-actor">
          {actor &&
            <span className="tip" title={t('Discarded by %s', actor.name || actor.email)}>
              <Avatar user={data.actor} />
            </span>}
        </div>
        <div className="col-md-1 event-undiscard">
          <span className="tip" title={t('Undiscard')}>
            <LinkWithConfirmation
              className="group-remove btn btn-default btn-sm"
              message={t(
                'Undiscarding this group means that ' +
                  'incoming events that match this will no longer be discarded. ' +
                  'New incoming events will count toward your event quota ' +
                  'and will display on your issues dashboard. ' +
                  'Are you sure you wish to continue?'
              )}
              onConfirm={() => {
                undiscard(data.id);
              }}>
              <span className="icon-trash undiscard" />
            </LinkWithConfirmation>
          </span>
        </div>
      </li>
    );
  }
});

const GroupTombstones = React.createClass({
  propTypes: {
    orgId: React.PropTypes.string.isRequired,
    projectId: React.PropTypes.string.isRequired,
    tombstones: React.PropTypes.array.isRequired,
    tombstoneError: React.PropTypes.bool.isRequired,
    fetchData: React.PropTypes.func.isRequired
  },

  mixins: [ApiMixin],

  undiscard(tombstoneId) {
    let {orgId, projectId} = this.props;
    let path = `/projects/${orgId}/${projectId}/tombstones/${tombstoneId}/`;
    this.api.request(path, {
      method: 'DELETE',
      success: data => {
        AlertActions.addAlert({
          message: t('Events similar to these will no longer be filtered'),
          type: 'success'
        });
      },
      error: () => {
        AlertActions.addAlert({
          message: t('We were unable to discard this group'),
          type: 'error'
        });
      }
    });
    this.props.fetchData();
  },

  renderEmpty() {
    return <div className="box empty">{t('None')}</div>;
  },

  render() {
    if (this.props.tombstoneError) return <LoadingError />;

    let {tombstones, orgId, projectId} = this.props;
    return (
      <div>
        <div className="row" style={{paddingTop: 10}}>
          <div className="col-md-12 discarded-groups">
            <h5>{t('Discarded Groups')}</h5>
            {tombstones.length
              ? <ul className="group-list">
                  {tombstones.map(data => {
                    return (
                      <GroupTombstoneRow
                        key={data.id}
                        data={data}
                        orgId={orgId}
                        projectId={projectId}
                        undiscard={this.undiscard}
                      />
                    );
                  })}
                </ul>
              : this.renderEmpty()}
          </div>
        </div>
      </div>
    );
  }
});

export default GroupTombstones;
