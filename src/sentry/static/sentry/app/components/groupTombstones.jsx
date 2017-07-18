import React from 'react';

import AlertActions from '../actions/alertActions';

import LoadingError from '../components/loadingError';
import LinkWithConfirmation from '../components/linkWithConfirmation';

import ApiMixin from '../mixins/apiMixin';

import {t, tct} from '../locale';

const GroupTombstoneRow = React.createClass({
  propTypes: {
    data: React.PropTypes.object.isRequired,
    undiscard: React.PropTypes.func.isRequired
  },
  render() {
    let {data, undiscard} = this.props;
    return (
      <li className={`group row level-${data.level} type-${data.type}`}>
        <div className="col-md-7 col-xs-8 event-details">
          <div>
            <h3 className="truncate">
              <span className="error-level truncate" title={data.level}>
                {data.level}
              </span>
              <span>
                <span style={{marginRight: 10}}>{data.type}</span>
                <em>{data.culprit}</em><br />
              </span>
            </h3>
            <div className="event-message truncate">
              <span className="message">{data.message}</span>
            </div>
            <div className="event-extra">

              <LinkWithConfirmation
                title={t('Undiscard')}
                className="btn btn-warning btn-xs"
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
                <span>{t('Undiscard')}</span>
              </LinkWithConfirmation>
              {data.actor &&
                <span style={{marginLeft: 10}} className="event-message actor">
                  {tct('discarded by [actor]', {actor: data.actor.name})}
                </span>}
            </div>
          </div>
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

    let {tombstones} = this.props;
    return (
      <div>
        <div className="row" style={{paddingTop: 10}}>
          <div className="col-sm-8">
            <h5>{t('Discarded Groups')}</h5>
            {tombstones.length
              ? <ul className="group-list">
                  {tombstones.map(data => {
                    return (
                      <GroupTombstoneRow
                        key={data.id}
                        data={data}
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
