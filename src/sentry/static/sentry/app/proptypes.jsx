import React from 'react';

const Metadata = React.PropTypes.shape({
  value: React.PropTypes.string,
  message: React.PropTypes.string,
  directive: React.PropTypes.string,
  type: React.PropTypes.string,
  title: React.PropTypes.string,
  uri: React.PropTypes.string
});

const User = React.PropTypes.shape({
  id: React.PropTypes.string.isRequired
});

const Group = React.PropTypes.shape({
  id: React.PropTypes.string.isRequired,
  annotations: React.PropTypes.array,
  assignedTo: User,
  count: React.PropTypes.string,
  culprit: React.PropTypes.string,
  firstSeen: React.PropTypes.string,
  hasSeen: React.PropTypes.bool,
  isBookmarked: React.PropTypes.bool,
  isPublic: React.PropTypes.bool,
  isSubscribed: React.PropTypes.bool,
  lastSeen: React.PropTypes.string,
  level: React.PropTypes.string,
  logger: React.PropTypes.string,
  metadata: Metadata,
  numComments: React.PropTypes.number,
  permalink: React.PropTypes.string,
  project: React.PropTypes.shape({
    name: React.PropTypes.string,
    slug: React.PropTypes.string
  }),
  shareId: React.PropTypes.string,
  shortId: React.PropTypes.string,
  status: React.PropTypes.string,
  statusDetails: React.PropTypes.object,
  title: React.PropTypes.string,
  type: React.PropTypes.oneOf(['error', 'csp', 'default']),
  userCount: React.PropTypes.number
});

const Event = React.PropTypes.shape({
  id: React.PropTypes.string.isRequired,
  context: React.PropTypes.object,
  contexts: React.PropTypes.object,
  dateCreated: React.PropTypes.string,
  dateReceived: React.PropTypes.string,
  entries: React.PropTypes.arrayOf(
    React.PropTypes.shape({
      data: React.PropTypes.object,
      type: React.PropTypes.string
    })
  ),
  errors: React.PropTypes.arrayOf(
    React.PropTypes.shape({
      data: React.PropTypes.object,
      message: React.PropTypes.string,
      type: React.PropTypes.string
    })
  ),
  eventID: React.PropTypes.string,
  fingerprints: React.PropTypes.arrayOf(React.PropTypes.string),
  groupID: React.PropTypes.string,
  message: React.PropTypes.string,
  metadata: Metadata,
  packages: React.PropTypes.object,
  platform: React.PropTypes.string,
  sdk: React.PropTypes.object,
  size: React.PropTypes.number,
  tags: React.PropTypes.arrayOf(
    React.PropTypes.shape({
      key: React.PropTypes.string,
      value: React.PropTypes.string
    })
  ),
  type: React.PropTypes.oneOf(['error', 'csp', 'default']),
  user: React.PropTypes.object
});

let PropTypes = {
  AnyModel: React.PropTypes.shape({
    id: React.PropTypes.string.isRequired
  }),
  Group,
  Event,
  Organization: React.PropTypes.shape({
    id: React.PropTypes.string.isRequired
  }),
  Project: React.PropTypes.shape({
    id: React.PropTypes.string.isRequired
  }),
  TagKey: React.PropTypes.shape({
    key: React.PropTypes.string.isRequired
  }),
  Team: React.PropTypes.shape({
    id: React.PropTypes.string.isRequired
  }),
  User
};

export {Group, Event, Metadata};

export default PropTypes;
