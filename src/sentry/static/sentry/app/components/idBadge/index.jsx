import React from 'react';
import styled from '@emotion/styled';

import ErrorBoundary from 'app/components/errorBoundary';
import BaseBadge from 'app/components/idBadge/baseBadge';
import MemberBadge from 'app/components/idBadge/memberBadge';
import UserBadge from 'app/components/idBadge/userBadge';
import TeamBadge from 'app/components/idBadge/teamBadge';
import ProjectBadge from 'app/components/idBadge/projectBadge';
import OrganizationBadge from 'app/components/idBadge/organizationBadge';

const COMPONENT_MAP = new Map([
  ['organization', OrganizationBadge],
  ['project', ProjectBadge],
  ['member', MemberBadge],
  ['user', UserBadge],
  ['team', TeamBadge],
]);

/**
 * Public interface for all "id badges":
 * Organization, project, team, user
 */
export default class IdBadge extends React.Component {
  static propTypes = {
    ...BaseBadge.propTypes,
  };

  render() {
    // Given the set of sentry types, find the prop name that was passed to this component,
    // of which we have a mapped component for
    const propNameWithData = Object.keys(this.props).find(key => COMPONENT_MAP.has(key));

    if (!propNameWithData) {
      throw new Error(
        'IdBadge: required property missing (organization, project, team, member, user) or misconfigured'
      );
    }

    const Component = COMPONENT_MAP.get(propNameWithData);

    return (
      <InlineErrorBoundary mini>
        <Component {...this.props} />
      </InlineErrorBoundary>
    );
  }
}

const InlineErrorBoundary = styled(ErrorBoundary)`
  background-color: transparent;
  border-color: transparent;
  display: flex;
  align-items: center;
  margin-bottom: 0;
  box-shadow: none;
  padding: 0; /* Because badges dont have any padding, so this should make the boundary fit well */
`;
