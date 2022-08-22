"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_views_projectInstall_issueAlertOptions_tsx"],{

/***/ "./app/components/forms/MultipleCheckboxField.tsx":
/*!********************************************************!*\
  !*** ./app/components/forms/MultipleCheckboxField.tsx ***!
  \********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ MultipleCheckboxField)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var _checkboxFancy_checkboxFancy__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../checkboxFancy/checkboxFancy */ "./app/components/checkboxFancy/checkboxFancy.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");





function MultipleCheckboxField(props) {
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)("div", {
    className: props.className,
    children: props.choices.map(option => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsxs)(CheckboxWrapper, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(_checkboxFancy_checkboxFancy__WEBPACK_IMPORTED_MODULE_2__["default"], {
        size: props.size,
        isDisabled: option.disabled,
        isChecked: option.checked,
        isIndeterminate: option.intermediate,
        onClick: () => {
          var _props$onClick;

          (_props$onClick = props.onClick) === null || _props$onClick === void 0 ? void 0 : _props$onClick.call(props, option.value);
        }
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(CheckboxText, {
        children: option.title
      })]
    }, option.value.toString()))
  });
}
MultipleCheckboxField.displayName = "MultipleCheckboxField";

const CheckboxWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "eoudbc51"
} : 0)("margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_1__["default"])(2), ";display:flex;flex-direction:row;align-items:center;" + ( true ? "" : 0));

const CheckboxText = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('span',  true ? {
  target: "eoudbc50"
} : 0)("margin-left:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_1__["default"])(1), ";" + ( true ? "" : 0));

/***/ }),

/***/ "./app/views/alerts/rules/metric/presets.tsx":
/*!***************************************************!*\
  !*** ./app/views/alerts/rules/metric/presets.tsx ***!
  \***************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "PRESET_AGGREGATES": () => (/* binding */ PRESET_AGGREGATES)
/* harmony export */ });
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_guid__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/utils/guid */ "./app/utils/guid.tsx");
/* harmony import */ var _types__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./types */ "./app/views/alerts/rules/metric/types.tsx");





async function getHighestVolumeTransaction(client, organizationSlug, projectId) {
  const result = await client.requestPromise(`/organizations/${organizationSlug}/events/`, {
    method: 'GET',
    data: {
      statsPeriod: '7d',
      project: projectId,
      field: ['count()', 'transaction'],
      sort: '-count',
      referrer: 'alert.presets.highest-volume',
      query: 'event.type:transaction',
      per_page: 1
    }
  });
  const transaction = result.data[0];

  if (transaction) {
    return [transaction.transaction, transaction['count()']];
  }

  return null;
}

function makeTeamCriticalAlert(project) {
  let threshold = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 200;
  return {
    label: _types__WEBPACK_IMPORTED_MODULE_3__.AlertRuleTriggerType.CRITICAL,
    alertThreshold: threshold,
    actions: project.teams.slice(0, 4).map(team => ({
      type: _types__WEBPACK_IMPORTED_MODULE_3__.ActionType.EMAIL,
      targetType: _types__WEBPACK_IMPORTED_MODULE_3__.TargetType.TEAM,
      targetIdentifier: team.id,
      unsavedDateCreated: new Date().toISOString(),
      inputChannelId: null,
      options: null,
      unsavedId: (0,sentry_utils_guid__WEBPACK_IMPORTED_MODULE_2__.uniqueId)()
    }))
  };
}

function makeTeamWarningAlert() {
  let threshold = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 100;
  return {
    label: _types__WEBPACK_IMPORTED_MODULE_3__.AlertRuleTriggerType.WARNING,
    alertThreshold: threshold,
    actions: []
  };
}

