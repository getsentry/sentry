import PropTypes from 'prop-types';
import React from 'react';

import Avatar from 'app/components/avatar';

const GroupParticipants = props => {
  const participants = props.participants;

  return (
    <div>
      <h6>
        <span>
          {participants.length} {'Participant' + (participants.length === 1 ? '' : 's')}
        </span>
      </h6>
      <ul className="faces">
        {participants.map((user, i) => {
          return (
            <li key={user.username}>
              <Avatar size={28} user={user} hasTooltip />
            </li>
          );
        })}
      </ul>
    </div>
  );
};

GroupParticipants.propTypes = {
  participants: PropTypes.array.isRequired,
};

export default GroupParticipants;
