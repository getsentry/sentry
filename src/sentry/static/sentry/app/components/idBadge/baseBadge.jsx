import React from 'react';
import PropTypes from 'prop-types';
import styled from '@emotion/styled';

import Avatar from 'app/components/avatar';
import space from 'app/styles/space';
import overflowEllipsis from 'app/styles/overflowEllipsis';
import SentryTypes from 'app/sentryTypes';

const BasicModelShape = PropTypes.shape({slug: PropTypes.string});

class BaseBadge extends React.PureComponent {
  static propTypes = {
    team: PropTypes.oneOfType([BasicModelShape, SentryTypes.Team]),
    organization: PropTypes.oneOfType([BasicModelShape, SentryTypes.Organization]),
    project: PropTypes.oneOfType([BasicModelShape, SentryTypes.Project]),
    member: PropTypes.oneOfType([BasicModelShape, SentryTypes.Member]),
    user: PropTypes.oneOfType([BasicModelShape, SentryTypes.User]),

    /**
     * Avatar size
     */
    avatarSize: PropTypes.number,

    /**
     * Hides the avatar
     */
    hideAvatar: PropTypes.bool,

    /**
     * Additional props for Avatar component
     */
    avatarProps: PropTypes.object,

    /**
     * Hides the main display name
     */
    hideName: PropTypes.bool,

    className: PropTypes.string,
    displayName: PropTypes.node,
    description: PropTypes.node,
    avatarClassName: PropTypes.oneOfType([PropTypes.string, PropTypes.object]),
  };

  static defaultProps = {
    avatarProps: {},
    avatarSize: 24,
    hideAvatar: false,
  };

  render() {
    const {
      className,
      hideAvatar,
      hideName,
      avatarSize,
      avatarClassName,
      displayName,
      description,
      avatarProps,
      team,
      organization,
      project,
    } = this.props;

    const data = {
      team,
      organization,
      project,
    };

    return (
      <BaseBadgeWrapper className={className}>
        {!hideAvatar && (
          <StyledAvatar
            css={avatarClassName}
            size={avatarSize}
            hideName={hideName}
            {...(avatarProps || {})}
            {...data}
          />
        )}

        <DisplayNameAndDescription>
          {!hideName && (
            <DisplayName data-test-id="badge-display-name">{displayName}</DisplayName>
          )}
          {!!description && <Description>{description}</Description>}
        </DisplayNameAndDescription>
      </BaseBadgeWrapper>
    );
  }
}

const BaseBadgeWrapper = styled('div')`
  display: flex;
  align-items: center;
`;

export default BaseBadge;

const StyledAvatar = styled(Avatar)`
  margin-right: ${p => (p.hideName ? 0 : space(1))};
  flex-shrink: 0;
`;

const DisplayNameAndDescription = styled('div')`
  display: flex;
  flex-direction: column;
  line-height: 1;
  overflow: hidden;
`;

const DisplayName = styled('span')`
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.2;
`;

const Description = styled('div')`
  font-size: 0.875em;
  margin-top: ${space(0.25)};
  color: ${p => p.theme.gray500};
  line-height: 14px;
  ${overflowEllipsis};
`;