const PRESET_AGGREGATES = [{
  id: 'p95-highest-volume',
  title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('Slow transactions'),
  description: 'Get notified when important transactions are slower on average',
  Icon: sentry_icons__WEBPACK_IMPORTED_MODULE_0__.IconGraph,
  alertType: 'trans_duration',

  makeUnqueriedContext(project, _) {
    return {
      name: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('p95 Alert for %s', [project.slug]),
      aggregate: 'p95(transaction.duration)',
      dataset: _types__WEBPACK_IMPORTED_MODULE_3__.Dataset.TRANSACTIONS,
      eventTypes: [_types__WEBPACK_IMPORTED_MODULE_3__.EventTypes.TRANSACTION],
      timeWindow: 60,
      comparisonDelta: 1440,
      comparisonType: _types__WEBPACK_IMPORTED_MODULE_3__.AlertRuleComparisonType.CHANGE,
      thresholdType: _types__WEBPACK_IMPORTED_MODULE_3__.AlertRuleThresholdType.ABOVE,
      triggers: [makeTeamCriticalAlert(project), makeTeamWarningAlert()]
    };
  },

  async makeContext(client, project, organization) {
    var _await$getHighestVolu;

    const transaction = (_await$getHighestVolu = await getHighestVolumeTransaction(client, organization.slug, project.id)) === null || _await$getHighestVolu === void 0 ? void 0 : _await$getHighestVolu[0];
    return { ...this.makeUnqueriedContext(project, organization),
      query: 'transaction:' + transaction
    };
  }

}, {
  id: 'throughput-highest-volume',
  title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('Throttled throughput'),
  description: 'Send an alert when transaction throughput drops significantly',
  Icon: sentry_icons__WEBPACK_IMPORTED_MODULE_0__.IconGraph,
  alertType: 'throughput',

  makeUnqueriedContext(project, _) {
    return {
      name: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('Throughput Alert for %s', [project.slug]),
      aggregate: 'count()',
      dataset: _types__WEBPACK_IMPORTED_MODULE_3__.Dataset.TRANSACTIONS,
      eventTypes: [_types__WEBPACK_IMPORTED_MODULE_3__.EventTypes.TRANSACTION],
      timeWindow: 30,
      comparisonDelta: 24 * 60 * 7,
      comparisonType: _types__WEBPACK_IMPORTED_MODULE_3__.AlertRuleComparisonType.CHANGE,
      thresholdType: _types__WEBPACK_IMPORTED_MODULE_3__.AlertRuleThresholdType.BELOW,
      triggers: [makeTeamCriticalAlert(project, 500), makeTeamWarningAlert(300)]
    };
  },

  async makeContext(client, project, organization) {
    var _await$getHighestVolu2;

    const transaction = (_await$getHighestVolu2 = await getHighestVolumeTransaction(client, organization.slug, project.id)) === null || _await$getHighestVolu2 === void 0 ? void 0 : _await$getHighestVolu2[0];
    return { ...this.makeUnqueriedContext(project, organization),
      query: 'transaction:' + transaction
    };
  }

}, {
  id: 'apdex-highest-volume',
  title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('Apdex Score'),
  description: 'Learn when the ratio of satisfactory, tolerable, and frustrated requests drop',
  Icon: sentry_icons__WEBPACK_IMPORTED_MODULE_0__.IconGraph,
  alertType: 'apdex',

  makeUnqueriedContext(project, _) {
    return {
      name: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('Apdex regression for %s', [project.slug]),
      aggregate: 'apdex(300)',
      dataset: _types__WEBPACK_IMPORTED_MODULE_3__.Dataset.TRANSACTIONS,
      eventTypes: [_types__WEBPACK_IMPORTED_MODULE_3__.EventTypes.TRANSACTION],
      timeWindow: 30,
      comparisonDelta: 24 * 60 * 7,
      comparisonType: _types__WEBPACK_IMPORTED_MODULE_3__.AlertRuleComparisonType.CHANGE,
      thresholdType: _types__WEBPACK_IMPORTED_MODULE_3__.AlertRuleThresholdType.BELOW,
      triggers: [makeTeamCriticalAlert(project), makeTeamWarningAlert()]
    };
  },

  async makeContext(client, project, organization) {
    var _await$getHighestVolu3;

    const transaction = (_await$getHighestVolu3 = await getHighestVolumeTransaction(client, organization.slug, project.id)) === null || _await$getHighestVolu3 === void 0 ? void 0 : _await$getHighestVolu3[0];
    return { ...this.makeUnqueriedContext(project, organization),
      query: 'transaction:' + transaction
    };
  }

}];

