import * as PropTypes from 'prop-types';

const Avatar = PropTypes.shape({
  avatarType: PropTypes.oneOf(['letter_avatar', 'upload', 'gravatar']),
  avatarUuid: PropTypes.string,
});

const User = PropTypes.shape({
  avatar: Avatar,
  avatarUrl: PropTypes.string,
  dateJoined: PropTypes.string,
  email: PropTypes.string,
  emails: PropTypes.arrayOf(
    PropTypes.shape({
      is_verified: PropTypes.bool,
      id: PropTypes.string,
      email: PropTypes.string,
    })
  ),
  has2fa: PropTypes.bool,
  hasPasswordAuth: PropTypes.bool,
  id: PropTypes.string,
  identities: PropTypes.array,
  isActive: PropTypes.bool,
  isManaged: PropTypes.bool,
  lastActive: PropTypes.string,
  lastLogin: PropTypes.string,
  username: PropTypes.string,
});

/**
 * @deprecated
 */
const Group = PropTypes.shape({
  id: PropTypes.string.isRequired,
  annotations: PropTypes.array,
  assignedTo: User,
  count: PropTypes.string,
  culprit: PropTypes.string,
  firstSeen: PropTypes.string,
  hasSeen: PropTypes.bool,
  isBookmarked: PropTypes.bool,
  isPublic: PropTypes.bool,
  isSubscribed: PropTypes.bool,
  lastSeen: PropTypes.string,
  level: PropTypes.string,
  logger: PropTypes.string,
  metadata: PropTypes.shape({
    value: PropTypes.string,
    message: PropTypes.string,
    directive: PropTypes.string,
    type: PropTypes.string,
    title: PropTypes.string,
    uri: PropTypes.string,
  }),
  numComments: PropTypes.number,
  permalink: PropTypes.string,
  project: PropTypes.shape({
    name: PropTypes.string,
    slug: PropTypes.string,
  }),
  shareId: PropTypes.string,
  shortId: PropTypes.string,
  status: PropTypes.string,
  statusDetails: PropTypes.object,
  title: PropTypes.string,
  type: PropTypes.oneOf([
    'error',
    'csp',
    'hpkp',
    'expectct',
    'expectstaple',
    'default',
    'transaction',
  ]),
  userCount: PropTypes.number,
});

const Team = PropTypes.shape({
  id: PropTypes.string.isRequired,
  slug: PropTypes.string.isRequired,
});

/**
 * @deprecated
 */
const Project = PropTypes.shape({
  // snuba returns id as number
  id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  slug: PropTypes.string.isRequired,

  // snuba results may not contain a `name` or `isBookmarked
  teams: PropTypes.arrayOf(Team),
  name: PropTypes.string,
  isBookmarked: PropTypes.bool,
  status: PropTypes.string,
});

/**
 * @deprecated
 */
const Organization = PropTypes.shape({
  id: PropTypes.string.isRequired,
});

const SentryTypes = {Group, Organization, Project};

export default SentryTypes;
