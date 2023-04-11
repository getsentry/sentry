import styled from '@emotion/styled';

import ErrorBoundary from 'sentry/components/errorBoundary';

import getBadge, {GetBadgeProps} from './getBadge';

/**
 * Public interface for all "id badges":
 * Organization, project, team, user
 */

function IdBadge(props: GetBadgeProps) {
  const componentBadge = getBadge(props);

  if (!componentBadge) {
    throw new Error(
      'IdBadge: required property missing (organization, project, team, member, user) or misconfigured'
    );
  }

  return <InlineErrorBoundary mini>{componentBadge}</InlineErrorBoundary>;
}

export default IdBadge;

const InlineErrorBoundary = styled(ErrorBoundary)`
  background-color: transparent;
  border-color: transparent;
  display: flex;
  align-items: center;
  margin-bottom: 0;
  box-shadow: none;
  padding: 0; /* Because badges don't have any padding, so this should make the boundary fit well */
`;