/***/ }),

/***/ "./app/views/projectInstall/issueAlertOptions.tsx":
/*!********************************************************!*\
  !*** ./app/views/projectInstall/issueAlertOptions.tsx ***!
  \********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "EVENT_FREQUENCY_PERCENT_CONDITION": () => (/* binding */ EVENT_FREQUENCY_PERCENT_CONDITION),
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/es.error.cause.js */ "../node_modules/core-js/modules/es.error.cause.js");
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var _emotion_react__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! @emotion/react */ "../node_modules/@emotion/react/dist/emotion-react.browser.esm.js");
/* harmony import */ var _sentry_react__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! @sentry/react */ "../node_modules/@sentry/hub/esm/exports.js");
/* harmony import */ var lodash_isEqual__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! lodash/isEqual */ "../node_modules/lodash/isEqual.js");
/* harmony import */ var lodash_isEqual__WEBPACK_IMPORTED_MODULE_5___default = /*#__PURE__*/__webpack_require__.n(lodash_isEqual__WEBPACK_IMPORTED_MODULE_5__);
/* harmony import */ var sentry_components_asyncComponent__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/asyncComponent */ "./app/components/asyncComponent.tsx");
/* harmony import */ var sentry_components_forms_controls_radioGroup__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/forms/controls/radioGroup */ "./app/components/forms/controls/radioGroup.tsx");
/* harmony import */ var sentry_components_forms_MultipleCheckboxField__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/forms/MultipleCheckboxField */ "./app/components/forms/MultipleCheckboxField.tsx");
/* harmony import */ var sentry_components_forms_selectControl__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/forms/selectControl */ "./app/components/forms/selectControl.tsx");
/* harmony import */ var sentry_components_input__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/input */ "./app/components/input.tsx");
/* harmony import */ var sentry_components_pageHeading__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/components/pageHeading */ "./app/components/pageHeading.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/utils/withOrganization */ "./app/utils/withOrganization.tsx");
/* harmony import */ var _alerts_rules_metric_presets__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! ../alerts/rules/metric/presets */ "./app/views/alerts/rules/metric/presets.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");





function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }

















var MetricValues;

(function (MetricValues) {
  MetricValues[MetricValues["ERRORS"] = 0] = "ERRORS";
  MetricValues[MetricValues["USERS"] = 1] = "USERS";
})(MetricValues || (MetricValues = {}));

var Actions;

(function (Actions) {
  Actions[Actions["ALERT_ON_EVERY_ISSUE"] = 0] = "ALERT_ON_EVERY_ISSUE";
  Actions[Actions["CUSTOMIZED_ALERTS"] = 1] = "CUSTOMIZED_ALERTS";
  Actions[Actions["CREATE_ALERT_LATER"] = 2] = "CREATE_ALERT_LATER";
})(Actions || (Actions = {}));

const UNIQUE_USER_FREQUENCY_CONDITION = 'sentry.rules.conditions.event_frequency.EventUniqueUserFrequencyCondition';
const EVENT_FREQUENCY_CONDITION = 'sentry.rules.conditions.event_frequency.EventFrequencyCondition';
const NOTIFY_EVENT_ACTION = 'sentry.rules.actions.notify_event.NotifyEventAction';
const EVENT_FREQUENCY_PERCENT_CONDITION = 'sentry.rules.conditions.event_frequency.EventFrequencyPercentCondition';
const METRIC_CONDITION_MAP = {
  [MetricValues.ERRORS]: EVENT_FREQUENCY_CONDITION,
  [MetricValues.USERS]: UNIQUE_USER_FREQUENCY_CONDITION
};
const DEFAULT_PLACEHOLDER_VALUE = '10';

