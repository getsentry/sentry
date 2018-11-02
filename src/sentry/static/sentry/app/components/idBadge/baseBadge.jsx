import {Flex} from 'grid-emotion';
import React from 'react';
import PropTypes from 'prop-types';
import styled from 'react-emotion';

import Avatar from 'app/components/avatar';
import space from 'app/styles/space';
import overflowEllipsis from 'app/styles/overflowEllipsis';
import SentryTypes from 'app/sentryTypes';

class BaseBadge extends React.PureComponent {
  static propTypes = {
    team: SentryTypes.Team,
    organization: SentryTypes.Organization,
    project: SentryTypes.Project,

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
    let {
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

    let data = {
      team,
      organization,
      project,
    };

    return (
      <Flex align="center" className={className}>
        {!hideAvatar && (
          <StyledAvatar
            css={avatarClassName}
            size={avatarSize}
            {...avatarProps || {}}
            {...data}
          />
        )}

        <DisplayNameAndDescription>
          {!hideName && (
            <DisplayName data-test-id="badge-display-name">{displayName}</DisplayName>
          )}
          {!!description && <Description>{description}</Description>}
        </DisplayNameAndDescription>
      </Flex>
    );
  }
}

export default BaseBadge;

const StyledAvatar = styled(Avatar)`
  margin-right: ${space(1)};
  flex-shrink: 0;
`;

const DisplayNameAndDescription = styled(Flex)`
  flex-direction: column;
  line-height: 1;
  overflow: hidden;
`;

const DisplayName = styled('span')`
  overflow: hidden;
  text-overflow: ellipsis;
`;

const Description = styled('div')`
  font-size: 0.875em;
  margin-top: ${space(0.25)};
  color: ${p => p.theme.gray2};
  line-height: 14px;
  ${overflowEllipsis};
`;
