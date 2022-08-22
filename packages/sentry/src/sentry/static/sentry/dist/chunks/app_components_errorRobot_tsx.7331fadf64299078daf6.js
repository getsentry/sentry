"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_components_errorRobot_tsx"],{

/***/ "./app/components/errorRobot.tsx":
/*!***************************************!*\
  !*** ./app/components/errorRobot.tsx ***!
  \***************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "ErrorRobot": () => (/* binding */ ErrorRobot),
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_images_spot_sentry_robot_png__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry-images/spot/sentry-robot.png */ "./images/spot/sentry-robot.png");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_links_link__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/links/link */ "./app/components/links/link.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");
/* harmony import */ var sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/utils/withApi */ "./app/utils/withApi.tsx");
/* harmony import */ var sentry_views_onboarding_createSampleEventButton__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/views/onboarding/createSampleEventButton */ "./app/views/onboarding/createSampleEventButton.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }













class ErrorRobot extends react__WEBPACK_IMPORTED_MODULE_3__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", {
      error: false,
      loading: false,
      sampleIssueId: this.props.sampleIssueId
    });
  }

  componentDidMount() {
    this.fetchData();
  }

  async fetchData() {
    const {
      org,
      project
    } = this.props;
    const {
      sampleIssueId
    } = this.state;

    if (!project) {
      return;
    }

    if ((0,sentry_utils__WEBPACK_IMPORTED_MODULE_9__.defined)(sampleIssueId)) {
      return;
    }

    const url = `/projects/${org.slug}/${project.slug}/issues/`;
    this.setState({
      loading: true
    });

    try {
      const data = await this.props.api.requestPromise(url, {
        method: 'GET',
        data: {
          limit: 1
        }
      });
      this.setState({
        sampleIssueId: data.length > 0 && data[0].id || ''
      });
    } catch (err) {
      var _err$responseJSON$det, _err$responseJSON;

      const error = (_err$responseJSON$det = err === null || err === void 0 ? void 0 : (_err$responseJSON = err.responseJSON) === null || _err$responseJSON === void 0 ? void 0 : _err$responseJSON.detail) !== null && _err$responseJSON$det !== void 0 ? _err$responseJSON$det : true;
      this.setState({
        error
      });
    }

    this.setState({
      loading: false
    });
  }

  render() {
    const {
      loading,
      error,
      sampleIssueId
    } = this.state;
    const {
      org,
      project,
      gradient
    } = this.props;
    const sampleLink = project && (loading || error ? null : sampleIssueId) ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)("p", {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(sentry_components_links_link__WEBPACK_IMPORTED_MODULE_6__["default"], {
        to: `/${org.slug}/${project.slug}/issues/${sampleIssueId}/?sample`,
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Or see your sample event')
      })
    }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)("p", {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(sentry_views_onboarding_createSampleEventButton__WEBPACK_IMPORTED_MODULE_11__["default"], {
        priority: "link",
        project: project,
        source: "issues_list",
        disabled: !project,
        title: !project ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Select a project to create a sample event') : undefined,
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Create a sample event')
      })
    });
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsxs)(ErrorRobotWrapper, {
      "data-test-id": "awaiting-events",
      className: "awaiting-events",
      gradient: gradient,
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(Robot, {
        "aria-hidden": true,
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(Eye, {})
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsxs)(MessageContainer, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)("h3", {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Waiting for events…')
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)("p", {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.tct)('Our error robot is waiting to [strike:devour] receive your first event.', {
            strike: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(Strikethrough, {})
          })
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)("p", {
          children: project && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_5__["default"], {
            "data-test-id": "install-instructions",
            priority: "primary",
            to: `/${org.slug}/${project.slug}/getting-started/${project.platform || ''}`,
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Installation Instructions')
          })
        }), sampleLink]
      })]
    });
  }

}

ErrorRobot.displayName = "ErrorRobot";

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_10__["default"])(ErrorRobot));

const ErrorRobotWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "ek4sdqz4"
} : 0)("display:flex;justify-content:center;font-size:", p => p.theme.fontSizeExtraLarge, ";box-shadow:inset 0 1px 3px rgba(0, 0, 0, 0.08);border-radius:0 0 3px 3px;padding:40px ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_8__["default"])(3), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_8__["default"])(3), ";min-height:260px;@media (max-width: ", p => p.theme.breakpoints.small, "){flex-direction:column;align-items:center;padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_8__["default"])(3), ";text-align:center;}" + ( true ? "" : 0));

const Robot = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "ek4sdqz3"
} : 0)("display:block;position:relative;width:220px;height:260px;background:url(", sentry_images_spot_sentry_robot_png__WEBPACK_IMPORTED_MODULE_4__, ");background-size:cover;@media (max-width: ", p => p.theme.breakpoints.small, "){width:110px;height:130px;}" + ( true ? "" : 0));

const Eye = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('span',  true ? {
  target: "ek4sdqz2"
} : 0)("width:12px;height:12px;border-radius:50%;position:absolute;top:70px;left:81px;transform:translateZ(0);animation:blink-eye 0.6s infinite;@media (max-width: ", p => p.theme.breakpoints.small, "){width:6px;height:6px;top:35px;left:41px;}@keyframes blink-eye{0%{background:#e03e2f;box-shadow:0 0 10px #e03e2f;}50%{background:#4a4d67;box-shadow:none;}100%{background:#e03e2f;box-shadow:0 0 10px #e03e2f;}}" + ( true ? "" : 0));

const MessageContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "ek4sdqz1"
} : 0)("align-self:center;max-width:480px;margin-left:40px;@media (max-width: ", p => p.theme.breakpoints.small, "){margin:0;}" + ( true ? "" : 0));

const Strikethrough = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('span',  true ? {
  target: "ek4sdqz0"
} : 0)( true ? {
  name: "1rcj98u",
  styles: "text-decoration:line-through"
} : 0);

/***/ }),

/***/ "./app/views/onboarding/createSampleEventButton.tsx":
/*!**********************************************************!*\
  !*** ./app/views/onboarding/createSampleEventButton.tsx ***!
  \**********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/es.error.cause.js */ "../node_modules/core-js/modules/es.error.cause.js");
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var react_router__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! react-router */ "../node_modules/react-router/es/index.js");
/* harmony import */ var _sentry_react__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! @sentry/react */ "../node_modules/@sentry/hub/esm/exports.js");
/* harmony import */ var sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/actionCreators/indicator */ "./app/actionCreators/indicator.tsx");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/utils/analytics/trackAdvancedAnalyticsEvent */ "./app/utils/analytics/trackAdvancedAnalyticsEvent.tsx");
/* harmony import */ var sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/utils/withApi */ "./app/utils/withApi.tsx");
/* harmony import */ var sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/utils/withOrganization */ "./app/utils/withOrganization.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");













const EVENT_POLL_RETRIES = 30;
const EVENT_POLL_INTERVAL = 1000;

async function latestEventAvailable(api, groupID) {
  let retries = 0; // eslint-disable-next-line no-constant-condition

  while (true) {
    if (retries > EVENT_POLL_RETRIES) {
      return {
        eventCreated: false,
        retries: retries - 1
      };
    }

    await new Promise(resolve => window.setTimeout(resolve, EVENT_POLL_INTERVAL));

    try {
      await api.requestPromise(`/issues/${groupID}/events/latest/`);
      return {
        eventCreated: true,
        retries
      };
    } catch {
      ++retries;
    }
  }
}

