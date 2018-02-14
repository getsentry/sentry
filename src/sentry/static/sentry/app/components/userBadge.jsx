import PropTypes from 'prop-types';
import React from 'react';
import Avatar from './avatar';
import Link from './link';

const UserBadge = ({user, orgId}) => {
  return (
    <div>
      <Avatar user={user} size={80} />
      <h5>
        <Link to={`/settings/organization/${orgId}/members/${user.id}`}>
          {user.email}
        </Link>
      </h5>
      {user.email}
    </div>
  );
};

UserBadge.propTypes = {
  user: PropTypes.object,
  orgId: PropTypes.number,
};

export default UserBadge;
