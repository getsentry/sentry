import PropTypes from 'prop-types';
import React from 'react';

import Avatar from 'app/components/avatar';
import SentryTypes from 'app/proptypes';
import {t} from 'app/locale';
import {objectIsEmpty, deviceNameMapper} from 'app/utils';

const generateClassName = function(name) {
  return name
    .split(/\d/)[0]
    .toLowerCase()
    .replace(/[^a-z0-9\-]+/g, '-')
    .replace(/\-+$/, '')
    .replace(/^\-+/, '');
};

class NoSummary extends React.Component {
  static propTypes = {
    title: PropTypes.string.isRequired,
  };

  render() {
    return (
      <div className="context-item">
        <span className="context-item-icon" />
        <h3>{this.props.title}</h3>
      </div>
    );
  }
}

class GenericSummary extends React.Component {
  static propTypes = {
    data: PropTypes.object.isRequired,
    unknownTitle: PropTypes.string.isRequired,
  };

  render() {
    let data = this.props.data;

    if (objectIsEmpty(data) || !data.name) {
      return <NoSummary title={this.props.unknownTitle} />;
    }

    let className = generateClassName(data.name);

    return (
      <div className={`context-item ${className}`}>
        <span className="context-item-icon" />
        <h3>{data.name}</h3>
        <p>
          <strong>{t('Version:')}</strong> {data.version || t('Unknown')}
        </p>
      </div>
    );
  }
}

export class OsSummary extends React.Component {
  static propTypes = {
    data: PropTypes.object.isRequired,
  };

  render() {
    let data = this.props.data;

    if (objectIsEmpty(data) || !data.name) {
      return <NoSummary title={t('Unknown OS')} />;
    }

    let className = generateClassName(data.name);
    let versionElement = null;

    if (data.version) {
      versionElement = (
        <p>
          <strong>{t('Version:')}</strong> {data.version}
        </p>
      );
    } else if (data.kernel_version) {
      versionElement = (
        <p>
          <strong>{t('Kernel:')}</strong> {data.kernel_version}
        </p>
      );
    } else {
      versionElement = (
        <p>
          <strong>{t('Version:')}</strong> {t('Unknown')}
        </p>
      );
    }

    return (
      <div className={`context-item ${className}`}>
        <span className="context-item-icon" />
        <h3>{data.name}</h3>
        {versionElement}
      </div>
    );
  }
}

class UserSummary extends React.Component {
  static propTypes = {
    data: PropTypes.object.isRequired,
  };

  render() {
    let user = this.props.data;

    if (objectIsEmpty(user)) {
      return <NoSummary title={t('Unknown User')} />;
    }

    let userTitle = user.email ? user.email : user.ip_address || user.id || user.username;

    if (!userTitle) {
      return <NoSummary title={t('Unknown User')} />;
    }

    return (
      <div className="context-item user">
        {userTitle ? (
          <Avatar user={user} size={48} className="context-item-icon" gravatar={false} />
        ) : (
          <span className="context-item-icon" />
        )}
        <h3>{userTitle}</h3>
        {user.id && user.id !== userTitle ? (
          <p>
            <strong>{t('ID:')}</strong> {user.id}
          </p>
        ) : (
          user.username &&
          user.username !== userTitle && (
            <p>
              <strong>{t('Username:')}</strong> {user.username}
            </p>
          )
        )}
      </div>
    );
  }
}

class DeviceSummary extends React.Component {
  static propTypes = {
    data: PropTypes.object.isRequired,
  };

  render() {
    let data = this.props.data;

    if (objectIsEmpty(data)) {
      return <NoSummary title={t('Unknown Device')} />;
    }

    // TODO(dcramer): we need a better way to parse it
    let className = data.model && generateClassName(data.model);

    let subTitle = <p />;

    if (data.arch) {
      subTitle = (
        <p>
          <strong>{t('Arch:')}</strong> {data.arch}
        </p>
      );
    } else if (data.model_id) {
      subTitle = (
        <p>
          <strong>{t('Model:')}</strong> {data.model_id}
        </p>
      );
    }

    return (
      <div className={`context-item ${className}`}>
        <span className="context-item-icon" />
        <h3>{data.model ? deviceNameMapper(data.model) : t('Unknown Device')}</h3>
        {subTitle}
      </div>
    );
  }
}

const MIN_CONTEXTS = 3;
const MAX_CONTEXTS = 4;
const KNOWN_CONTEXTS = [
  {key: 'user', Component: UserSummary},
  {key: 'browser', Component: GenericSummary, unknownTitle: t('Unknown Browser')},
  {key: 'runtime', Component: GenericSummary, unknownTitle: t('Unknown Runtime')},
  {key: 'os', Component: OsSummary},
  {key: 'device', Component: DeviceSummary},
];

class EventContextSummary extends React.Component {
  static propTypes = {
    event: SentryTypes.Event.isRequired,
  };

  render() {
    let evt = this.props.event;
    let contextCount = 0;

    // Add defined contexts in the declared order, until we reach the limit
    // defined by MAX_CONTEXTS.
    let contexts = KNOWN_CONTEXTS.map(({key, Component, ...props}) => {
      if (contextCount >= MAX_CONTEXTS) return null;
      let data = evt.contexts[key] || evt[key];
      if (objectIsEmpty(data)) return null;
      contextCount += 1;
      return <Component key={key} data={data} {...props} />;
    });

    // Bail out if all contexts are empty or only the user context is set
    if (contextCount === 0 || (contextCount === 1 && contexts[0])) {
      return null;
    }

    if (contextCount < MIN_CONTEXTS) {
      // Add contents in the declared order until we have at least MIN_CONTEXTS
      // contexts in our list.
      contexts = KNOWN_CONTEXTS.map(({key, Component, ...props}, index) => {
        if (contexts[index]) return contexts[index];
        if (contextCount >= MIN_CONTEXTS) return null;
        contextCount += 1;
        return <Component key={key} data={{}} {...props} />;
      });
    }

    return <div className="context-summary">{contexts}</div>;
  }
}

export default EventContextSummary;