function getConditionFrom(interval, metricValue, threshold) {
  let condition;

  switch (metricValue) {
    case MetricValues.ERRORS:
      condition = EVENT_FREQUENCY_CONDITION;
      break;

    case MetricValues.USERS:
      condition = UNIQUE_USER_FREQUENCY_CONDITION;
      break;

    default:
      throw new RangeError('Supplied metric value is not handled');
  }

  return {
    interval,
    id: condition,
    value: threshold
  };
}

function unpackConditions(conditions) {
  var _intervalChoices$;

  const equalityReducer = (acc, curr) => {
    if (!acc || !curr || !lodash_isEqual__WEBPACK_IMPORTED_MODULE_5___default()(acc, curr)) {
      return null;
    }

    return acc;
  };

  const intervalChoices = conditions.map(condition => {
    var _condition$formFields, _condition$formFields2;

    return (_condition$formFields = condition.formFields) === null || _condition$formFields === void 0 ? void 0 : (_condition$formFields2 = _condition$formFields.interval) === null || _condition$formFields2 === void 0 ? void 0 : _condition$formFields2.choices;
  }).reduce(equalityReducer);
  return {
    intervalChoices,
    interval: intervalChoices === null || intervalChoices === void 0 ? void 0 : (_intervalChoices$ = intervalChoices[0]) === null || _intervalChoices$ === void 0 ? void 0 : _intervalChoices$[0]
  };
}

class IssueAlertOptions extends sentry_components_asyncComponent__WEBPACK_IMPORTED_MODULE_6__["default"] {
  getDefaultState() {
    return { ...super.getDefaultState(),
      conditions: [],
      intervalChoices: [],
      alertSetting: Actions.CREATE_ALERT_LATER.toString(),
      metric: MetricValues.ERRORS,
      interval: '',
      threshold: '',
      metricAlertPresets: new Set()
    };
  }

  getAvailableMetricOptions() {
    return [{
      value: MetricValues.ERRORS,
      label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('occurrences of')
    }, {
      value: MetricValues.USERS,
      label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('users affected by')
    }].filter(_ref => {
      var _this$state$condition, _this$state$condition2;

      let {
        value
      } = _ref;
      return (_this$state$condition = this.state.conditions) === null || _this$state$condition === void 0 ? void 0 : (_this$state$condition2 = _this$state$condition.some) === null || _this$state$condition2 === void 0 ? void 0 : _this$state$condition2.call(_this$state$condition, object => (object === null || object === void 0 ? void 0 : object.id) === METRIC_CONDITION_MAP[value]);
    });
  }

