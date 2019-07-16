import {Link} from 'react-router';
import PropTypes from 'prop-types';
import React from 'react';
import createReactClass from 'create-react-class';
import moment from 'moment-timezone';

import {t} from 'app/locale';
import ConfigStore from 'app/stores/configStore';
import DateTime from 'app/components/dateTime';
import ExternalLink from 'app/components/links/externalLink';
import FileSize from 'app/components/fileSize';
import SentryTypes from 'app/sentryTypes';
import Tooltip from 'app/components/tooltip';
import getDynamicText from 'app/utils/getDynamicText';

const formatDateDelta = (reference, observed) => {
  const duration = moment.duration(Math.abs(+observed - +reference));
  const hours = Math.floor(+duration / (60 * 60 * 1000));
  const minutes = duration.minutes();
  const results = [];

  if (hours) {
    results.push(`${hours} hour${hours !== 1 ? 's' : ''}`);
  }

  if (minutes) {
    results.push(`${minutes} minute${minutes !== 1 ? 's' : ''}`);
  }

  if (results.length === 0) {
    results.push('a few seconds');
  }

  return results.join(', ');
};

const GroupEventToolbar = createReactClass({
  displayName: 'GroupEventToolbar',

  propTypes: {
    orgId: PropTypes.string.isRequired,
    group: SentryTypes.Group.isRequired,
    event: SentryTypes.Event.isRequired,
    location: PropTypes.object.isRequired,
  },

  shouldComponentUpdate(nextProps) {
    return this.props.event.id !== nextProps.event.id;
  },

  getDateTooltip() {
    const evt = this.props.event;
    const user = ConfigStore.get('user');
    const options = user ? user.options : {};
    const format = options.clock24Hours ? 'HH:mm:ss z' : 'LTS z';
    const dateCreated = moment(evt.dateCreated);
    const dateReceived = evt.dateReceived ? moment(evt.dateReceived) : null;

    return (
      <dl className="flat" style={{textAlign: 'left', margin: 0, minWidth: '200px'}}>
        <dt>Occurred</dt>
        <dd>
          {dateCreated.format('ll')}
          <br />
          {dateCreated.format(format)}
        </dd>
        {dateReceived && (
          <React.Fragment>
            <dt>Received</dt>
            <dd>
              {dateReceived.format('ll')}
              <br />
              {dateReceived.format(format)}
            </dd>
            <dt>Latency</dt>
            <dd>{formatDateDelta(dateCreated, dateReceived)}</dd>
          </React.Fragment>
        )}
      </dl>
    );
  },

  render() {
    const evt = this.props.event;

    const {orgId, location} = this.props;
    const groupId = this.props.group.id;

    const baseEventsPath = `/organizations/${orgId}/issues/${groupId}/events/`;

    const eventNavNodes = [
      evt.previousEventID ? (
        <Link
          key="oldest"
          to={{pathname: `${baseEventsPath}oldest/`, query: location.query}}
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
          to={{
            pathname: `${baseEventsPath}${evt.previousEventID}/`,
            query: location.query,
          }}
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
          to={{pathname: `${baseEventsPath}${evt.nextEventID}/`, query: location.query}}
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
          to={{pathname: `${baseEventsPath}latest/`, query: location.query}}
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
    const jsonUrl = `/organizations/${orgId}/issues/${groupId}/events/${evt.id}/json/`;
    const style = {
      borderBottom: '1px dotted #dfe3ea',
    };

    const latencyThreshold = 30 * 60 * 1000; // 30 minutes
    const isOverLatencyThreshold =
      evt.dateReceived &&
      Math.abs(+moment(evt.dateReceived) - +moment(evt.dateCreated)) > latencyThreshold;

    return (
      <div className="event-toolbar">
        <div className="pull-right">
          <div className="btn-group">{eventNavNodes}</div>
        </div>
        <h4>
          {t('Event')}{' '}
          <Link to={`${baseEventsPath}${evt.id}/`} className="event-id">
            {evt.eventID}
          </Link>
        </h4>
        <span>
          <Tooltip title={this.getDateTooltip()}>
            <span>
              <DateTime
                date={getDynamicText({value: evt.dateCreated, fixed: 'Dummy timestamp'})}
                style={style}
              />
              {isOverLatencyThreshold && <span className="icon-alert" />}
            </span>
          </Tooltip>
          <ExternalLink href={jsonUrl} className="json-link">
            {'JSON'} (<FileSize bytes={evt.size} />)
          </ExternalLink>
        </span>
      </div>
    );
  },
});

export default GroupEventToolbar;
