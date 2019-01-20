import PropTypes from 'prop-types';
import React from 'react';
import GroupEventDataSection from 'app/components/events/eventDataSection';
import SentryTypes from 'app/sentryTypes';
import RichHttpContent from 'app/components/events/interfaces/richHttpContent';
import {getCurlCommand} from 'app/components/events/interfaces/utils';
import {isUrl} from 'app/utils';
import {t} from 'app/locale';

import Truncate from 'app/components/truncate';

class RequestInterface extends React.Component {
  static propTypes = {
    group: SentryTypes.Group.isRequired,
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
    let group = this.props.group;
    let evt = this.props.event;
    let data = this.props.data;
    let view = this.state.view;

    let fullUrl = data.url;
    let parsedUrl = null;
    if (fullUrl) {
      if (data.query) {
        fullUrl += '?' + data.query;
      }
      if (data.fragment && fullUrl) {
        fullUrl += '#' + data.fragment;
      }

      if (!isUrl(fullUrl)) {
        // Check if the url passed in is a safe url to avoid XSS
        fullUrl = null;
      }
    }

    // check `fullUrl` again because of `isUrl` check
    if (fullUrl) {
      // use html tag to parse url, lol
      parsedUrl = document.createElement('a');
      parsedUrl.href = fullUrl;
    }

    let children = [];

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
        <a href={fullUrl} title={fullUrl}>
          <span className="path">
            <strong>{data.method || 'GET'}</strong>
            <Truncate
              value={parsedUrl ? parsedUrl.pathname : ''}
              maxLength={36}
              leftTrim={true}
            />
          </span>
          {fullUrl && (
            <span className="external-icon">
              <em className="icon-open" />
            </span>
          )}
        </a>
        <small style={{marginLeft: 10}} className="host">
          {parsedUrl ? parsedUrl.hostname : ''}
        </small>
      </h3>
    );

    let title = <div>{children}</div>;

    return (
      <GroupEventDataSection
        group={group}
        event={evt}
        type={this.props.type}
        title={title}
        wrapTitle={false}
        className="request"
      >
        {view === 'curl' ? (
          <pre>{getCurlCommand(data)}</pre>
        ) : (
          <RichHttpContent data={data} />
        )}
      </GroupEventDataSection>
    );
  }
}

export default RequestInterface;
