import {Flex} from 'grid-emotion';
import PropTypes from 'prop-types';
import React from 'react';
import Reflux from 'reflux';
import createReactClass from 'create-react-class';
import styled from 'react-emotion';

import {t} from 'app/locale';
import Alert from 'app/components/alert';
import Button from 'app/components/buttons/button';
import ConfigStore from 'app/stores/configStore';
import InlineSvg from 'app/components/inlineSvg';
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
     * Displays a background tint (ONLY FOR SUPERUSERS ATM)
     * TODO: This might need to be a string
     */
    tint: PropTypes.bool,
    showSuperuserNotice: PropTypes.bool,

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
     *   hasSuperuser: bool,
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
      tint,
      showSuperuserNotice,
    } = this.props;
    let {access: orgAccess} = organization || {access: []};
    let allFeatures = this.getAllFeatures();

    // These check if the user has the correct features/access, regardless if
    // the corresponding props are passed (e.g. hasFeature will be false even if
    // you don't pass a `feature` prop as requirement).
    //
    // This doesn't necessarily mean we won't render `children` when the below are false
    let hasFeature =
      !!feature && feature.every(feat => this.hasFeature(feat, allFeatures));
    let hasAccess = !!access && access.every(acc => orgAccess.includes(acc));
    let hasSuperuser = !!configUser && !!configUser.isSuperuser;

    let hasRenderFunction = typeof children === 'function';

    // if the properties `feature`, `access`, and/or `isSuperuser` are defined AND the respective check passes
    // e.g. we should continue to render if `feature` is not defined since we don't need to check it (regardless of
    // the value of `hasFeature`)
    let passesFeatureRequirement = typeof feature === 'undefined' || hasFeature;
    let passesAccessRequirement = typeof access === 'undefined' || hasAccess;
    let passesSuperuserRequirement = typeof isSuperuser === 'undefined' || hasSuperuser;

    // Passes all requirements?
    let passesRequirements =
      passesFeatureRequirement && passesAccessRequirement && passesSuperuserRequirement;

    // Render props to pass to `children` render function
    let renderProps = {
      hasFeature,
      hasAccess,
      hasSuperuser,

      // also pass relevant props (even those these are the same as what user passes in right now)
      feature,
      access,
      isSuperuser,
    };

    // If `feature` prop is defined and `hasFeature` is false, then it means the user does not have
    // required feature flag. Display missing feature flag message
    if (feature && !hasFeature && typeof renderNoFeatureMessage === 'function') {
      return renderNoFeatureMessage(renderProps);
    } else if (!hasFeature && renderNoFeatureMessage) {
      return DEFAULT_NO_FEATURE_MESSAGE;
    }

    // Render nothing if no render prop AND requirements do not pass
    if (!passesRequirements && !hasRenderFunction) {
      return null;
    }

    // Default render a wrapped item
    return (
      <FeatureWrapper
        tint={tint}
        hasSuperuser={hasSuperuser}
        showSuperuserNotice={showSuperuserNotice}
      >
        {hasRenderFunction ? children(renderProps) : children}
      </FeatureWrapper>
    );
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

const FeatureWrapper = styled(
  class FeatureWrapperComponent extends React.Component {
    static propTypes = {
      hasSuperuser: PropTypes.bool,
      tint: PropTypes.bool,
      showSuperuserNotice: PropTypes.bool,
    };

    static defaultProps = {
      hasSuperuser: false,
      showSuperuserNotice: false,
    };

    constructor(props) {
      super(props);
      this.state = {hidden: false};
    }

    handleClose = () => {
      this.setState({hidden: true});
    };

    render() {
      let {className, children, tint, showSuperuserNotice, hasSuperuser} = this.props;

      // XXX: Currently only display tint for superuseres
      if (!hasSuperuser || !tint || this.state.hidden) {
        return children;
      }

      return (
        <div className={className}>
          {showSuperuserNotice && (
            <Notice>
              <Flex flex={1} align="center">
                <NoticeIcon src="icon-circle-exclamation" />
                This is feature tagged (you are seeing this because you are a superuser).
              </Flex>

              <Button icon="icon-close" size="small" onClick={this.handleClose} />
            </Notice>
          )}
          {children}
        </div>
      );
    }
  }
)`
  display: flex;
  flex: 1;
  flex-direction: column;
  position: relative;
  box-shadow: inset 0 0 6px blue;
  &::before {
    content: '';
    background-color: rgba(0, 0, 0, 0.25);
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
  }
`;

const Notice = styled('div')`
  background-color: rgba(255, 255, 255, 0.85);
  font-weight: bold;
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  padding: 2px;
  font-size: 16px;
  display: flex;
  align-items: center;
`;
const NoticeIcon = styled(InlineSvg)`
  margin-right: 6px;
`;
export default FeatureContainer;
