import PropTypes from 'prop-types';
import React from 'react';
import Reflux from 'reflux';
import createReactClass from 'create-react-class';

import {t} from 'app/locale';
import Alert from 'app/components/alert';
import ConfigStore from 'app/stores/configStore';
import SentryTypes from 'app/sentryTypes';

const DEFAULT_NO_ACCESS_MESSAGE = (
  <Alert type="error" icon="icon-circle-info">
    {t('You do not have sufficient permissions to access this.')}
  </Alert>
);

/**
 * Component to handle access restrictions.
 */
class Access extends React.Component {
  static propTypes = {
    organization: SentryTypes.Organization,

    /**
     * User Configuration from ConfigStore
     */
    configUser: PropTypes.object,

    /**
     * List of required access levels
     */
    access: PropTypes.arrayOf(PropTypes.string),

    /**
     * Should the component require all access levels or just one or more.
     */
    requireAll: PropTypes.bool,

    /**
     * Requires superuser
     */
    isSuperuser: PropTypes.bool,

    /**
     * Custom renderer function for "no access" message OR `true` to use
     * default message. `false` will suppress message.
     */
    renderNoAccessMessage: PropTypes.oneOfType([PropTypes.func, PropTypes.bool]),

    /**
     * If children is a function then will be treated as a render prop and
     * passed this object:
     *
     *   {
     *     hasAccess: bool,
     *     isSuperuser: bool,
     *   }
     *
     * The other interface is more simple, only show `children` if the user has
     * the correct access.
     */
    children: PropTypes.oneOfType([PropTypes.func, PropTypes.node]),
  };

  static defaultProps = {
    renderNoAccessMessage: false,
    requireAll: true,
    access: [],
  };

  render() {
    const {
      organization,
      configUser,
      access,
      requireAll,
      isSuperuser,
      renderNoAccessMessage,
      children,
    } = this.props;

    const {access: orgAccess} = organization || {access: []};
    const method = requireAll ? 'every' : 'some';

    const hasAccess = !access || access[method](acc => orgAccess.includes(acc));
    const hasSuperuser = !!configUser.isSuperuser;

    const renderProps = {
      hasAccess,
      hasSuperuser,
    };

    const render = hasAccess && (!isSuperuser || hasSuperuser);

    if (!render && typeof renderNoAccessMessage === 'function') {
      return renderNoAccessMessage(renderProps);
    } else if (!render && renderNoAccessMessage) {
      return DEFAULT_NO_ACCESS_MESSAGE;
    }

    if (typeof children === 'function') {
      return children(renderProps);
    }

    return render ? children : null;
  }
}

const AccessContainer = createReactClass({
  displayName: 'AccessContainer',

  // TODO(billy): We can derive org from latestContextStore if needed, but
  // let's keep it simple for now and use the org from context
  contextTypes: {
    organization: SentryTypes.Organization,
  },

  mixins: [Reflux.listenTo(ConfigStore, 'onConfigStoreUpdate')],

  getInitialState() {
    return {
      config: ConfigStore.getConfig() || {},
    };
  },

  onConfigStoreUpdate(config) {
    if (config === this.state.config) return;
    this.setState({config});
  },

  render() {
    const user = this.state.config.user || {};

    return (
      <Access
        configUser={user}
        organization={this.context.organization}
        {...this.props}
      />
    );
  },
});

export default AccessContainer;
