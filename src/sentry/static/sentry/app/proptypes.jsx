import PropTypes from 'prop-types';

export const Metadata = PropTypes.shape({
  value: PropTypes.string,
  message: PropTypes.string,
  directive: PropTypes.string,
  type: PropTypes.string,
  title: PropTypes.string,
  uri: PropTypes.string,
});

const Avatar = PropTypes.shape({
  avatarType: PropTypes.oneOf(['letter_avatar', 'upload', 'gravatar']),
  avatarUuid: PropTypes.string,
});

/**
 * A User is someone that has registered on Sentry
 *
 */
export const User = PropTypes.shape({
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
  id: PropTypes.string.isRequired,
  identities: PropTypes.array,
  isActive: PropTypes.bool,
  isManaged: PropTypes.bool,
  lastActive: PropTypes.string,
  lastLogin: PropTypes.string,
  username: PropTypes.string,
});

export const Config = PropTypes.shape({
  dsn: PropTypes.string,
  features: PropTypes.instanceOf(Set),
  gravatarBaseUrl: PropTypes.string,
  invitesEnabled: PropTypes.bool,
  isAuthenticated: PropTypes.bool,
  isOnPremise: PropTypes.bool,
  mediaUrl: PropTypes.string,
  messages: PropTypes.array,
  needsUpgrade: PropTypes.bool,
  privacyUrl: PropTypes.string,
  singleOrganization: PropTypes.bool,
  supportEmail: PropTypes.string,
  termsUrl: PropTypes.string,
  urlPrefix: PropTypes.string,
  user: User,
  version: PropTypes.shape({
    current: PropTypes.string,
    build: PropTypes.string,
    latest: PropTypes.string,
    upgradeAvailable: PropTypes.bool,
  }),
});

export const Deploy = PropTypes.shape({
  environment: PropTypes.string,
  dateFinished: PropTypes.string,
  version: PropTypes.string,
});

/**
 * A Member is someone that was invited to Sentry but may
 * not have registered for an account yet
 */
export const Member = PropTypes.shape({
  dateCreated: PropTypes.string,
  email: PropTypes.string.isRequired,
  flags: PropTypes.shape({
    'sso:linked': PropTypes.bool,
    'sso:invalid': PropTypes.bool,
  }),
  id: PropTypes.string.isRequired,
  name: PropTypes.string.isRequired,
  pending: PropTypes.bool,
  role: PropTypes.string.isRequired,
  roleName: PropTypes.string.isRequired,
  user: User,
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
    slug: PropTypes.string,
  }),
  shareId: PropTypes.string,
  shortId: PropTypes.string,
  status: PropTypes.string,
  statusDetails: PropTypes.object,
  title: PropTypes.string,
  type: PropTypes.oneOf(['error', 'csp', 'default']),
  userCount: PropTypes.number,
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
      type: PropTypes.string,
    })
  ),
  errors: PropTypes.arrayOf(
    PropTypes.shape({
      data: PropTypes.object,
      message: PropTypes.string,
      type: PropTypes.string,
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
      value: PropTypes.string,
    })
  ),
  type: PropTypes.oneOf(['error', 'csp', 'default']),
  user: PropTypes.object,
});

export const Tag = PropTypes.shape({
  id: PropTypes.string.isRequired,
  key: PropTypes.string.isRequired,
  name: PropTypes.string.isRequired,
  uniqueValues: PropTypes.number,
});

export const Actor = PropTypes.shape({
  type: PropTypes.oneOf(['user', 'team']),
  id: PropTypes.string.isRequired,
  name: PropTypes.string.isRequired,
});

export const Team = PropTypes.shape({
  id: PropTypes.string.isRequired,
  slug: PropTypes.string.isRequired,
});

export const Project = PropTypes.shape({
  id: PropTypes.string.isRequired,
  name: PropTypes.string.isRequired,
  slug: PropTypes.string.isRequired,
  isBookmarked: PropTypes.bool.isRequired,
  teams: PropTypes.arrayOf(Team).isRequired,
  status: PropTypes.string,
});

