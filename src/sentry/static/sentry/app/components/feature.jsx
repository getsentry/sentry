import PropTypes from 'prop-types';
import React from 'react';
import Reflux from 'reflux';
import createReactClass from 'create-react-class';

import {t} from 'app/locale';
import Alert from 'app/components/alert';
import ConfigStore from 'app/stores/configStore';
import SentryTypes from 'app/sentryTypes';

const DEFAULT_NO_FEATURE_MESSAGE = (
  <Alert type="info" icon="icon-circle-info">
    {t('This feature is coming soon!')}
  </Alert>
);

/**
 * Interface to handle feature tags as well as user's organization access levels
 */
class Feature extends React.Component {
  static propTypes = {
    organization: SentryTypes.Organization,
    project: SentryTypes.Project,
    /**
     * Configuration features from ConfigStore
     */
    configFeatures: PropTypes.arrayOf(PropTypes.string),

    /**
     * User Configuration from ConfigStore
     */
    configUser: PropTypes.object,

    /**
     * List of required feature tags. Note we do not enforce uniqueness of tags anywhere.
     * On the backend end, feature tags have a scope prefix string that is stripped out on the
     * frontend (since feature tags are attached to a context object).
     *
     * Use `organization:` or `project:` prefix strings to specify a feature with context.
     */
    feature: PropTypes.arrayOf(PropTypes.string),

    /**
     * List of required access levels
     */
    access: PropTypes.arrayOf(PropTypes.string),

    /**
     * Requires superuser
     */
    isSuperuser: PropTypes.bool,

    /**
     * Custom renderer function for "no feature" message OR `true` to use default message.
     * `false` will suppress message.
     */
    renderNoFeatureMessage: PropTypes.oneOfType([PropTypes.func, PropTypes.bool]),

    /**
     * If children is a function then will be treated as a render prop and passed this object:
     * {
     *   hasFeature: bool,
     *   hasAccess: bool,
     * }
     *
     * The other interface is more simple, only show `children` if org/project has
     * all the required feature AND access tags
     */
    children: PropTypes.oneOfType([PropTypes.func, PropTypes.node]),
  };

  static defaultProps = {
    renderNoFeatureMessage: false,
  };

  getAllFeatures = () => {
    let {organization, project, configFeatures} = this.props;
    return {
      configFeatures: configFeatures || [],
      organization: (organization && organization.features) || [],
      project: (project && project.features) || [],
    };
  };

  hasFeature = (feature, features) => {
    let shouldMatchOnlyProject = feature.match(/^project:(\w+)/);
    let shouldMatchOnlyOrg = feature.match(/^organization:(\w+)/);

    // Array of feature strings
    let {configFeatures, organization, project} = features;

    if (shouldMatchOnlyProject) {
      return project.includes(shouldMatchOnlyProject[1]);
    }

    if (shouldMatchOnlyOrg) {
      return organization.includes(shouldMatchOnlyOrg[1]);
    }

    // default, check all feature arrays
    return (
      configFeatures.includes(feature) ||
      organization.includes(feature) ||
      project.includes(feature)
    );
  };

  render() {
    let {
      children,
      organization,
      feature,
      access,
      configUser,
      isSuperuser,
      renderNoFeatureMessage,
    } = this.props;
    let {access: orgAccess} = organization || {access: []};
    let allFeatures = this.getAllFeatures();
    let hasFeature =
      !feature || feature.every(feat => this.hasFeature(feat, allFeatures));
    let hasAccess = !access || access.every(acc => orgAccess.includes(acc));
    let hasSuperuser = !isSuperuser || configUser.isSuperuser;
    let renderProps = {
      hasFeature,
      hasAccess,
      hasSuperuser,
    };

    if (!hasFeature && typeof renderNoFeatureMessage === 'function') {
      return renderNoFeatureMessage(renderProps);
    } else if (!hasFeature && renderNoFeatureMessage) {
      return DEFAULT_NO_FEATURE_MESSAGE;
    }

    if (typeof children === 'function') {
      return children(renderProps);
    }

    // if children is NOT a function,
    // then only render `children` iff `features` and `access` passes
    if (hasFeature && hasAccess && hasSuperuser) {
      return children;
    }

    return null;
  }
}

const FeatureContainer = createReactClass({
  displayName: 'FeatureContainer',
  contextTypes: {
    organization: SentryTypes.Organization,
    project: SentryTypes.Project,
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
    // TODO(billy): We can derive org/project from latestContextStore if needed, but
    // let's keep it simple for now and use org/project from context
    let features = this.state.config.features
      ? Array.from(this.state.config.features)
      : [];
    let user = this.state.config.user || {};

    return (
      <Feature
        configFeatures={features}
        configUser={user}
        organization={this.context.organization}
        project={this.context.project}
        {...this.props}
      />
    );
  },
});

export default FeatureContainer;