  getIssueAlertsChoices(hasProperlyLoadedConditions) {
    const options = [[Actions.CREATE_ALERT_LATER.toString(), (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)("I'll create my own alerts later")], [Actions.ALERT_ON_EVERY_ISSUE.toString(), (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Alert me on every new issue')]];

    if (hasProperlyLoadedConditions) {
      var _this$state$intervalC;

      options.push([Actions.CUSTOMIZED_ALERTS.toString(), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsxs)(CustomizeAlertsGrid, {
        onClick: e => {
          // XXX(epurkhiser): The `e.preventDefault` here is needed to stop
          // propagation of the click up to the label, causing it to focus
          // the radio input and lose focus on the select.
          e.preventDefault();
          const alertSetting = Actions.CUSTOMIZED_ALERTS.toString();
          this.setStateAndUpdateParents({
            alertSetting
          });
        },
        children: [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('When there are more than'), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(InlineInput, {
          type: "number",
          min: "0",
          name: "",
          placeholder: DEFAULT_PLACEHOLDER_VALUE,
          value: this.state.threshold,
          onChange: threshold => this.setStateAndUpdateParents({
            threshold: threshold.target.value
          }),
          "data-test-id": "range-input"
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(InlineSelectControl, {
          value: this.state.metric,
          options: this.getAvailableMetricOptions(),
          onChange: metric => this.setStateAndUpdateParents({
            metric: metric.value
          }),
          "data-test-id": "metric-select-control"
        }), (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('a unique error in'), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(InlineSelectControl, {
          value: this.state.interval,
          options: (_this$state$intervalC = this.state.intervalChoices) === null || _this$state$intervalC === void 0 ? void 0 : _this$state$intervalC.map(_ref2 => {
            let [value, label] = _ref2;
            return {
              value,
              label
            };
          }),
          onChange: interval => this.setStateAndUpdateParents({
            interval: interval.value
          }),
          "data-test-id": "interval-select-control"
        })]
      }, Actions.CUSTOMIZED_ALERTS)]);
    }

    return options.map(_ref3 => {
      let [choiceValue, node] = _ref3;
      return [choiceValue, (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(RadioItemWrapper, {
        children: node
      }, choiceValue)];
    });
  }

  getUpdatedData() {
    let defaultRules;
    let shouldCreateCustomRule;
    const alertSetting = parseInt(this.state.alertSetting, 10);

    switch (alertSetting) {
      case Actions.ALERT_ON_EVERY_ISSUE:
        defaultRules = true;
        shouldCreateCustomRule = false;
        break;

      case Actions.CREATE_ALERT_LATER:
        defaultRules = false;
        shouldCreateCustomRule = false;
        break;

      case Actions.CUSTOMIZED_ALERTS:
        defaultRules = false;
        shouldCreateCustomRule = true;
        break;

      default:
        throw new RangeError('Supplied alert creation action is not handled');
    }

    return {
      defaultRules,
      shouldCreateCustomRule,
      name: 'Send a notification for new issues',
      conditions: this.state.interval.length > 0 && this.state.threshold.length > 0 ? [getConditionFrom(this.state.interval, this.state.metric, this.state.threshold)] : undefined,
      actions: [{
        id: NOTIFY_EVENT_ACTION
      }],
      actionMatch: 'all',
      frequency: 5,
      metricAlertPresets: Array.from(this.state.metricAlertPresets)
    };
  }

  setStateAndUpdateParents(state, callback) {
    this.setState(state, () => {
      callback === null || callback === void 0 ? void 0 : callback();
      this.props.onChange(this.getUpdatedData());
    });
  }

  getEndpoints() {
    return [['conditions', `/projects/${this.props.organization.slug}/rule-conditions/`]];
  }

  onLoadAllEndpointsSuccess() {
    var _this$state$condition3, _this$state$condition4;

    const conditions = (_this$state$condition3 = this.state.conditions) === null || _this$state$condition3 === void 0 ? void 0 : (_this$state$condition4 = _this$state$condition3.filter) === null || _this$state$condition4 === void 0 ? void 0 : _this$state$condition4.call(_this$state$condition3, object => Object.values(METRIC_CONDITION_MAP).includes(object === null || object === void 0 ? void 0 : object.id));

    if (!conditions || conditions.length === 0) {
      this.setStateAndUpdateParents({
        conditions: undefined
      });
      return;
    }

    const {
      intervalChoices,
      interval
    } = unpackConditions(conditions);

    if (!intervalChoices || !interval) {
      _sentry_react__WEBPACK_IMPORTED_MODULE_17__.withScope(scope => {
        scope.setExtra('props', this.props);
        scope.setExtra('state', this.state);
        _sentry_react__WEBPACK_IMPORTED_MODULE_17__.captureException(new Error('Interval choices or sent from API endpoint is inconsistent or empty'));
      });
      this.setStateAndUpdateParents({
        conditions: undefined
      });
      return;
    }

    this.setStateAndUpdateParents({
      conditions,
      intervalChoices,
      interval
    });
  }

  renderBody() {
    var _this$state$condition5;

    const issueAlertOptionsChoices = this.getIssueAlertsChoices(((_this$state$condition5 = this.state.conditions) === null || _this$state$condition5 === void 0 ? void 0 : _this$state$condition5.length) > 0);
    const showMetricAlertSelections = !!this.props.organization.experiments.MetricAlertOnProjectCreationExperiment;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsxs)(react__WEBPACK_IMPORTED_MODULE_4__.Fragment, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(PageHeadingWithTopMargins, {
        withMargins: true,
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Set your default alert settings')
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsxs)(Content, {
        children: [showMetricAlertSelections && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(Subheading, {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Issue Alerts')
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(RadioGroupWithPadding, {
          choices: issueAlertOptionsChoices,
          label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Options for creating an alert'),
          onChange: alertSetting => this.setStateAndUpdateParents({
            alertSetting
          }),
          value: this.state.alertSetting
        }), showMetricAlertSelections && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsxs)(react__WEBPACK_IMPORTED_MODULE_4__.Fragment, {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(Subheading, {
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Performance Alerts')
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_components_forms_MultipleCheckboxField__WEBPACK_IMPORTED_MODULE_8__["default"], {
            size: "24px",
            choices: _alerts_rules_metric_presets__WEBPACK_IMPORTED_MODULE_15__.PRESET_AGGREGATES.map(agg => ({
              title: agg.description,
              value: agg.id,
              checked: this.state.metricAlertPresets.has(agg.id)
            })),
            css: CheckboxFieldStyles,
            onClick: selectedItem => {
              const next = new Set(this.state.metricAlertPresets);

              if (next.has(selectedItem)) {
                next.delete(selectedItem);
              } else {
                next.add(selectedItem);
              }

              this.setStateAndUpdateParents({
                metricAlertPresets: next
              });
            }
          })]
        })]
      })]
    });
  }

}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_14__["default"])(IssueAlertOptions));
const CheckboxFieldStyles = /*#__PURE__*/(0,_emotion_react__WEBPACK_IMPORTED_MODULE_18__.css)("margin-top:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_13__["default"])(1), ";" + ( true ? "" : 0),  true ? "" : 0);

const Content = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e12p23qf7"
} : 0)("padding-top:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_13__["default"])(2), ";padding-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_13__["default"])(4), ";" + ( true ? "" : 0));

const CustomizeAlertsGrid = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e12p23qf6"
} : 0)("display:grid;grid-template-columns:repeat(5, max-content);gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_13__["default"])(1), ";align-items:center;" + ( true ? "" : 0));

const InlineInput = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_input__WEBPACK_IMPORTED_MODULE_10__["default"],  true ? {
  target: "e12p23qf5"
} : 0)( true ? {
  name: "m0jwvv",
  styles: "width:80px"
} : 0);