export const ProjectDetail = PropTypes.shape({
  id: PropTypes.string.isRequired,
  name: PropTypes.string.isRequired,
  slug: PropTypes.string.isRequired,
  dateCreated: PropTypes.string.isRequired,
  isBookmarked: PropTypes.bool.isRequired,
  isMember: PropTypes.bool.isRequired,
  hasAccess: PropTypes.bool.isRequired,
  teams: PropTypes.arrayOf(Team).isRequired,
  color: PropTypes.string,
  features: PropTypes.arrayOf(PropTypes.string),
  firstEvent: PropTypes.oneOfType([PropTypes.string, PropTypes.bool]),
  isPublic: PropTypes.bool,
  platform: PropTypes.string,
  stats: PropTypes.arrayOf(PropTypes.arrayOf(PropTypes.number)),
  status: PropTypes.string,
});

export const NavigationObject = PropTypes.shape({
  name: PropTypes.string,
  items: PropTypes.arrayOf(
    PropTypes.shape({
      path: PropTypes.string.isRequired,
      title: PropTypes.string.isRequired,
      /**
       * Function that is given an object with
       * `access`, `features`
       *
       * Return true to show nav item, false to hide
       */
      show: PropTypes.oneOfType([PropTypes.func, PropTypes.bool]),

      /**
       * Function that is given an object with
       * `access`, `features`, `organization`
       *
       * Return number to show in badge
       */
      badge: PropTypes.func,
    })
  ),
});

export const Environment = PropTypes.shape({
  id: PropTypes.string.isRequired,
  name: PropTypes.string.isRequired,
});

export const PageLinks = PropTypes.string;

export const Plugin = {
  assets: PropTypes.array,
  author: PropTypes.shape({
    url: PropTypes.string,
    name: PropTypes.string,
  }),
  canDisable: PropTypes.bool,
  contexts: PropTypes.array,
  doc: PropTypes.string,
  enabled: PropTypes.bool,
  hasConfiguration: PropTypes.bool,
  id: PropTypes.string,
  isTestable: PropTypes.bool,
  metadata: PropTypes.object,
  name: PropTypes.string,
  shortName: PropTypes.string,
  slug: PropTypes.string,
  status: PropTypes.string,
  type: PropTypes.string,
  version: PropTypes.string,
};

export const PluginShape = PropTypes.shape(Plugin);

export const PluginsStore = PropTypes.shape({
  loading: PropTypes.bool,
  plugins: PropTypes.arrayOf(PluginShape),
  error: PropTypes.object,
  pageLinks: PropTypes.any,
});

export const ProjectDsn = {
  secret: PropTypes.string,
  minidump: PropTypes.string,
  public: PropTypes.string,
  csp: PropTypes.string,
};

export const ProjectDsnShape = PropTypes.shape(ProjectDsn);

export const ProjectKey = PropTypes.shape({
  dsn: ProjectDsnShape,
  public: PropTypes.string,
  secret: PropTypes.string,
  name: PropTypes.string,
  rateLimit: PropTypes.shape({
    count: PropTypes.number,
    window: PropTypes.number,
  }),
  projectId: PropTypes.number,
  dateCreated: PropTypes.string,
  id: PropTypes.string,
  isActive: PropTypes.bool,
  label: PropTypes.string,
  relay: PropTypes.shape({
    url: PropTypes.string,
  }),
  cdnSdkUrl: PropTypes.string,
});

let SentryTypes = {
  AnyModel: PropTypes.shape({
    id: PropTypes.string.isRequired,
  }),
  Actor,
  Config,
  Deploy,
  Environment,
  Event,
  Organization: PropTypes.shape({
    id: PropTypes.string.isRequired,
  }),
  Group,
  Tag,
  PageLinks,
  Project,
  TagKey: PropTypes.shape({
    key: PropTypes.string.isRequired,
  }),
  Team,
  NavigationObject,
  Member,
  Plugin,
  PluginShape,
  PluginsStore,
  ProjectKey,
  User,
};

export default SentryTypes;
