import React from 'react';
import PropTypes from 'prop-types';

import SentryTypes from 'app/proptypes';

/**
 * Interface to handle feature tags as well as user's organization access levels
 */
class Feature extends React.Component {
  static propTypes = {
    organization: SentryTypes.Organization,
    project: SentryTypes.Project,
    /**
     * List of required feature tags
     */
    feature: PropTypes.arrayOf(PropTypes.string),
    /**
     * List of required access levels
     */
    access: PropTypes.arrayOf(PropTypes.string),
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

  render() {
    let {children, organization, project, feature, access} = this.props;
    let allFeatures = []
      .concat((organization && organization.features) || [])
      .concat((project && project.features) || []);
    let {access: orgAccess} = organization || {access: []};
    let hasFeature = !feature || feature.every(feat => allFeatures.includes(feat));
    let hasAccess = !access || access.every(acc => orgAccess.includes(acc));

    if (typeof children === 'function') {
      return children({
        hasFeature,
        hasAccess,
      });
    }

    // if children is NOT a function,
    // then only render `children` iff `features` and `access` passes
    if (hasFeature && hasAccess) {
      return children;
    }

    return null;
  }
}

export default class FeatureContainer extends React.Component {
  static contextTypes = {
    organization: SentryTypes.Organization,
    project: SentryTypes.Project,
  };

  render() {
    return (
      <Feature
        organization={this.context.organization}
        project={this.context.project}
        {...this.props}
      />
    );
  }
}
