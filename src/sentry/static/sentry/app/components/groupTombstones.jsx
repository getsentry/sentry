import PropTypes from 'prop-types';
import React from 'react';
import createReactClass from 'create-react-class';
import _ from 'lodash';

import Avatar from '../components/avatar';
import EventOrGroupHeader from '../components/eventOrGroupHeader';
import IndicatorStore from '../stores/indicatorStore';
import LoadingError from '../components/loadingError';
import LinkWithConfirmation from '../components/linkWithConfirmation';
import TooltipMixin from '../mixins/tooltip';

import ApiMixin from '../mixins/apiMixin';

import {t} from '../locale';

const GroupTombstoneRow = createReactClass({
  displayName: 'GroupTombstoneRow',

  propTypes: {
    data: PropTypes.object.isRequired,
    undiscard: PropTypes.func.isRequired,
    orgId: PropTypes.string.isRequired,
    projectId: PropTypes.string.isRequired,
  },

  mixins: [
    TooltipMixin({
      selector: '.tip',
    }),
  ],

  render() {
    let {data, undiscard} = this.props,
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
            <span className="tip" title={t('Discarded by %s', actor.name || actor.email)}>
              <Avatar user={data.actor} />
            </span>
          )}
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
              }}
            >
              <span className="icon-trash undiscard" />
            </LinkWithConfirmation>
          </span>
        </div>
      </li>
    );
  },
});

const GroupTombstones = createReactClass({
  displayName: 'GroupTombstones',

  propTypes: {
    orgId: PropTypes.string.isRequired,
    projectId: PropTypes.string.isRequired,
    tombstones: PropTypes.array.isRequired,
    tombstoneError: PropTypes.bool.isRequired,
    fetchData: PropTypes.func.isRequired,
  },

  mixins: [ApiMixin],

  undiscard(tombstoneId) {
    let {orgId, projectId} = this.props;
    let path = `/projects/${orgId}/${projectId}/tombstones/${tombstoneId}/`;
    this.api.request(path, {
      method: 'DELETE',
      success: data => {
        IndicatorStore.add(
          t('Events similar to these will no longer be filtered'),
          'success',
          {duration: 4000}
        );
      },
      error: () => {
        IndicatorStore.add(t('We were unable to undiscard this group'), 'error', {
          duration: 4000,
        });
      },
    });
    this.props.fetchData();
  },

  renderEmpty() {
    return <div className="box empty">{t('You have no discarded issues')}</div>;
  },

  render() {
    if (this.props.tombstoneError) return <LoadingError />;

    let {tombstones, orgId, projectId} = this.props;
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
                      undiscard={this.undiscard}
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
  },
});

export default GroupTombstones;
