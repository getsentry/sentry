"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_views_alerts_utils_index_tsx"],{

/***/ "./app/views/alerts/rules/metric/types.tsx":
/*!*************************************************!*\
  !*** ./app/views/alerts/rules/metric/types.tsx ***!
  \*************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "ActionLabel": () => (/* binding */ ActionLabel),
/* harmony export */   "ActionType": () => (/* binding */ ActionType),
/* harmony export */   "AlertRuleComparisonType": () => (/* binding */ AlertRuleComparisonType),
/* harmony export */   "AlertRuleThresholdType": () => (/* binding */ AlertRuleThresholdType),
/* harmony export */   "AlertRuleTriggerType": () => (/* binding */ AlertRuleTriggerType),
/* harmony export */   "Dataset": () => (/* binding */ Dataset),
/* harmony export */   "Datasource": () => (/* binding */ Datasource),
/* harmony export */   "EventTypes": () => (/* binding */ EventTypes),
/* harmony export */   "SessionsAggregate": () => (/* binding */ SessionsAggregate),
/* harmony export */   "TargetLabel": () => (/* binding */ TargetLabel),
/* harmony export */   "TargetType": () => (/* binding */ TargetType),
/* harmony export */   "TimePeriod": () => (/* binding */ TimePeriod),
/* harmony export */   "TimeWindow": () => (/* binding */ TimeWindow)
/* harmony export */ });
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");

let AlertRuleThresholdType;

(function (AlertRuleThresholdType) {
  AlertRuleThresholdType[AlertRuleThresholdType["ABOVE"] = 0] = "ABOVE";
  AlertRuleThresholdType[AlertRuleThresholdType["BELOW"] = 1] = "BELOW";
})(AlertRuleThresholdType || (AlertRuleThresholdType = {}));

let AlertRuleTriggerType;

(function (AlertRuleTriggerType) {
  AlertRuleTriggerType["CRITICAL"] = "critical";
  AlertRuleTriggerType["WARNING"] = "warning";
  AlertRuleTriggerType["RESOLVE"] = "resolve";
})(AlertRuleTriggerType || (AlertRuleTriggerType = {}));

let AlertRuleComparisonType;

(function (AlertRuleComparisonType) {
  AlertRuleComparisonType["COUNT"] = "count";
  AlertRuleComparisonType["CHANGE"] = "change";
  AlertRuleComparisonType["PERCENT"] = "percent";
})(AlertRuleComparisonType || (AlertRuleComparisonType = {}));

let Dataset;

(function (Dataset) {
  Dataset["ERRORS"] = "events";
  Dataset["TRANSACTIONS"] = "transactions";
  Dataset["GENERIC_METRICS"] = "generic_metrics";
  Dataset["SESSIONS"] = "sessions";
  Dataset["METRICS"] = "metrics";
})(Dataset || (Dataset = {}));

let EventTypes;

(function (EventTypes) {
  EventTypes["DEFAULT"] = "default";
  EventTypes["ERROR"] = "error";
  EventTypes["TRANSACTION"] = "transaction";
  EventTypes["USER"] = "user";
  EventTypes["SESSION"] = "session";
})(EventTypes || (EventTypes = {}));

let Datasource;
/**
 * This is not a real aggregate as crash-free sessions/users can be only calculated on frontend by comparing the count of sessions broken down by status
 * It is here nevertheless to shoehorn sessions dataset into existing alerts codebase
 * This will most likely be revised as we introduce the metrics dataset
 */

(function (Datasource) {
  Datasource["ERROR_DEFAULT"] = "error_default";
  Datasource["DEFAULT"] = "default";
  Datasource["ERROR"] = "error";
  Datasource["TRANSACTION"] = "transaction";
})(Datasource || (Datasource = {}));

let SessionsAggregate;

(function (SessionsAggregate) {
  SessionsAggregate["CRASH_FREE_SESSIONS"] = "percentage(sessions_crashed, sessions) AS _crash_rate_alert_aggregate";
  SessionsAggregate["CRASH_FREE_USERS"] = "percentage(users_crashed, users) AS _crash_rate_alert_aggregate";
})(SessionsAggregate || (SessionsAggregate = {}));

