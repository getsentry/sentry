import PropTypes from 'prop-types';
import React from 'react';
import EventDataSection from 'app/components/events/eventDataSection';
import SentryTypes from 'app/sentryTypes';
import RichHttpContent from 'app/components/events/interfaces/richHttpContent';
import {getFullUrl, getCurlCommand} from 'app/components/events/interfaces/utils';
import {isUrl} from 'app/utils';
import {t} from 'app/locale';
import ExternalLink from 'app/components/links/externalLink';

import Truncate from 'app/components/truncate';

class RequestInterface extends React.Component {
  static propTypes = {
    event: SentryTypes.Event.isRequired,
    type: PropTypes.string.isRequired,
    data: PropTypes.object.isRequired,
  };

  static contextTypes = {
    organization: SentryTypes.Organization,
    project: SentryTypes.Project,
  };

  constructor(...args) {
    super(...args);
    this.state = {
      view: 'formatted',
    };
  }

  isPartial = () => {
    // We assume we only have a partial interface is we're missing
    // an HTTP method. This means we don't have enough information
    // to reliably construct a full HTTP request.
    return !this.props.data.method || !this.props.data.url;
  };

  toggleView = value => {
    this.setState({
      view: value,
    });
  };

  render() {
    const {event, data, type} = this.props;
    const view = this.state.view;

    let fullUrl = getFullUrl(data);
    if (!isUrl(fullUrl)) {
      // Check if the url passed in is a safe url to avoid XSS
      fullUrl = null;
    }

    let parsedUrl = null;
    if (fullUrl) {
      // use html tag to parse url, lol
      parsedUrl = document.createElement('a');
      parsedUrl.href = fullUrl;
    }

    const children = [];

    if (!this.isPartial() && fullUrl) {
      children.push(
        <div key="view-buttons" className="btn-group">
          <a
            className={(view === 'formatted' ? 'active' : '') + ' btn btn-default btn-sm'}
            onClick={this.toggleView.bind(this, 'formatted')}
          >
            {/* Translators: this means "formatted" rendering (fancy tables) */
            t('Formatted')}
          </a>
          <a
            className={(view === 'curl' ? 'active' : '') + ' btn btn-default btn-sm'}
            onClick={this.toggleView.bind(this, 'curl')}
          >
            <code>{'curl'}</code>
          </a>
        </div>
      );
    }

    children.push(
      <h3 key="title">
        <ExternalLink href={fullUrl} title={fullUrl}>
          <span className="path">
            <strong>{data.method || 'GET'}</strong>
            <Truncate
              value={parsedUrl ? parsedUrl.pathname : ''}
              maxLength={36}
              leftTrim
            />
          </span>
          {fullUrl && (
            <span className="external-icon">
              <em className="icon-open" />
            </span>
          )}
        </ExternalLink>
        <small style={{marginLeft: 10}} className="host">
          {parsedUrl ? parsedUrl.hostname : ''}
        </small>
      </h3>
    );

    const title = <div>{children}</div>;

    return (
      <EventDataSection
        event={event}
        type={type}
        title={title}
        wrapTitle={false}
        className="request"
      >
        {view === 'curl' ? (
          <pre>{getCurlCommand(data)}</pre>
        ) : (
          <RichHttpContent data={data} />
        )}
      </EventDataSection>
    );
  }
}

export default RequestInterface;
