import React from 'react';
import PropTypes from 'prop-types';
import styled from 'react-emotion';
import {Flex} from 'grid-emotion';

import Avatar from '../../components/avatar';

const MAX_VISIBLE_AVATARS = 5;
const AVATAR_SIZE = 28;

export default class TeamAvatars extends React.Component {
  static propTypes = {
    members: PropTypes.array.isRequired,
  };

  render() {
    const members = this.props.members.slice(0, MAX_VISIBLE_AVATARS);
    const numCollapsedMembers = this.props.members.length - members.length;

    return (
      <AvatarList>
        {members.map(member => {
          return <Avatar key={member.id} user={member} size={AVATAR_SIZE} />;
        })}
        {!!numCollapsedMembers && (
          <CollapsedMembers>{numCollapsedMembers}</CollapsedMembers>
        )}
      </AvatarList>
    );
  }
}

const AvatarList = styled(({...props}) => <Flex direction="row-reverse" {...props} />)`
  .avatar {
    border-radius: 50%;
    overflow: hidden;
    border: 2px solid #fcfcfc;
    margin-left: -12px;
  }
`;

const CollapsedMembers = styled.div`
  position: relative;
  text-align: center;
  font-weight: 600;
  background-color: ${p => p.theme.borderLight};
  color: ${p => p.theme.gray2};
  font-size: ${p => p.theme.fontSizeSmall}
  width: ${AVATAR_SIZE}px;
  height: ${AVATAR_SIZE}px;
  border-radius: 50%;
  border: 2px solid #fcfcfc;
`;
