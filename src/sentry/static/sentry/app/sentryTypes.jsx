import PropTypes from 'prop-types';

import {SEARCH_TYPES} from 'app/constants';

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
  id: PropTypes.string,
  identities: PropTypes.array,
  isActive: PropTypes.bool,
  isManaged: PropTypes.bool,
  lastActive: PropTypes.string,
  lastLogin: PropTypes.string,
  username: PropTypes.string,
});

export const AuthConfig = PropTypes.shape({
  canRegister: PropTypes.bool,
  serverHostname: PropTypes.string,
  hasNewsletter: PropTypes.bool,
  githubLoginLink: PropTypes.string,
  vstsLoginLink: PropTypes.string,
});

export const Config = PropTypes.shape({
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

export const DiscoverQuery = PropTypes.shape(DiscoverQueryShape);

export const DiscoverSavedQuery = PropTypes.shape({
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

export const DiscoverResults = PropTypes.arrayOf(PropTypes.shape(DiscoverResultsShape));

export const EventView = PropTypes.shape({
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
  type: PropTypes.oneOf(['error', 'csp', 'default', 'transaction']),
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
  type: PropTypes.oneOf(['error', 'csp', 'default', 'transaction']),
  user: PropTypes.object,
});

export const EventAttachment = PropTypes.shape({
  id: PropTypes.string.isRequired,
  name: PropTypes.string.isRequired,
  headers: PropTypes.object,
  size: PropTypes.number.isRequired,
  sha1: PropTypes.string.isRequired,
  dateCreated: PropTypes.oneOfType([PropTypes.string, PropTypes.instanceOf(Date)]),
  type: PropTypes.string.isRequired,
});

export const EventError = PropTypes.shape({
  type: PropTypes.string.isRequired,
  message: PropTypes.string.isRequired,
  data: PropTypes.object,
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

export const Monitor = PropTypes.shape({
  id: PropTypes.string.isRequired,
  name: PropTypes.string.isRequired,
  dateCreated: PropTypes.string,
});

export const Project = PropTypes.shape({
  // snuba returns id as number
  id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  slug: PropTypes.string.isRequired,

  // snuba results may not contain a `name` or `isBookmarked
  teams: PropTypes.arrayOf(Team),
  name: PropTypes.string,
  isBookmarked: PropTypes.bool,
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

export const Release = PropTypes.shape({
  version: PropTypes.string.isRequired,
  ref: PropTypes.string,
  url: PropTypes.string,
  dateReleased: PropTypes.string,
  owner: User,
});

export const Repository = PropTypes.shape({
  id: PropTypes.string.isRequired,
  name: PropTypes.string,
  url: PropTypes.string,
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

export const AuthProvider = PropTypes.shape({
  key: PropTypes.string,
  name: PropTypes.string,
  requiredFeature: PropTypes.string,
  disables2FA: PropTypes.bool,
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

export const SentryApplication = PropTypes.shape({
  name: PropTypes.string,
  slug: PropTypes.string,
  uuid: PropTypes.string,
  scopes: PropTypes.arrayOf(PropTypes.string),
  status: PropTypes.string,
});

export const SavedSearch = PropTypes.shape({
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
  type: PropTypes.oneOf([SEARCH_TYPES.ISSUE, SEARCH_TYPES.EVENTS]),
});

export const Incident = PropTypes.shape({
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
  dateAdded: PropTypes.string.isRequired,
});

export const IncidentSuspectData = PropTypes.shape({
  author: User,
  dateCreated: PropTypes.string.isRequired,
  id: PropTypes.string.isRequired,
  message: PropTypes.string,
  repository: Repository,
  score: PropTypes.number,
});

export const IncidentSuspect = PropTypes.shape({
  type: PropTypes.oneOf(['commit']).isRequired,
  data: IncidentSuspectData.isRequired,
});

export const Activity = PropTypes.shape({
  id: PropTypes.string.isRequired,
  type: PropTypes.string.isRequired,
  dateCreated: PropTypes.string.isRequired,
  user: User,
  data: PropTypes.shape({
    text: PropTypes.string,
  }),
});

export const IncidentActivity = PropTypes.shape({
  id: PropTypes.string.isRequired,
  type: PropTypes.number.isRequired,
  dateCreated: PropTypes.oneOfType([PropTypes.instanceOf(Date), PropTypes.string])
    .isRequired,
  user: User,
  comment: PropTypes.string,
  value: PropTypes.string,
  previousValue: PropTypes.string,
});

export const GlobalSelection = PropTypes.shape({
  projects: PropTypes.arrayOf(PropTypes.number),
  environments: PropTypes.arrayOf(PropTypes.string),
  datetime: PropTypes.shape({
    period: PropTypes.string,
    start: PropTypes.oneOfType([PropTypes.string, PropTypes.instanceOf(Date)]),
    end: PropTypes.oneOfType([PropTypes.string, PropTypes.instanceOf(Date)]),
    utc: PropTypes.bool,
  }),
});

export const DebugSourceType = PropTypes.oneOf(['http', 's3', 'gcs']);

// Avoiding code duplication here. This is validated strictly by the server and
// form elements in the `DebugFilesSourceModal`.
export const DebugSourceConfig = PropTypes.object;

export const Widget = PropTypes.shape({
  queries: PropTypes.shape({
    discover: PropTypes.arrayOf(DiscoverQuery),
  }),
  title: PropTypes.node,
  fieldLabelMap: PropTypes.object,
  yAxisMapping: PropTypes.array,
});

export const EChartsData = PropTypes.arrayOf(
  PropTypes.oneOfType([
    // `PercentageBarChart` has a fixed dataset of 0, 25, 50, 100
    PropTypes.number,

    // e.g. ['Category', 123, 123, 123]
    PropTypes.arrayOf(PropTypes.oneOfType([PropTypes.number, PropTypes.string])),

    // e.g. PieCharts
    PropTypes.shape({
      name: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
      value: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    }),
  ])
);

export const EChartsSeriesUnit = PropTypes.shape({
  type: PropTypes.oneOf(['line', 'bar', 'pie', 'map']),
  showSymbol: PropTypes.bool,
  name: PropTypes.string,
  data: EChartsData,
});

export const EChartsSeries = PropTypes.arrayOf(EChartsSeriesUnit);

// See https://ecomfe.github.io/echarts-doc/public/en/option.html#xAxis
export const EChartsAxis = PropTypes.shape({
  // Component ID, not specified by default. If specified, it can be used to refer the component in option or API.
  id: PropTypes.string,

  // If show x axis.
  show: PropTypes.bool,

  gridIndex: PropTypes.number,
  // The index of grid which the x axis belongs to. Defaults to be in the first grid.

  // The position of x axis.
  // The first x axis in grid defaults to be on the bottom of the grid, and the second x axis is on the other side against the first x axis.
  position: PropTypes.oneOf(['top', 'bottom']),

  // Offset of x axis relative to default position. Useful when multiple x axis has same position value.
  offset: PropTypes.number,

  // Type of axis
  // Option:
  // 'value' Numerical axis, suitable for continuous data.
  // 'category' Category axis, suitable for discrete category data. Data should only be set via data for this type.
  // 'time' Time axis, suitable for continuous time series data. As compared to value axis, it has a better formatting for time and a different tick calculation method. For example, it decides to use month, week, day or hour for tick based on the range of span.
  // 'log' Log axis, suitable for log data.
  type: PropTypes.oneOf(['value', 'category', 'time', 'log']),

  // Name of axis.
  name: PropTypes.string,

  // Location of axis name.
  nameLocation: PropTypes.oneOf(['start', 'middle', 'center', 'end']),

  // Text style of axis name.
  nameTextStyle: PropTypes.object,

  // Gap between axis name and axis line.
  nameGap: PropTypes.number,

  // Rotation of axis name.
  nameRotate: PropTypes.number,

  // Whether axis is inversed. New option from ECharts 3.
  inverse: PropTypes.bool,

  // The boundary gap on both sides of a coordinate axis. The setting and behavior of category axes and non-category axes are different.
  // The boundaryGap of category axis can be set to either true or false. Default value is set to be true, in which case axisTick is served only as a separation line, and labels and data appear only in the center part of two axis ticks, which is called band.
  // For non-category axis, including time, numerical value, and log axes, boundaryGap is an array of two values, representing the spanning range between minimum and maximum value. The value can be set in numeric value or relative percentage, which becomes invalid after setting min and max. Example:
  boundaryGap: PropTypes.oneOfType([PropTypes.bool, PropTypes.array]),

  // The minimun value of axis.
  // It can be set to a special value 'dataMin' so that the minimum value on this axis is set to be the minimum label.
  // It will be automatically computed to make sure axis tick is equally distributed when not set.
  // In category axis, it can also be set as the ordinal number. For example, if a catergory axis has data: ['categoryA', 'categoryB', 'categoryC'], and the ordinal 2 represents 'categoryC'. Moreover, it can be set as negative number, like -3.
  min: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),

  // The maximum value of axis.
  // It can be set to a special value 'dataMax' so that the minimum value on this axis is set to be the maximum label.
  // It will be automatically computed to make sure axis tick is equally distributed when not set.
  // In category axis, it can also be set as the ordinal number. For example, if a catergory axis has data: ['categoryA', 'categoryB', 'categoryC'], and the ordinal 2 represents 'categoryC'. Moreover, it can be set as negative number, like -3.
  max: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),

  // It is available only in numerical axis, i.e., type: 'value'.
  // It specifies whether not to contain zero position of axis compulsively. When it is set to be true, the axis may not contain zero position, which is useful in the scatter chart for both value axes.
  // This configuration item is unavailable when the min and max are set.
  scale: PropTypes.bool,

  // Number of segments that the axis is split into. Note that this number serves only as a recommendation, and the true segments may be adjusted based on readability.
  // This is unavailable for category axis.
  splitNumber: PropTypes.number,

  // Maximum gap between split lines.
  // For example, in time axis (type is 'time'), it can be set to be 3600 * 24 * 1000 to make sure that the gap between axis labels is less than or equal to one day.
  // {
  // maxInterval: 3600 * 1000 * 24
  // }
  // It is available only for axis of type 'value' or 'time'.
  minInterval: PropTypes.number,

  // Compulsively set segmentation interval for axis.
  // As splitNumber is a recommendation value, the calculated tick may not be the same as expected. In this case, interval should be used along with min and max to compulsively set tickings. But in most cases, we do not suggest using this, out automatic calculation is enough for most situations.

  // This is unavailable for category axis. Timestamp should be passed for type: 'time' axis. Logged value should be passed for type: 'log' axis.

  interval: PropTypes.number,

  // Base of logarithm, which is valid only for numeric axes with type: 'log'.
  logBase: PropTypes.number,

  // True for axis that cannot be interacted with.
  silent: PropTypes.bool,

  // Whether the labels of axis triggers and reacts to mouse events.
  // Parameters of event includes:

  // {
  // Component type: xAxis, yAxis, radiusAxis, angleAxis
  // Each of which has an attribute for index, e.g., xAxisIndex for xAxis
  // componentType: string,
  // Value on axis before being formatted.
  // Click on value label to trigger event.
  // value: '',
  // Name of axis.
  // Click on laben name to trigger event.
  // name: ''
  // }
  triggerEvent: PropTypes.bool,

  // Settings related to axis line.
  axisLine: PropTypes.object,

  // Settings related to axis tick.
  axisTick: PropTypes.object,

  // Settings related to axis label.
  axisLabel: PropTypes.object,

  // SplitLine of axis in grid area.
  splitLine: PropTypes.object,

  // Split area of axis in grid area, not shown by default.
  splitArea: PropTypes.object,

  // Category data, available in type: 'category' axis.
  // If type is not specified, but axis.data is specified, the type is auto set as 'category'.
  // If type is specified as 'category', but axis.data is not specified, axis.data will be auto collected from series.data. It brings convenience, but we should notice that axis.data provides then value range of the 'category' axis. If it is auto collected from series.data, Only the values appearing in series.data can be collected. For example, if series.data is empty, nothing will be collected.
  // Example:

  // // Name list of all categories
  // data: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
  // // Each item could also be a specific configuration item.
  // // In this case, `value` is used as the category name.
  // data: [{
  // value: 'Monday',
  // // Highlight Monday
  // textStyle: {
  // fontSize: 20,
  // color: 'red'
  // }
  // }, 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
  data: EChartsData,

  // axisPointer settings on the axis.
  axisPointer: PropTypes.object,

  // zlevel value of all graghical elements in x axis.
  // zlevel is used to make layers with Canvas. Graphical elements with different zlevel values will be placed in different Canvases, which is a common optimization technique. We can put those frequently changed elements (like those with animations) to a seperate zlevel. Notice that too many Canvases will increase memory cost, and should be used carefully on mobile phones to avoid crash.
  // Canvases with bigger zlevel will be placed on Canvases with smaller zlevel.
  zlevel: PropTypes.number,

  z: PropTypes.number,
});

export const EChartsTooltip = PropTypes.shape({
  // custom filter function
  filter: PropTypes.func,

  // If this is true, then format date
  isGroupedByDate: PropTypes.bool,

  // Truncate labels to this length
  truncate: PropTypes.oneOfType([PropTypes.bool, PropTypes.number]),

  /** echarts tooltip properties **/
  // Whether to show the tooltip component, including tooltip floating layer and axisPointer.
  show: PropTypes.bool,

  // Type of triggering.
  // Options:
  // 'item'
  // Triggered by data item, which is mainly used for charts that don't have a category axis like scatter charts or pie charts.
  // 'axis'
  // Triggered by axes, which is mainly used for charts that have category axes, like bar charts or line charts.
  // ECharts 2.x only supports axis trigger for category axis. In ECharts 3, it is supported for all types of axes in grid or polar. Also, you may assign axis with axisPointer.axis.
  // 'none'
  // Trigger nothing.
  trigger: PropTypes.oneOf(['item', 'axis', 'none']),

  // Configuration item for axis indicator.
  // See https://ecomfe.github.io/echarts-doc/public/en/option.html#tooltip.axisPointer
  axisPointer: PropTypes.object,

  // Whether to show the tooltip floating layer, whose default value is true. It should be configurated to be false, if you only need tooltip to trigger the event or show the axisPointer without content.
  showContent: PropTypes.bool,

  // Whether to show tooltip content all the time. By default, it will be hidden after some time. It can be set to be true to preserve displaying.
  // This attribute is newly added to ECharts 3.0.
  alwaysShowContent: PropTypes.bool,

  // Conditions to trigger tooltip. Options:
  // 'mousemove'

  // Trigger when mouse moves.

  // 'click'

  // Trigger when mouse clicks.

  // 'mousemove|click'

  // Trigger when mouse clicks and moves.

  // 'none'

  // Do not triggered by 'mousemove' and 'click'. Tooltip can be triggered and hidden manually by calling action.tooltip.showTip and action.tooltip.hideTip. It can also be triggered by axisPointer.handle in this case.

  // This attribute is new to ECharts 3.0.
  triggerOn: PropTypes.oneOf(['mousemove', 'click', 'mousemove|click', 'none']),

  // Delay time for showing tooltip, in ms. No delay by default, and it is not recommended to set. Only valid when triggerOn is set to be 'mousemove'.
  showDelay: PropTypes.number,

  // Delay time for hiding tooltip, in ms. It will be invalid when alwaysShowContent is true.
  hideDelay: PropTypes.number,

  // Whether mouse is allowed to enter the floating layer of tooltip, whose default value is false. If you need to interact in the tooltip like with links or buttons, it can be set as true.
  enterable: PropTypes.bool,

  // Whether confine tooltip content in the view rect of chart instance.
  // Useful when tooltip is cut because of 'overflow: hidden' set on outer dom of chart instance, or because of narrow screen on mobile.
  confine: PropTypes.bool,

  // The transition duration of tooltip's animation, in seconds. When it is set to be 0, it would move closely with the mouse.
  transitionDuration: PropTypes.number,

  // The position of the tooltip's floating layer, which would follow the position of mouse by default.
  // See https://ecomfe.github.io/echarts-doc/public/en/option.html#tooltip.position
  position: PropTypes.oneOfType([PropTypes.string, PropTypes.array]),

  // The content formatter of tooltip's floating layer which supports string template and callback function.
  // See https://ecomfe.github.io/echarts-doc/public/en/option.html#tooltip.formatter
  formatter: PropTypes.oneOfType([PropTypes.string, PropTypes.func]),

  // The background color of tooltip's floating layer.
  backgroundColor: PropTypes.string,

  // The border color of tooltip's floating layer.
  borderColor: PropTypes.string,

  // The border width of tooltip's floating layer.
  borderWidth: PropTypes.number,

  // The floating layer of tooltip space around content. The unit is px. Default values for each position are 5. And they can be set to different values with left, right, top, and bottom.
  // Examples:

  // // Set padding to be 5
  // padding: 5
  // // Set the top and bottom paddings to be 5, and left and right paddings to be 10
  // padding: [5, 10]
  // // Set each of the four paddings seperately
  // padding: [
  // 5,  // up
  // 10, // right
  // 5,  // down
  // 10, // left
  // ]
  padding: PropTypes.number,

  // The text syle of tooltip's floating layer.
  textStyle: PropTypes.object,

  extraCssText: PropTypes.string,
});

export const EChartsGrid = PropTypes.shape({
  // Component ID, not specified by default. If specified, it can be used to refer the component in option or API.
  id: PropTypes.string,

  // Whether to show the grid in rectangular coordinate.
  show: PropTypes.bool,

  // zlevel value of all graghical elements in .
  // zlevel is used to make layers with Canvas. Graphical elements with different zlevel values will be placed in different Canvases, which is a common optimization technique. We can put those frequently changed elements (like those with animations) to a seperate zlevel. Notice that too many Canvases will increase memory cost, and should be used carefully on mobile phones to avoid crash.
  // Canvases with bigger zlevel will be placed on Canvases with smaller zlevel.
  zlevel: PropTypes.number,

  // z value of all graghical elements in , which controls order of drawing graphical components. Components with smaller z values may be overwritten by those with larger z values.
  // z has a lower priority to zlevel, and will not create new Canvas.
  z: PropTypes.number,

  // Distance between grid component and the left side of the container.
  // left value can be instant pixel value like 20; it can also be percentage value relative to container width like '20%'; and it can also be 'left', 'center', or 'right'.
  // If the left value is set to be 'left', 'center', or 'right', then the component will be aligned automatically based on position.
  left: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),

  // Distance between grid component and the top side of the container.
  // top value can be instant pixel value like 20; it can also be percentage value relative to container width like '20%'; and it can also be 'top', 'middle', or 'bottom'.
  // If the left value is set to be 'top', 'middle', or 'bottom', then the component will be aligned automatically based on position.
  top: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),

  // Distance between grid component and the right side of the container.
  // right value can be instant pixel value like 20; it can also be percentage value relative to container width like '20%'.
  right: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),

  // Distance between grid component and the bottom side of the container.
  // bottom value can be instant pixel value like 20; it can also be percentage value relative to container width like '20%'.
  bottom: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),

  // Width of grid component. Adaptive by default.
  width: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),

  // Height of grid component. Adaptive by default.
  height: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),

  // Whether the grid region contains axis tick label of axis.
  // When containLabel is false:
  // grid.left grid.right grid.top grid.bottom grid.width grid.height decide the location and size of the rectangle that is made of by xAxis and yAxis.
  // Setting to false will helps when multiple gris need to be align at their axes.
  // When containLabel is true:
  // grid.left grid.right grid.top grid.bottom grid.width grid.height decide the location and size of the rectangle that is not only contains axes but also contains labels of those axes.
  // Setting to true will helps when the length of axis labels is dynamic and is hard to approximate to avoid them overflowing the container or overlapping other components.
  containLabel: PropTypes.bool,

  // Background color of grid, which is transparent by default.
  // Color can be represented in RGB, for example 'rgb(128, 128, 128)'. RGBA can be used when you need alpha channel, for example 'rgba(128, 128, 128, 0.5)'. You may also use hexadecimal format, for example '#ccc'.
  // Attention: Works only if show: true is set.
  backgroundColor: PropTypes.string,

  // Border color of grid. Support the same color format as backgroundColor.
  // Attention: Works only if show: true is set.
  borderColor: PropTypes.string,

  // Border width of grid.
  // Attention: Works only if show: true is set.
  borderWidth: PropTypes.number,

  // Size of shadow blur. This attribute should be used along with shadowColor,shadowOffsetX, shadowOffsetY to set shadow to component.
  // For example:

  // {
  // shadowColor: 'rgba(0, 0, 0, 0.5)',
  // shadowBlur: 10
  // }
  // Attention: This property works only if show: true is configured and backgroundColor is defined other than transparent.

  shadowBlur: PropTypes.number,

  // Shadow color. Support same format as color.
  // Attention: This property works only if show: true configured.
  shadowColor: PropTypes.string,

  // Offset distance on the horizontal direction of shadow.
  // Attention: This property works only if show: true configured.
  shadowOffsetX: PropTypes.number,

  // Offset distance on the vertical direction of shadow.
  // Attention: This property works only if show: true configured.
  shadowOffsetY: PropTypes.number,

  tooltip: EChartsTooltip,
});

export const EChartsLegend = PropTypes.shape({
  // Show legend on chart
  show: PropTypes.bool,
  truncate: PropTypes.oneOfType([PropTypes.bool, PropTypes.number]),
});

// See https://ecomfe.github.io/echarts-doc/public/en/option.html#dataZoom
export const EChartsDataZoom = PropTypes.arrayOf(
  PropTypes.oneOfType([
    PropTypes.shape({
      type: PropTypes.oneOf(['inside']),
    }),
    PropTypes.shape({
      type: PropTypes.oneOf(['slider']),
    }),
  ])
);

// See https://ecomfe.github.io/echarts-doc/public/en/option.html#toolbox
export const EChartsToolBox = PropTypes.shape({
  // Component ID, not specified by default. If specified, it can be used to refer the component in option or API.
  id: PropTypes.string,

  // Whether to show toolbox component.
  show: PropTypes.bool,

  // The layout orientation of toolbox's icon.
  orient: PropTypes.oneOf(['horizontal', 'vertical']),

  // The size of toolbox's icon.
  itemSize: PropTypes.number,

  // The gap between each icon of toolbox. It is horizontal gap in horizontal layout, while vertical gap in vertical layout.
  itemGap: PropTypes.number,

  // Whether to show the title of each tool icon when mouse hovers.
  showTitle: PropTypes.bool,

  // The configuration item for each tool.
  // Besides the tools we provide, user-defined toolbox is also supported.
  // Notes: User-defined tool name could only start with my, like myTool1 and myTool2 in the below example:

  // {
  // toolbox: {
  // feature: {
  // myTool1: {
  // show: true,
  // title: 'custom extension method 1',
  // icon: 'path://M432.45,595.444c0,2.177-4.661,6.82-11.305,6.82c-6.475,0-11.306-4.567-11.306-6.82s4.852-6.812,11.306-6.812C427.841,588.632,432.452,593.191,432.45,595.444L432.45,595.444z M421.155,589.876c-3.009,0-5.448,2.495-5.448,5.572s2.439,5.572,5.448,5.572c3.01,0,5.449-2.495,5.449-5.572C426.604,592.371,424.165,589.876,421.155,589.876L421.155,589.876z M421.146,591.891c-1.916,0-3.47,1.589-3.47,3.549c0,1.959,1.554,3.548,3.47,3.548s3.469-1.589,3.469-3.548C424.614,593.479,423.062,591.891,421.146,591.891L421.146,591.891zM421.146,591.891',
  // onclick: function (){
  // alert('myToolHandler1')
  // }
  // },
  // myTool2: {
  // show: true,
  // title: 'custom extension method',
  // icon: 'image://http://echarts.baidu.com/images/favicon.png',
  // onclick: function (){
  // alert('myToolHandler2')
  // }
  // }
  // }
  // }
  // }
  feature: PropTypes.object,

  // The style setting of Shared icon.
  iconStyle: PropTypes.object,

  // zlevel value of all graghical elements in .
  // zlevel is used to make layers with Canvas. Graphical elements with different zlevel values will be placed in different Canvases, which is a common optimization technique. We can put those frequently changed elements (like those with animations) to a seperate zlevel. Notice that too many Canvases will increase memory cost, and should be used carefully on mobile phones to avoid crash.
  // Canvases with bigger zlevel will be placed on Canvases with smaller zlevel.
  zlevel: PropTypes.number,

  // z value of all graghical elements in , which controls order of drawing graphical components. Components with smaller z values may be overwritten by those with larger z values.
  // z has a lower priority to zlevel, and will not create new Canvas.
  z: PropTypes.number,

  // Distance between toolbox component and the left side of the container.
  // left value can be instant pixel value like 20; it can also be percentage value relative to container width like '20%'; and it can also be 'left', 'center', or 'right'.
  // If the left value is set to be 'left', 'center', or 'right', then the component will be aligned automatically based on position.
  left: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),

  // Distance between toolbox component and the top side of the container.
  // top value can be instant pixel value like 20; it can also be percentage value relative to container width like '20%'; and it can also be 'top', 'middle', or 'bottom'.
  // If the left value is set to be 'top', 'middle', or 'bottom', then the component will be aligned automatically based on position.
  top: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),

  // Distance between toolbox component and the right side of the container.
  // right value can be instant pixel value like 20; it can also be percentage value relative to container width like '20%'.
  // Adaptive by default.
  right: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),

  // Distance between toolbox component and the bottom side of the container.
  // bottom value can be instant pixel value like 20; it can also be percentage value relative to container width like '20%'.
  // Adaptive by default.
  bottom: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),

  // Width of toolbox component. Adaptive by default.
  width: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  // Height of toolbox component. Adaptive by default.
  height: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
});

export const SeriesUnit = PropTypes.shape({
  seriesName: PropTypes.string,
  data: PropTypes.arrayOf(
    PropTypes.shape({
      value: PropTypes.number,
      // Number because datetime
      name: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    })
  ),
});

export const Series = PropTypes.arrayOf(SeriesUnit);

const SentryTypes = {
  AnyModel: PropTypes.shape({
    id: PropTypes.string.isRequired,
  }),
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
  Organization: PropTypes.shape({
    id: PropTypes.string.isRequired,
  }),
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
  Release,
  Repository,
  User,
  SavedSearch,
  SentryApplication,
  Widget,

  // echarts prop types
  EChartsSeries,
  EChartsSeriesUnit,
  EChartsXAxis: EChartsAxis,
  EChartsYAxis: EChartsAxis,
  EChartsTooltip,
  EChartsGrid,
  EChartsLegend,
  EChartsDataZoom,
  EChartsToolBox,
};

export default SentryTypes;