let TimePeriod;

(function (TimePeriod) {
  TimePeriod["SIX_HOURS"] = "6h";
  TimePeriod["ONE_DAY"] = "1d";
  TimePeriod["THREE_DAYS"] = "3d";
  TimePeriod["SEVEN_DAYS"] = "10000m";
  TimePeriod["FOURTEEN_DAYS"] = "14d";
  TimePeriod["THIRTY_DAYS"] = "30d";
})(TimePeriod || (TimePeriod = {}));

let TimeWindow;

(function (TimeWindow) {
  TimeWindow[TimeWindow["ONE_MINUTE"] = 1] = "ONE_MINUTE";
  TimeWindow[TimeWindow["FIVE_MINUTES"] = 5] = "FIVE_MINUTES";
  TimeWindow[TimeWindow["TEN_MINUTES"] = 10] = "TEN_MINUTES";
  TimeWindow[TimeWindow["FIFTEEN_MINUTES"] = 15] = "FIFTEEN_MINUTES";
  TimeWindow[TimeWindow["THIRTY_MINUTES"] = 30] = "THIRTY_MINUTES";
  TimeWindow[TimeWindow["ONE_HOUR"] = 60] = "ONE_HOUR";
  TimeWindow[TimeWindow["TWO_HOURS"] = 120] = "TWO_HOURS";
  TimeWindow[TimeWindow["FOUR_HOURS"] = 240] = "FOUR_HOURS";
  TimeWindow[TimeWindow["ONE_DAY"] = 1440] = "ONE_DAY";
})(TimeWindow || (TimeWindow = {}));

let ActionType;

(function (ActionType) {
  ActionType["EMAIL"] = "email";
  ActionType["SLACK"] = "slack";
  ActionType["PAGERDUTY"] = "pagerduty";
  ActionType["MSTEAMS"] = "msteams";
  ActionType["SENTRY_APP"] = "sentry_app";
})(ActionType || (ActionType = {}));

const ActionLabel = {
  // \u200B is needed because Safari disregards autocomplete="off". It's seeing "Email" and
  // opening up the browser autocomplete for email. https://github.com/JedWatson/react-select/issues/3500
  [ActionType.EMAIL]: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Emai\u200Bl'),
  [ActionType.SLACK]: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Slack'),
  [ActionType.PAGERDUTY]: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Pagerduty'),
  [ActionType.MSTEAMS]: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('MS Teams'),
  [ActionType.SENTRY_APP]: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Notification')
};
let TargetType;

(function (TargetType) {
  TargetType["SPECIFIC"] = "specific";
  TargetType["USER"] = "user";
  TargetType["TEAM"] = "team";
  TargetType["SENTRY_APP"] = "sentry_app";
})(TargetType || (TargetType = {}));

const TargetLabel = {
  [TargetType.USER]: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Member'),
  [TargetType.TEAM]: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Team')
};
/**
 * This is an available action template that is associated to a Trigger in a
 * Metric Alert Rule. They are defined by the available-actions API.
 */

/***/ }),

/***/ "./app/views/alerts/types.tsx":
/*!************************************!*\
  !*** ./app/views/alerts/types.tsx ***!
  \************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "AlertRuleStatus": () => (/* binding */ AlertRuleStatus),
/* harmony export */   "AlertRuleType": () => (/* binding */ AlertRuleType),
/* harmony export */   "CombinedAlertType": () => (/* binding */ CombinedAlertType),
/* harmony export */   "IncidentActivityType": () => (/* binding */ IncidentActivityType),
/* harmony export */   "IncidentStatus": () => (/* binding */ IncidentStatus),
/* harmony export */   "IncidentStatusMethod": () => (/* binding */ IncidentStatusMethod)
/* harmony export */ });
let AlertRuleType;

(function (AlertRuleType) {
  AlertRuleType["METRIC"] = "metric";
  AlertRuleType["ISSUE"] = "issue";
})(AlertRuleType || (AlertRuleType = {}));

let IncidentActivityType;