const InlineSelectControl = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_forms_selectControl__WEBPACK_IMPORTED_MODULE_9__["default"],  true ? {
  target: "e12p23qf4"
} : 0)( true ? {
  name: "efbx4f",
  styles: "width:160px"
} : 0);

const RadioGroupWithPadding = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_forms_controls_radioGroup__WEBPACK_IMPORTED_MODULE_7__["default"],  true ? {
  target: "e12p23qf3"
} : 0)("margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_13__["default"])(2), ";" + ( true ? "" : 0));

const PageHeadingWithTopMargins = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_pageHeading__WEBPACK_IMPORTED_MODULE_11__["default"],  true ? {
  target: "e12p23qf2"
} : 0)("margin-top:65px;margin-bottom:0;padding-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_13__["default"])(3), ";border-bottom:1px solid rgba(0, 0, 0, 0.1);" + ( true ? "" : 0));

const RadioItemWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e12p23qf1"
} : 0)( true ? {
  name: "p9mutn",
  styles: "min-height:35px;display:flex;flex-direction:column;justify-content:center"
} : 0);

const Subheading = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('b',  true ? {
  target: "e12p23qf0"
} : 0)( true ? {
  name: "4zleql",
  styles: "display:block"
} : 0);

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_views_projectInstall_issueAlertOptions_tsx.f8a8b32503955d5420b0b66f87320a5f.js.map