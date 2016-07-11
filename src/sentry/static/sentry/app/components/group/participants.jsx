import React from 'react';

import Avatar from '../avatar';

const GroupParticipants = React.createClass({
  propTypes: {
    participants: React.PropTypes.array.isRequired,
  },

  render() {
    let participants = this.props.participants;

    return (
      <div>
        <h6><span>{participants.length} {'Participant' +
                                         (participants.length === 1 ? '' : 's')}</span></h6>
        <ul className="faces">
          {participants.map((user) => {
            return (
              <li>
                <Avatar size={32} user={user} />
              </li>
            );
          })}
        </ul>
      </div>
    );
  },
});

export default GroupParticipants;