(function (IncidentActivityType) {
  IncidentActivityType[IncidentActivityType["CREATED"] = 0] = "CREATED";
  IncidentActivityType[IncidentActivityType["DETECTED"] = 1] = "DETECTED";
  IncidentActivityType[IncidentActivityType["STATUS_CHANGE"] = 2] = "STATUS_CHANGE";
  IncidentActivityType[IncidentActivityType["COMMENT"] = 3] = "COMMENT";
  IncidentActivityType[IncidentActivityType["STARTED"] = 4] = "STARTED";
})(IncidentActivityType || (IncidentActivityType = {}));

let IncidentStatus;

(function (IncidentStatus) {
  IncidentStatus[IncidentStatus["OPENED"] = 1] = "OPENED";
  IncidentStatus[IncidentStatus["CLOSED"] = 2] = "CLOSED";
  IncidentStatus[IncidentStatus["WARNING"] = 10] = "WARNING";
  IncidentStatus[IncidentStatus["CRITICAL"] = 20] = "CRITICAL";
})(IncidentStatus || (IncidentStatus = {}));

let IncidentStatusMethod;

(function (IncidentStatusMethod) {
  IncidentStatusMethod[IncidentStatusMethod["MANUAL"] = 1] = "MANUAL";
  IncidentStatusMethod[IncidentStatusMethod["RULE_UPDATED"] = 2] = "RULE_UPDATED";
  IncidentStatusMethod[IncidentStatusMethod["RULE_TRIGGERED"] = 3] = "RULE_TRIGGERED";
})(IncidentStatusMethod || (IncidentStatusMethod = {}));

let AlertRuleStatus;

(function (AlertRuleStatus) {
  AlertRuleStatus[AlertRuleStatus["PENDING"] = 0] = "PENDING";
  AlertRuleStatus[AlertRuleStatus["SNAPSHOT"] = 4] = "SNAPSHOT";
  AlertRuleStatus[AlertRuleStatus["DISABLED"] = 5] = "DISABLED";
})(AlertRuleStatus || (AlertRuleStatus = {}));

let CombinedAlertType;

(function (CombinedAlertType) {
  CombinedAlertType["METRIC"] = "alert_rule";
  CombinedAlertType["ISSUE"] = "rule";
})(CombinedAlertType || (CombinedAlertType = {}));

/***/ }),

/***/ "./app/views/alerts/utils/index.tsx":
/*!******************************************!*\
  !*** ./app/views/alerts/utils/index.tsx ***!
  \******************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "ALERT_CHART_MIN_MAX_BUFFER": () => (/* binding */ ALERT_CHART_MIN_MAX_BUFFER),
/* harmony export */   "DATA_SOURCE_LABELS": () => (/* binding */ DATA_SOURCE_LABELS),
/* harmony export */   "DATA_SOURCE_TO_SET_AND_EVENT_TYPES": () => (/* binding */ DATA_SOURCE_TO_SET_AND_EVENT_TYPES),
/* harmony export */   "SESSION_AGGREGATE_TO_FIELD": () => (/* binding */ SESSION_AGGREGATE_TO_FIELD),
/* harmony export */   "alertAxisFormatter": () => (/* binding */ alertAxisFormatter),
/* harmony export */   "alertDetailsLink": () => (/* binding */ alertDetailsLink),
/* harmony export */   "alertTooltipValueFormatter": () => (/* binding */ alertTooltipValueFormatter),
/* harmony export */   "convertDatasetEventTypesToSource": () => (/* binding */ convertDatasetEventTypesToSource),
/* harmony export */   "getQueryDatasource": () => (/* binding */ getQueryDatasource),
/* harmony export */   "getQueryStatus": () => (/* binding */ getQueryStatus),
/* harmony export */   "getStartEndFromStats": () => (/* binding */ getStartEndFromStats),
/* harmony export */   "getTeamParams": () => (/* binding */ getTeamParams),
/* harmony export */   "isIssueAlert": () => (/* binding */ isIssueAlert),
/* harmony export */   "isSessionAggregate": () => (/* binding */ isSessionAggregate),
/* harmony export */   "shouldScaleAlertChart": () => (/* binding */ shouldScaleAlertChart)
/* harmony export */ });
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/es.string.replace.js */ "../node_modules/core-js/modules/es.string.replace.js");
/* harmony import */ var core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var lodash_round__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! lodash/round */ "../node_modules/lodash/round.js");
/* harmony import */ var lodash_round__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(lodash_round__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_types__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/types */ "./app/types/index.tsx");
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");
/* harmony import */ var sentry_utils_dates__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/utils/dates */ "./app/utils/dates.tsx");
/* harmony import */ var sentry_utils_discover_charts__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/utils/discover/charts */ "./app/utils/discover/charts.tsx");
/* harmony import */ var sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/utils/discover/fields */ "./app/utils/discover/fields.tsx");
/* harmony import */ var sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/views/alerts/rules/metric/types */ "./app/views/alerts/rules/metric/types.tsx");
/* harmony import */ var _types__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! ../types */ "./app/views/alerts/types.tsx");











