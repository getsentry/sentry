import PropTypes from 'prop-types';

export const Metadata = PropTypes.shape({
  value: PropTypes.string,
  message: PropTypes.string,
  directive: PropTypes.string,
  type: PropTypes.string,
  title: PropTypes.string,
  uri: PropTypes.string
});

/**
 * A User is someone that has registered on Sentry
 *
 */
export const User = PropTypes.shape({
  id: PropTypes.string.isRequired
});

/**
 * A Member is someone that was invited to Sentry but may
 * not have registered for an account yet
 */
export const Member = PropTypes.shape({
  id: PropTypes.string.isRequired,
  email: PropTypes.string.isRequired,
  name: PropTypes.string.isRequired,
  roleName: PropTypes.string.isRequired,
  pending: PropTypes.bool,
  user: User
});

export const Group = PropTypes.shape({
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
  metadata: Metadata,
  numComments: PropTypes.number,
  permalink: PropTypes.string,
  project: PropTypes.shape({
    name: PropTypes.string,
    slug: PropTypes.string
  }),
  shareId: PropTypes.string,
  shortId: PropTypes.string,
  status: PropTypes.string,
  statusDetails: PropTypes.object,
  title: PropTypes.string,
  type: PropTypes.oneOf(['error', 'csp', 'default']),
  userCount: PropTypes.number
});

export const Event = PropTypes.shape({
  id: PropTypes.string.isRequired,
  context: PropTypes.object,
  contexts: PropTypes.object,
  dateCreated: PropTypes.string,
  dateReceived: PropTypes.string,
  entries: PropTypes.arrayOf(
    PropTypes.shape({
      data: PropTypes.object,
      type: PropTypes.string
    })
  ),
  errors: PropTypes.arrayOf(
    PropTypes.shape({
      data: PropTypes.object,
      message: PropTypes.string,
      type: PropTypes.string
    })
  ),
  eventID: PropTypes.string,
  fingerprints: PropTypes.arrayOf(PropTypes.string),
  groupID: PropTypes.string,
  message: PropTypes.string,
  metadata: Metadata,
  packages: PropTypes.object,
  platform: PropTypes.string,
  sdk: PropTypes.object,
  size: PropTypes.number,
  tags: PropTypes.arrayOf(
    PropTypes.shape({
      key: PropTypes.string,
      value: PropTypes.string
    })
  ),
  type: PropTypes.oneOf(['error', 'csp', 'default']),
  user: PropTypes.object
});

export const Tag = PropTypes.shape({
  id: PropTypes.string.isRequired,
  key: PropTypes.string.isRequired,
  name: PropTypes.string.isRequired,
  uniqueValues: PropTypes.number
});

let SentryTypes = {
  AnyModel: PropTypes.shape({
    id: PropTypes.string.isRequired
  }),
  Group,
  Event,
  Organization: PropTypes.shape({
    id: PropTypes.string.isRequired
  }),
  Tag,
  Project: PropTypes.shape({
    id: PropTypes.string.isRequired
  }),
  TagKey: PropTypes.shape({
    key: PropTypes.string.isRequired
  }),
  Team: PropTypes.shape({
    id: PropTypes.string.isRequired
  }),
  Member,
  User
};

export default SentryTypes;
