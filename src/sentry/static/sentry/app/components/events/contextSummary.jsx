import PropTypes from 'prop-types';
import React from 'react';

import UserAvatar from 'app/components/avatar/userAvatar';
import DeviceName from 'app/components/deviceName';
import {removeFilterMaskedEntries} from 'app/components/events/interfaces/utils';
import SentryTypes from 'app/sentryTypes';
import {t} from 'app/locale';
import {objectIsEmpty} from 'app/utils';

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
        <h3 data-test-id="no-summary-title">{this.props.title}</h3>
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
    const data = this.props.data;

    if (objectIsEmpty(data) || !data.name) {
      return <NoSummary title={this.props.unknownTitle} />;
    }

    const className = generateClassName(data.name);

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
    const data = this.props.data;

    if (objectIsEmpty(data) || !data.name) {
      return <NoSummary title={t('Unknown OS')} />;
    }

    const className = generateClassName(data.name);
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

export class UserSummary extends React.Component {
  static propTypes = {
    data: PropTypes.object.isRequired,
  };

  render() {
    const user = removeFilterMaskedEntries(this.props.data);

    if (objectIsEmpty(user)) {
      return <NoSummary title={t('Unknown User')} />;
    }

    const userTitle = user.email
      ? user.email
      : user.ip_address || user.id || user.username;

    if (!userTitle) {
      return <NoSummary title={t('Unknown User')} />;
    }

    return (
      <div className="context-item user">
        {userTitle ? (
          <UserAvatar
            user={user}
            size={48}
            className="context-item-icon"
            gravatar={false}
          />
        ) : (
          <span className="context-item-icon" />
        )}
        <h3 data-test-id="user-title">{userTitle}</h3>
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
    const data = this.props.data;

    if (objectIsEmpty(data)) {
      return <NoSummary title={t('Unknown Device')} />;
    }

    // TODO(dcramer): we need a better way to parse it
    const className = data.model && generateClassName(data.model);

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
        <h3>
          {data.model ? <DeviceName>{data.model}</DeviceName> : t('Unknown Device')}
        </h3>
        {subTitle}
      </div>
    );
  }
}

export class GpuSummary extends React.Component {
  static propTypes = {
    data: PropTypes.object.isRequired,
  };

  render() {
    const data = this.props.data;

    if (objectIsEmpty(data) || !data.name) {
      return <NoSummary title={t('Unknown GPU')} />;
    }

    let className = generateClassName(data.name);
    let versionElement = null;

    if (data.vendor_name) {
      className = generateClassName(data.vendor_name);
      versionElement = (
        <p>
          <strong>{t('Vendor:')}</strong> {data.vendor_name}
        </p>
      );
    } else {
      versionElement = (
        <p>
          <strong>{t('Vendor:')}</strong> {t('Unknown')}
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

const MIN_CONTEXTS = 3;
const MAX_CONTEXTS = 4;
const KNOWN_CONTEXTS = [
  {keys: ['user'], Component: UserSummary},
  {keys: ['browser'], Component: GenericSummary, unknownTitle: t('Unknown Browser')},
  {keys: ['runtime'], Component: GenericSummary, unknownTitle: t('Unknown Runtime')},
  {keys: ['client_os', 'os'], Component: OsSummary},
  {keys: ['device'], Component: DeviceSummary},
  {keys: ['gpu'], Component: GpuSummary},
];

class EventContextSummary extends React.Component {
  static propTypes = {
    event: SentryTypes.Event.isRequired,
  };

  render() {
    const evt = this.props.event;
    let contextCount = 0;

    // Add defined contexts in the declared order, until we reach the limit
    // defined by MAX_CONTEXTS.
    let contexts = KNOWN_CONTEXTS.map(({keys, Component, ...props}) => {
      if (contextCount >= MAX_CONTEXTS) {
        return null;
      }

      const [key, data] = keys
        .map(k => [k, evt.contexts[k] || evt[k]])
        .find(([_k, d]) => !objectIsEmpty(d)) || [null, null];

      if (!key) {
        return null;
      }

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
      contexts = KNOWN_CONTEXTS.map(({keys, Component, ...props}, index) => {
        if (contexts[index]) {
          return contexts[index];
        }
        if (contextCount >= MIN_CONTEXTS) {
          return null;
        }
        contextCount += 1;
        return <Component key={keys[0]} data={{}} {...props} />;
      });
    }

    return <div className="context-summary">{contexts}</div>;
  }
}

export default EventContextSummary;