/**
 * Gets start and end date query parameters from stats
 */

function getStartEndFromStats(stats) {
  const start = (0,sentry_utils_dates__WEBPACK_IMPORTED_MODULE_6__.getUtcDateString)(stats.eventStats.data[0][0] * 1000);
  const end = (0,sentry_utils_dates__WEBPACK_IMPORTED_MODULE_6__.getUtcDateString)(stats.eventStats.data[stats.eventStats.data.length - 1][0] * 1000);
  return {
    start,
    end
  };
}
function isIssueAlert(data) {
  return !data.hasOwnProperty('triggers');
}
const DATA_SOURCE_LABELS = {
  [sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_9__.Dataset.ERRORS]: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Errors'),
  [sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_9__.Dataset.TRANSACTIONS]: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Transactions'),
  [sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_9__.Datasource.ERROR_DEFAULT]: 'event.type:error OR event.type:default',
  [sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_9__.Datasource.ERROR]: 'event.type:error',
  [sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_9__.Datasource.DEFAULT]: 'event.type:default',
  [sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_9__.Datasource.TRANSACTION]: 'event.type:transaction'
}; // Maps a datasource to the relevant dataset and event_types for the backend to use

const DATA_SOURCE_TO_SET_AND_EVENT_TYPES = {
  [sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_9__.Datasource.ERROR_DEFAULT]: {
    dataset: sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_9__.Dataset.ERRORS,
    eventTypes: [sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_9__.EventTypes.ERROR, sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_9__.EventTypes.DEFAULT]
  },
  [sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_9__.Datasource.ERROR]: {
    dataset: sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_9__.Dataset.ERRORS,
    eventTypes: [sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_9__.EventTypes.ERROR]
  },
  [sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_9__.Datasource.DEFAULT]: {
    dataset: sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_9__.Dataset.ERRORS,
    eventTypes: [sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_9__.EventTypes.DEFAULT]
  },
  [sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_9__.Datasource.TRANSACTION]: {
    dataset: sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_9__.Dataset.TRANSACTIONS,
    eventTypes: [sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_9__.EventTypes.TRANSACTION]
  }
}; // Converts the given dataset and event types array to a datasource for the datasource dropdown

function convertDatasetEventTypesToSource(dataset, eventTypes) {
  // transactions and generic_metrics only have one datasource option regardless of event type
  if (dataset === sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_9__.Dataset.TRANSACTIONS || dataset === sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_9__.Dataset.GENERIC_METRICS) {
    return sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_9__.Datasource.TRANSACTION;
  } // if no event type was provided use the default datasource


  if (!eventTypes) {
    return sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_9__.Datasource.ERROR;
  }

  if (eventTypes.includes(sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_9__.EventTypes.DEFAULT) && eventTypes.includes(sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_9__.EventTypes.ERROR)) {
    return sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_9__.Datasource.ERROR_DEFAULT;
  }

  if (eventTypes.includes(sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_9__.EventTypes.DEFAULT)) {
    return sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_9__.Datasource.DEFAULT;
  }

  return sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_9__.Datasource.ERROR;
}
/**
 * Attempt to guess the data source of a discover query
 *
 * @returns An object containing the datasource and new query without the datasource.
 * Returns null on no datasource.
 */

