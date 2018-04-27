import {Link} from 'react-router';
import moment from 'moment-timezone';
import PropTypes from 'prop-types';
import React from 'react';

import createReactClass from 'create-react-class';

import ConfigStore from 'app/stores/configStore';
import SentryTypes from 'app/proptypes';
import DateTime from 'app/components/dateTime';
import FileSize from 'app/components/fileSize';
import Tooltip from 'app/components/tooltip';
import {t} from 'app/locale';

let formatDateDelta = (reference, observed) => {
  let duration = moment.duration(Math.abs(+observed - +reference));
  let hours = Math.floor(+duration / (60 * 60 * 1000));
  let minutes = duration.minutes();
  let results = [];

  if (hours) {
    results.push(`${hours} hour${hours != 1 ? 's' : ''}`);
  }

  if (minutes) {
    results.push(`${minutes} minute${minutes != 1 ? 's' : ''}`);
  }

  if (results.length == 0) {
    results.push('a few seconds');
  }

  return results.join(', ');
};

let GroupEventToolbar = createReactClass({
  displayName: 'GroupEventToolbar',

  propTypes: {
    orgId: PropTypes.string.isRequired,
    projectId: PropTypes.string.isRequired,
    group: SentryTypes.Group.isRequired,
    event: SentryTypes.Event.isRequired,
  },

  shouldComponentUpdate(nextProps, nextState) {
    return this.props.event.id !== nextProps.event.id;
  },

  getDateTooltip() {
    let evt = this.props.event;
    let user = ConfigStore.get('user');
    let options = user ? user.options : {};
    let format = options.clock24Hours ? 'HH:mm:ss z' : 'LTS z';
    let dateCreated = moment(evt.dateCreated);
    let resp =
      '<dl class="flat" style="text-align:left;margin:0;min-width:200px">' +
      '<dt>Occurred</dt>' +
      '<dd>' +
      dateCreated.format('ll') +
      '<br />' +
      dateCreated.format(format) +
      '</dd>';
    if (evt.dateReceived) {
      let dateReceived = moment(evt.dateReceived);
      resp +=
        '<dt>Received</dt>' +
        '<dd>' +
        dateReceived.format('ll') +
        '<br />' +
        dateReceived.format(format) +
        '</dd>' +
        '<dt>Latency</dt>' +
        '<dd>' +
        formatDateDelta(dateCreated, dateReceived) +
        '</dd>';
    }
    return resp + '</dl>';
  },

  render() {
    let evt = this.props.event;

    let {orgId, projectId} = this.props;
    let groupId = this.props.group.id;

    let eventNavNodes = [
      evt.previousEventID ? (
        <Link
          key="oldest"
          to={`/${orgId}/${projectId}/issues/${groupId}/events/oldest/`}
          className="btn btn-default"
          title={t('Oldest')}
        >
          <span className="icon-skip-back" />
        </Link>
      ) : (
        <a key="oldest" className="btn btn-default disabled">
          <span className="icon-skip-back" />
        </a>
      ),
      evt.previousEventID ? (
        <Link
          key="prev"
          to={`/${orgId}/${projectId}/issues/${groupId}/events/${evt.previousEventID}/`}
          className="btn btn-default"
        >
          {t('Older')}
        </Link>
      ) : (
        <a key="prev" className="btn btn-default disabled">
          {t('Older')}
        </a>
      ),
      evt.nextEventID ? (
        <Link
          key="next"
          to={`/${orgId}/${projectId}/issues/${groupId}/events/${evt.nextEventID}/`}
          className="btn btn-default"
        >
          {t('Newer')}
        </Link>
      ) : (
        <a key="next" className="btn btn-default disabled">
          {t('Newer')}
        </a>
      ),
      evt.nextEventID ? (
        <Link
          key="latest"
          to={`/${orgId}/${projectId}/issues/${groupId}/events/latest/`}
          className="btn btn-default"
          title={t('Newest')}
        >
          <span className="icon-skip-forward" />
        </Link>
      ) : (
        <a key="latest" className="btn btn-default disabled">
          <span className="icon-skip-forward" />
        </a>
      ),
    ];

    // TODO: possible to define this as a route in react-router, but without a corresponding
    //       React component?
    let jsonUrl = `/${orgId}/${projectId}/issues/${groupId}/events/${evt.id}/json/`;
    let style = {
      borderBottom: '1px dotted #dfe3ea',
    };

    let latencyThreshold = 30 * 60 * 1000; // 30 minutes
    let isOverLatencyThreshold =
      evt.dateReceived &&
      Math.abs(+moment(evt.dateReceived) - +moment(evt.dateCreated)) > latencyThreshold;

    return (
      <div className="event-toolbar">
        <div className="pull-right">
          <div className="btn-group">{eventNavNodes}</div>
        </div>
        <h4>
          {t('Event')}{' '}
          <Link
            to={`/${orgId}/${projectId}/issues/${groupId}/events/${evt.id}/`}
            className="event-id"
          >
            {evt.eventID}
          </Link>
        </h4>
        <span>
          <Tooltip title={this.getDateTooltip()} tooltipOptions={{html: true}}>
            <span>
              <DateTime date={evt.dateCreated} style={style} />
              {isOverLatencyThreshold && <span className="icon-alert" />}
            </span>
          </Tooltip>
          <a href={jsonUrl} target="_blank" className="json-link">
            {'JSON'} (<FileSize bytes={evt.size} />)
          </a>
        </span>
      </div>
    );
  },
});

export default GroupEventToolbar;
