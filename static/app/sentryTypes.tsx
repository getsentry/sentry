import PropTypes from 'prop-types';

const Metadata = PropTypes.shape({
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
 */
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

const AuthConfig = PropTypes.shape({
  canRegister: PropTypes.bool,
  serverHostname: PropTypes.string,
  hasNewsletter: PropTypes.bool,
  githubLoginLink: PropTypes.string,
  vstsLoginLink: PropTypes.string,
});

const Config = PropTypes.shape({
  languageCode: PropTypes.string,
  csrfCookieName: PropTypes.string,
  lastOrganization: PropTypes.string,
  dsn: PropTypes.string,
  features: PropTypes.instanceOf(Set),
  gravatarBaseUrl: PropTypes.string,
  invitesEnabled: PropTypes.bool,
  isAuthenticated: PropTypes.bool,
  isOnPremise: PropTypes.bool,
  messages: PropTypes.array,
  needsUpgrade: PropTypes.bool,
  privacyUrl: PropTypes.string,
  singleOrganization: PropTypes.bool,
  supportEmail: PropTypes.string,
  termsUrl: PropTypes.string,
  urlPrefix: PropTypes.string,
  user: User,
  statuspage: PropTypes.shape({
    id: PropTypes.string,
    api_host: PropTypes.string,
  }),
  version: PropTypes.shape({
    current: PropTypes.string,
    build: PropTypes.string,
    latest: PropTypes.string,
    upgradeAvailable: PropTypes.bool,
  }),
  userIdentity: PropTypes.shape({
    ip_address: PropTypes.string,
    email: PropTypes.string,
    id: PropTypes.number,
    isStaff: PropTypes.bool,
  }),
  sentryConfig: PropTypes.shape({
    dsn: PropTypes.string,
    release: PropTypes.string,
    whitelistUrls: PropTypes.arrayOf(PropTypes.string),
  }),
  distPrefix: PropTypes.string,
});

const Deploy = PropTypes.shape({
  environment: PropTypes.string,
  dateFinished: PropTypes.string,
  version: PropTypes.string,
});

const DiscoverQueryShape = {
  projects: PropTypes.arrayOf(PropTypes.number),
  fields: PropTypes.arrayOf(PropTypes.string),
  aggregations: PropTypes.arrayOf(PropTypes.array),
  conditions: PropTypes.arrayOf(PropTypes.array),
  limit: PropTypes.number,
  range: PropTypes.string,
  start: PropTypes.string,
  end: PropTypes.string,
};

const DiscoverQuery = PropTypes.shape(DiscoverQueryShape);

const DiscoverSavedQuery = PropTypes.shape({
  id: PropTypes.string.isRequired,
  dateCreated: PropTypes.string.isRequired,
  dateUpdated: PropTypes.string.isRequired,
  name: PropTypes.string.isRequired,
  createdBy: PropTypes.string,
  ...DiscoverQueryShape,
});

const DiscoverResultsShape = {
  data: PropTypes.arrayOf(PropTypes.object),
  meta: PropTypes.arrayOf(
    PropTypes.shape({
      type: PropTypes.string,
      name: PropTypes.string,
    })
  ),
  timing: PropTypes.shape({
    duration_ms: PropTypes.number,
    marks_ms: PropTypes.object,
    timestamp: PropTypes.number,
  }),
};

const DiscoverResults = PropTypes.arrayOf(PropTypes.shape(DiscoverResultsShape));

const EventView = PropTypes.shape({
  id: PropTypes.string.isRequired,
  name: PropTypes.string.isRequired,
  data: PropTypes.shape({
    fields: PropTypes.arrayOf(PropTypes.string),
    groupby: PropTypes.arrayOf(PropTypes.string),
    orderby: PropTypes.arrayOf(PropTypes.string),
  }).isRequired,
  tags: PropTypes.arrayOf(PropTypes.string).isRequired,
});

/**
 * A Member is someone that was invited to Sentry but may
 * not have registered for an account yet
 */
const Member = PropTypes.shape({
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

const EventOrGroupType = PropTypes.oneOf([
  'error',
  'csp',
  'hpkp',
  'expectct',
  'expectstaple',
  'default',
  'transaction',
]);

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
  type: EventOrGroupType,
  userCount: PropTypes.number,
});

const Event = PropTypes.shape({
  id: PropTypes.string.isRequired,
  context: PropTypes.object,
  contexts: PropTypes.object,
  dateCreated: PropTypes.string,
  dateReceived: PropTypes.string,
  entries: PropTypes.arrayOf(
    PropTypes.shape({
      data: PropTypes.oneOfType([PropTypes.object, PropTypes.array]),
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
  type: EventOrGroupType,
  user: PropTypes.object,
});

const EventAttachment = PropTypes.shape({
  id: PropTypes.string.isRequired,
  name: PropTypes.string.isRequired,
  headers: PropTypes.object,
  size: PropTypes.number.isRequired,
  sha1: PropTypes.string.isRequired,
  dateCreated: PropTypes.oneOfType([PropTypes.string, PropTypes.instanceOf(Date)]),
  type: PropTypes.string.isRequired,
});

const Tag = PropTypes.shape({
  key: PropTypes.string.isRequired,
  name: PropTypes.string,
  uniqueValues: PropTypes.number,
});

const Actor = PropTypes.shape({
  type: PropTypes.oneOf(['user', 'team']),
  id: PropTypes.string.isRequired,
  name: PropTypes.string.isRequired,
});

const Team = PropTypes.shape({
  id: PropTypes.string.isRequired,
  slug: PropTypes.string.isRequired,
});

const Monitor = PropTypes.shape({
  id: PropTypes.string.isRequired,
  name: PropTypes.string.isRequired,
  dateCreated: PropTypes.string,
});

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

const Release = PropTypes.shape({
  version: PropTypes.string.isRequired,
  ref: PropTypes.string,
  url: PropTypes.string,
  dateReleased: PropTypes.string,
  owner: User,
  status: PropTypes.oneOf(['archived', 'open']),
});

const Repository = PropTypes.shape({
  id: PropTypes.string.isRequired,
  name: PropTypes.string,
  url: PropTypes.string,
  status: PropTypes.string,
});

const NavigationObject = PropTypes.shape({
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

const Environment = PropTypes.shape({
  id: PropTypes.string.isRequired,
  name: PropTypes.string.isRequired,
});

const PageLinks = PropTypes.string;

const Plugin = {
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

const PluginShape = PropTypes.shape(Plugin);

const PluginsStore = PropTypes.shape({
  loading: PropTypes.bool,
  plugins: PropTypes.arrayOf(PluginShape),
  error: PropTypes.object,
  pageLinks: PropTypes.any,
});

const AuthProvider = PropTypes.shape({
  key: PropTypes.string,
  name: PropTypes.string,
  requiredFeature: PropTypes.string,
  disables2FA: PropTypes.bool,
});

const ProjectDsn = {
  secret: PropTypes.string,
  minidump: PropTypes.string,
  public: PropTypes.string,
  csp: PropTypes.string,
};

const ProjectDsnShape = PropTypes.shape(ProjectDsn);

const ProjectKey = PropTypes.shape({
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

const SentryApplication = PropTypes.shape({
  name: PropTypes.string,
  slug: PropTypes.string,
  uuid: PropTypes.string,
  scopes: PropTypes.arrayOf(PropTypes.string),
  status: PropTypes.string,
});

const SavedSearch = PropTypes.shape({
  id: PropTypes.string,
  dateCreated: PropTypes.string,
  isDefault: PropTypes.bool,
  isGlobal: PropTypes.bool,
  isOrgCustom: PropTypes.bool,
  isPinned: PropTypes.bool,
  isPrivate: PropTypes.bool,
  isUserDefault: PropTypes.bool,
  name: PropTypes.string,
  projectId: PropTypes.string,
  query: PropTypes.string,
  type: PropTypes.number,
});

const Incident = PropTypes.shape({
  id: PropTypes.string.isRequired,
  identifier: PropTypes.string.isRequired,
  organizationId: PropTypes.string.isRequired,
  title: PropTypes.string.isRequired,
  status: PropTypes.number.isRequired,
  query: PropTypes.string,
  projects: PropTypes.array.isRequired,
  eventStats: PropTypes.shape({
    data: PropTypes.arrayOf(
      PropTypes.arrayOf(PropTypes.oneOfType([PropTypes.number, PropTypes.array]))
    ),
  }),
  totalEvents: PropTypes.number.isRequired,
  uniqueUsers: PropTypes.number.isRequired,
  isSubscribed: PropTypes.bool,
  dateClosed: PropTypes.string,
  dateStarted: PropTypes.string.isRequired,
  dateDetected: PropTypes.string.isRequired,
  dateCreated: PropTypes.string.isRequired,
});

const IncidentSuspectData = PropTypes.shape({
  author: User,
  dateCreated: PropTypes.string.isRequired,
  id: PropTypes.string.isRequired,
  message: PropTypes.string,
  repository: Repository,
  score: PropTypes.number,
});

const IncidentSuspect = PropTypes.shape({
  type: PropTypes.oneOf(['commit']).isRequired,
  data: IncidentSuspectData.isRequired,
});

const Activity = PropTypes.shape({
  id: PropTypes.string.isRequired,
  type: PropTypes.string.isRequired,
  dateCreated: PropTypes.string.isRequired,
  user: User,
  data: PropTypes.shape({
    text: PropTypes.string,
  }),
});

const IncidentActivity = PropTypes.shape({
  id: PropTypes.string.isRequired,
  type: PropTypes.number.isRequired,
  dateCreated: PropTypes.oneOfType([PropTypes.instanceOf(Date), PropTypes.string])
    .isRequired,
  user: User,
  comment: PropTypes.string,
  value: PropTypes.string,
  previousValue: PropTypes.string,
});

const GlobalSelection = PropTypes.shape({
  projects: PropTypes.arrayOf(PropTypes.number),
  environments: PropTypes.arrayOf(PropTypes.string),
  datetime: PropTypes.shape({
    period: PropTypes.string,
    start: PropTypes.oneOfType([PropTypes.string, PropTypes.instanceOf(Date)]),
    end: PropTypes.oneOfType([PropTypes.string, PropTypes.instanceOf(Date)]),
    utc: PropTypes.bool,
  }),
});

const UserReport = PropTypes.shape({
  id: PropTypes.string.isRequired,
  eventID: PropTypes.string.isRequired,
  issue: Group,
  name: PropTypes.string.isRequired,
  event: PropTypes.shape({
    eventID: PropTypes.string.isRequired,
    id: PropTypes.string.isRequired,
  }),
  user: User.isRequired,
  dateCreated: PropTypes.string.isRequired,
  comments: PropTypes.string.isRequired,
  email: PropTypes.string.isRequired,
});

const DebugSourceType = PropTypes.oneOf(['http', 's3', 'gcs']);

// Avoiding code duplication here. This is validated strictly by the server and
// form elements in the `DebugFilesSourceModal`.
const DebugSourceConfig = PropTypes.object;

const Widget = PropTypes.shape({
  queries: PropTypes.shape({
    discover: PropTypes.arrayOf(DiscoverQuery),
  }),
  title: PropTypes.node,
  fieldLabelMap: PropTypes.object,
  yAxisMapping: PropTypes.array,
});

const SeriesUnit = PropTypes.shape({
  seriesName: PropTypes.string,
  data: PropTypes.arrayOf(
    PropTypes.shape({
      value: PropTypes.number,
      // Number because datetime
      name: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    })
  ),
});

const Series = PropTypes.arrayOf(SeriesUnit);

const AnyModel = PropTypes.shape({
  id: PropTypes.string.isRequired,
});

const Organization = PropTypes.shape({
  id: PropTypes.string.isRequired,
});

const TagKey = PropTypes.shape({
  key: PropTypes.string.isRequired,
});

export default {
  AnyModel,
  Actor,
  AuthConfig,
  Activity,
  AuthProvider,
  Config,
  DebugSourceConfig,
  DebugSourceType,
  Deploy,
  DiscoverQuery,
  DiscoverSavedQuery,
  DiscoverResults,
  Environment,
  Event,
  EventAttachment,
  EventView,
  Organization,
  GlobalSelection,
  Group,
  Incident,
  IncidentActivity,
  IncidentSuspect,
  IncidentSuspectData,
  Tag,
  Monitor,
  PageLinks,
  Project,
  Series,
  SeriesUnit,
  TagKey,
  Team,
  NavigationObject,
  Member,
  Plugin,
  PluginShape,
  PluginsStore,
  ProjectKey,
  Release,
  Repository,
  User,
  UserReport,
  SavedSearch,
  SentryApplication,
  Widget,
};