function getQueryDatasource(query) {
  let match = query.match(/\(?\bevent\.type:(error|default|transaction)\)?\WOR\W\(?event\.type:(error|default|transaction)\)?/i);

  if (match) {
    // should be [error, default] or [default, error]
    const eventTypes = match.slice(1, 3).sort().join(',');

    if (eventTypes !== 'default,error') {
      return null;
    }

    return {
      source: sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_9__.Datasource.ERROR_DEFAULT,
      query: query.replace(match[0], '').trim()
    };
  }

  match = query.match(/(^|\s)event\.type:(error|default|transaction)/i);

  if (match && sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_9__.Datasource[match[2].toUpperCase()]) {
    return {
      source: sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_9__.Datasource[match[2].toUpperCase()],
      query: query.replace(match[0], '').trim()
    };
  }

  return null;
}
function isSessionAggregate(aggregate) {
  return Object.values(sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_9__.SessionsAggregate).includes(aggregate);
}
const SESSION_AGGREGATE_TO_FIELD = {
  [sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_9__.SessionsAggregate.CRASH_FREE_SESSIONS]: sentry_types__WEBPACK_IMPORTED_MODULE_4__.SessionFieldWithOperation.SESSIONS,
  [sentry_views_alerts_rules_metric_types__WEBPACK_IMPORTED_MODULE_9__.SessionsAggregate.CRASH_FREE_USERS]: sentry_types__WEBPACK_IMPORTED_MODULE_4__.SessionFieldWithOperation.USERS
};
function alertAxisFormatter(value, seriesName, aggregate) {
  if (isSessionAggregate(aggregate)) {
    return (0,sentry_utils__WEBPACK_IMPORTED_MODULE_5__.defined)(value) ? `${lodash_round__WEBPACK_IMPORTED_MODULE_2___default()(value, 2)}%` : '\u2015';
  }

  return (0,sentry_utils_discover_charts__WEBPACK_IMPORTED_MODULE_7__.axisLabelFormatter)(value, (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_8__.aggregateOutputType)(seriesName));
}
function alertTooltipValueFormatter(value, seriesName, aggregate) {
  if (isSessionAggregate(aggregate)) {
    return (0,sentry_utils__WEBPACK_IMPORTED_MODULE_5__.defined)(value) ? `${value}%` : '\u2015';
  }

  return (0,sentry_utils_discover_charts__WEBPACK_IMPORTED_MODULE_7__.tooltipFormatter)(value, (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_8__.aggregateOutputType)(seriesName));
}
const ALERT_CHART_MIN_MAX_BUFFER = 1.03;
function shouldScaleAlertChart(aggregate) {
  // We want crash free rate charts to be scaled because they are usually too
  // close to 100% and therefore too fine to see the spikes on 0%-100% scale.
  return isSessionAggregate(aggregate);
}
function alertDetailsLink(organization, incident) {
  return `/organizations/${organization.slug}/alerts/rules/details/${incident.alertRule.status === _types__WEBPACK_IMPORTED_MODULE_10__.AlertRuleStatus.SNAPSHOT && incident.alertRule.originalAlertRuleId ? incident.alertRule.originalAlertRuleId : incident.alertRule.id}/`;
}
/**
 * Noramlizes a status string
 */

function getQueryStatus(status) {
  if (Array.isArray(status) || status === '') {
    return 'all';
  }

  return ['open', 'closed'].includes(status) ? status : 'all';
}
const ALERT_LIST_QUERY_DEFAULT_TEAMS = ['myteams', 'unassigned'];
/**
 * Noramlize a team slug from the query
 */

function getTeamParams(team) {
  if (team === undefined) {
    return ALERT_LIST_QUERY_DEFAULT_TEAMS;
  }

  if (team === '') {
    return [];
  }

  if (Array.isArray(team)) {
    return team;
  }

  return [team];
}

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_views_alerts_utils_index_tsx.38188bfee3bd481a0e25854995a2e589.js.map