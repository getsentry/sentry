import React from 'react';
import PropTypes from 'prop-types';
import styled, {css} from 'react-emotion';
import {Flex} from 'grid-emotion';

import SentryTypes from 'app/sentryTypes';
import Avatar from 'app/components/avatar';
import Tooltip from 'app/components/tooltip';

class BaseAvatarList extends React.Component {
  static propTypes = {
    items: PropTypes.arrayOf(PropTypes.shape({
      organization: SentryTypes.Organization,
      project: SentryTypes.Project,
      team: SentryTypes.Team,
      user: SentryTypes.User,
    })),
    avatarSize: PropTypes.number,
    maxVisibleAvatars: PropTypes.number,
    renderTooltip: PropTypes.func,
    tooltipOptions: PropTypes.object,
    typeMembers: PropTypes.string,
    round: PropTypes.bool,
  };

  static defaultProps = {
    avatarSize: 28,
    maxVisibleAvatars: 5,
    typeMembers: 'users',
  };

  render() {
    const {
      items,
      avatarSize,
      maxVisibleAvatars,
      tooltipOptions,
      renderTooltip,
      typeMembers,
      round,
    } = this.props;
    const visibleItems = items.slice(0, maxVisibleAvatars);
    const numCollapsedItems = items.length - visibleItems.length;
    return (
      <Flex direction="row-reverse">
        {!!numCollapsedItems && (
          <Tooltip title={`${numCollapsedItems} other ${typeMembers}`}>
            <CollapsedItems size={avatarSize}
              round={round}
            >
              {numCollapsedItems < 99 && <Plus>+</Plus>}
              {numCollapsedItems}
            </CollapsedItems>
          </Tooltip>
        )}
        {visibleItems.map(itemObj => {
          const [[type, item]] = Object.entries(itemObj);
          return (
            <StyledAvatar
              round={round}
              key={`${type}-${item.id || item.slug}`}
              {...itemObj}
              size={avatarSize}
              renderTooltip={renderTooltip}
              tooltipOptions={tooltipOptions}
              hasTooltip
            />
          );
        })}
      </Flex>
    );
  }
}

export default class AvatarList extends React.Component {
  static propTypes = {
    users: PropTypes.arrayOf(SentryTypes.User).isRequired,
  };

  render() {
    const {
      users,
      ...props,
    } = this.props;

    return (
      <BaseAvatarList typeMembers="users" items={users && users.map(user => ({user}))} {...props}/>
    );
  }
}

const Circle = (props) => css`
  border-radius: ${props.round ? '50%' : '3px'};
  border: 2px solid white;
  margin-left: -8px;
  cursor: default;

  &:hover {
    z-index: 1;
  }
`;

const StyledAvatar = styled(Avatar)`
  overflow: hidden;
  ${Circle};
`;

const CollapsedItems = styled('div')`
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  text-align: center;
  font-weight: 600;
  background-color: ${p => p.theme.borderLight};
  color: ${p => p.theme.gray2};
  font-size: ${p => Math.floor(p.size / 2.3)}px;
  width: ${p => p.size}px;
  height: ${p => p.size}px;
  ${Circle};
`;

const Plus = styled('span')`
  font-size: 10px;
  margin-left: 1px;
  margin-right: -1px;
`;