class CreateSampleEventButton extends react__WEBPACK_IMPORTED_MODULE_3__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", {
      creating: false
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "createSampleGroup", async () => {
      // TODO(dena): swap out for action creator
      const {
        api,
        organization,
        project
      } = this.props;
      let eventData;

      if (!project) {
        return;
      }

      (0,sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_8__["default"])('growth.onboarding_view_sample_event', {
        platform: project.platform,
        organization
      });
      (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_5__.addLoadingMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Processing sample event...'), {
        duration: EVENT_POLL_RETRIES * EVENT_POLL_INTERVAL
      });
      this.setState({
        creating: true
      });

      try {
        const url = `/projects/${organization.slug}/${project.slug}/create-sample/`;
        eventData = await api.requestPromise(url, {
          method: 'POST'
        });
      } catch (error) {
        _sentry_react__WEBPACK_IMPORTED_MODULE_11__.withScope(scope => {
          scope.setExtra('error', error);
          _sentry_react__WEBPACK_IMPORTED_MODULE_11__.captureException(new Error('Failed to create sample event'));
        });
        this.setState({
          creating: false
        });
        (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_5__.clearIndicators)();
        (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_5__.addErrorMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Failed to create a new sample event'));
        return;
      } // Wait for the event to be fully processed and available on the group
      // before redirecting.


      const t0 = performance.now();
      const {
        eventCreated,
        retries
      } = await latestEventAvailable(api, eventData.groupID);
      const t1 = performance.now();
      (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_5__.clearIndicators)();
      this.setState({
        creating: false
      });
      const duration = Math.ceil(t1 - t0);
      this.recordAnalytics({
        eventCreated,
        retries,
        duration
      });

      if (!eventCreated) {
        (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_5__.addErrorMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Failed to load sample event'));
        _sentry_react__WEBPACK_IMPORTED_MODULE_11__.withScope(scope => {
          scope.setTag('groupID', eventData.groupID);
          scope.setTag('platform', project.platform || '');
          scope.setTag('interval', EVENT_POLL_INTERVAL.toString());
          scope.setTag('retries', retries.toString());
          scope.setTag('duration', duration.toString());
          scope.setLevel('warning');
          _sentry_react__WEBPACK_IMPORTED_MODULE_11__.captureMessage('Failed to load sample event');
        });
        return;
      }

      react_router__WEBPACK_IMPORTED_MODULE_4__.browserHistory.push(`/organizations/${organization.slug}/issues/${eventData.groupID}/?project=${project.id}`);
    });
  }

  componentDidMount() {
    const {
      organization,
      project,
      source
    } = this.props;

    if (!project) {
      return;
    }

    (0,sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_8__["default"])('sample_event.button_viewed', {
      organization,
      project_id: project.id,
      source
    });
  }

  recordAnalytics(_ref) {
    let {
      eventCreated,
      retries,
      duration
    } = _ref;
    const {
      organization,
      project,
      source
    } = this.props;

    if (!project) {
      return;
    }

    const eventKey = `sample_event.${eventCreated ? 'created' : 'failed'}`;
    (0,sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_8__["default"])(eventKey, {
      organization,
      project_id: project.id,
      platform: project.platform || '',
      interval: EVENT_POLL_INTERVAL,
      retries,
      duration,
      source
    });
  }

  render() {
    const {
      api: _api,
      organization: _organization,
      project: _project,
      source: _source,
      ...props
    } = this.props;
    const {
      creating
    } = this.state;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_6__["default"], { ...props,
      disabled: props.disabled || creating,
      onClick: this.createSampleGroup
    });
  }

}

CreateSampleEventButton.displayName = "CreateSampleEventButton";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_9__["default"])((0,sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_10__["default"])(CreateSampleEventButton)));

/***/ }),

/***/ "./images/spot/sentry-robot.png":
/*!**************************************!*\
  !*** ./images/spot/sentry-robot.png ***!
  \**************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

module.exports = __webpack_require__.p + "assets/sentry-robot.a95c7ba7b98be5973a7a.png";

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_components_errorRobot_tsx.fa8613ec155f505ceca3f0e5323ae430.js.map