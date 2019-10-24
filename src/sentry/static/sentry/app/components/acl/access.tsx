import PropTypes from 'prop-types';
import React from 'react';

import {t} from 'app/locale';
import {Config, Organization, User} from 'app/types';
import Alert from 'app/components/alert';
import SentryTypes from 'app/sentryTypes';
import withConfig from 'app/utils/withConfig';
import withOrganization from 'app/utils/withOrganization';

const DEFAULT_NO_ACCESS_MESSAGE = (
  <Alert type="error" icon="icon-circle-info">
    {t('You do not have sufficient permissions to access this.')}
  </Alert>
);

// Props that function children will get.
export type ChildRenderProps = {
  hasAccess: boolean;
  hasSuperuser: boolean;
};

type ChildFunction = (props: ChildRenderProps) => null | React.ReactNode;

// Type guard for render func.
function isRenderFunc(func: React.ReactNode | Function): func is ChildFunction {
  return typeof func === 'function';
}

type DefaultProps = {
  /**
   * Should the component require all access levels or just one or more.
   */
  requireAll?: boolean;

  /**
   * Requires superuser
   */
  isSuperuser?: boolean;

  /**
   * Custom renderer function for "no access" message OR `true` to use
   * default message. `false` will suppress message.
   */
  renderNoAccessMessage: ChildFunction | boolean;

  /**
   * List of required access levels
   */
  access?: string[];
};

const defaultProps: DefaultProps = {
  renderNoAccessMessage: false,
  isSuperuser: false,
  requireAll: true,
  access: [],
};

type Props = {
  /**
   * Current Organization
   */
  organization: Organization;
  /**
   * User Configuration from ConfigStore
   */
  configUser: User;

  /**
   * Children can be a node or a function as child.
   */
  children?: React.ReactNode | ChildFunction;
} & Partial<DefaultProps>;

/**
 * Component to handle access restrictions.
 */
class Access extends React.Component<Props> {
  static propTypes = {
    organization: SentryTypes.Organization,
    configUser: PropTypes.object,
    access: PropTypes.arrayOf(PropTypes.string),
    requireAll: PropTypes.bool,
    isSuperuser: PropTypes.bool,
    renderNoAccessMessage: PropTypes.oneOfType([PropTypes.func, PropTypes.bool]),
    children: PropTypes.oneOfType([PropTypes.func, PropTypes.node]),
  };

  static defaultProps = defaultProps;

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

    const renderProps: ChildRenderProps = {
      hasAccess,
      hasSuperuser,
    };

    const render = hasAccess && (!isSuperuser || hasSuperuser);

    if (!render && typeof renderNoAccessMessage === 'function') {
      return renderNoAccessMessage(renderProps);
    } else if (!render && renderNoAccessMessage) {
      return DEFAULT_NO_ACCESS_MESSAGE;
    }

    if (isRenderFunc(children)) {
      return children(renderProps);
    }

    return render ? children : null;
  }
}

type ContainerProps = {
  config: Config;
  organization: Organization;
} & Omit<Props, 'configUser'>;

class AccessContainer extends React.Component<ContainerProps> {
  static propTypes = {
    config: SentryTypes.Config,
  };

  render() {
    const user = this.props.config.user || {};
    return <Access configUser={user} {...this.props} />;
  }
}

export default withConfig(withOrganization(AccessContainer));
