"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_views_organizationGroupDetails_groupSimilarIssues_index_tsx"],{

/***/ "./app/components/similarScoreCard.tsx":
/*!*********************************************!*\
  !*** ./app/components/similarScoreCard.tsx ***!
  \*********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/es.string.replace.js */ "../node_modules/core-js/modules/es.string.replace.js");
/* harmony import */ var core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");








const scoreComponents = {
  'exception:message:character-shingles': (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Exception Message'),
  'exception:stacktrace:pairs': (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Stack Trace Frames'),
  'exception:stacktrace:application-chunks': (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('In-App Frames'),
  'message:message:character-shingles': (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Log Message'),
  // v2
  'similarity:*:type:character-5-shingle': (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Exception Type'),
  'similarity:*:value:character-5-shingle': (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Exception Message'),
  'similarity:*:stacktrace:frames-pairs': (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Stack Trace Frames'),
  'similarity:*:message:character-5-shingle': (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Log Message')
};

const SimilarScoreCard = _ref => {
  let {
    scoreList = []
  } = _ref;

  if (scoreList.length === 0) {
    return null;
  }

  let sumOtherScores = 0;
  let numOtherScores = 0;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsxs)(react__WEBPACK_IMPORTED_MODULE_3__.Fragment, {
    children: [scoreList.map(_ref2 => {
      let [key, score] = _ref2;
      const title = scoreComponents[key.replace(/similarity:\d\d\d\d-\d\d-\d\d/, 'similarity:*')];

      if (!title) {
        if (score !== null) {
          sumOtherScores += score;
          numOtherScores += 1;
        }

        return null;
      }

      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsxs)(Wrapper, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)("div", {
          children: title
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(Score, {
          score: score === null ? score : Math.round(score * 4)
        })]
      }, key);
    }), numOtherScores > 0 && sumOtherScores > 0 && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsxs)(Wrapper, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)("div", {
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Other')
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(Score, {
        score: Math.round(sumOtherScores * 4 / numOtherScores)
      })]
    })]
  });
};

SimilarScoreCard.displayName = "SimilarScoreCard";

const Wrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "ena4wns1"
} : 0)("display:flex;justify-content:space-between;margin:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_5__["default"])(0.25), " 0;" + ( true ? "" : 0));

const Score = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "ena4wns0"
} : 0)("height:16px;width:48px;border-radius:2px;background-color:", p => p.score === null ? p.theme.similarity.empty : p.theme.similarity.colors[p.score], ";" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (SimilarScoreCard);

/***/ }),

/***/ "./app/components/similarSpectrum.tsx":
/*!********************************************!*\
  !*** ./app/components/similarSpectrum.tsx ***!
  \********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");





const BaseSimilarSpectrum = _ref => {
  let {
    className
  } = _ref;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsxs)("div", {
    className: className,
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("span", {
      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('Similar')
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)(SpectrumItem, {
      colorIndex: 4
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)(SpectrumItem, {
      colorIndex: 3
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)(SpectrumItem, {
      colorIndex: 2
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)(SpectrumItem, {
      colorIndex: 1
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)(SpectrumItem, {
      colorIndex: 0
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)("span", {
      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('Not Similar')
    })]
  });
};

BaseSimilarSpectrum.displayName = "BaseSimilarSpectrum";

const SimilarSpectrum = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(BaseSimilarSpectrum,  true ? {
  target: "eliclov1"
} : 0)("display:flex;font-size:", p => p.theme.fontSizeSmall, ";" + ( true ? "" : 0));

const SpectrumItem = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('span',  true ? {
  target: "eliclov0"
} : 0)("border-radius:2px;margin:5px;width:14px;", p => `background-color: ${p.theme.similarity.colors[p.colorIndex]};`, ";" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (SimilarSpectrum);

/***/ }),

/***/ "./app/views/organizationGroupDetails/groupSimilarIssues/index.tsx":
/*!*************************************************************************!*\
  !*** ./app/views/organizationGroupDetails/groupSimilarIssues/index.tsx ***!
  \*************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var sentry_components_acl_feature__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/components/acl/feature */ "./app/components/acl/feature.tsx");
/* harmony import */ var _similarStackTrace__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./similarStackTrace */ "./app/views/organizationGroupDetails/groupSimilarIssues/similarStackTrace/index.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




const GroupSimilarIssues = _ref => {
  let {
    project,
    ...props
  } = _ref;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)(sentry_components_acl_feature__WEBPACK_IMPORTED_MODULE_0__["default"], {
    features: ['similarity-view'],
    project: project,
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)(_similarStackTrace__WEBPACK_IMPORTED_MODULE_1__["default"], {
      project: project,
      ...props
    })
  });
};

GroupSimilarIssues.displayName = "GroupSimilarIssues";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (GroupSimilarIssues);

/***/ }),

/***/ "./app/views/organizationGroupDetails/groupSimilarIssues/similarStackTrace/index.tsx":
/*!*******************************************************************************************!*\
  !*** ./app/views/organizationGroupDetails/groupSimilarIssues/similarStackTrace/index.tsx ***!
  \*******************************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var react_router__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! react-router */ "../node_modules/react-router/es/index.js");
/* harmony import */ var query_string__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! query-string */ "../node_modules/query-string/index.js");
/* harmony import */ var sentry_actions_groupingActions__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/actions/groupingActions */ "./app/actions/groupingActions.tsx");
/* harmony import */ var sentry_components_alert__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/alert */ "./app/components/alert.tsx");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_buttonBar__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/buttonBar */ "./app/components/buttonBar.tsx");
/* harmony import */ var sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/components/layouts/thirds */ "./app/components/layouts/thirds.tsx");
/* harmony import */ var sentry_components_loadingError__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/components/loadingError */ "./app/components/loadingError.tsx");
/* harmony import */ var sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/components/loadingIndicator */ "./app/components/loadingIndicator.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_stores_groupingStore__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/stores/groupingStore */ "./app/stores/groupingStore.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_callIfFunction__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! sentry/utils/callIfFunction */ "./app/utils/callIfFunction.tsx");
/* harmony import */ var _list__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! ./list */ "./app/views/organizationGroupDetails/groupSimilarIssues/similarStackTrace/list.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");





function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }



















class SimilarStackTrace extends react__WEBPACK_IMPORTED_MODULE_4__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", {
      similarItems: [],
      filteredSimilarItems: [],
      similarLinks: null,
      loading: true,
      error: false,
      v2: false
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "onGroupingChange", _ref => {
      let {
        mergedParent,
        similarItems,
        similarLinks,
        filteredSimilarItems,
        loading,
        error
      } = _ref;

      if (similarItems) {
        this.setState({
          similarItems,
          similarLinks,
          filteredSimilarItems,
          loading: loading !== null && loading !== void 0 ? loading : false,
          error: error !== null && error !== void 0 ? error : false
        });
        return;
      }

      if (!mergedParent) {
        return;
      }

      if (mergedParent !== this.props.params.groupId) {
        const {
          params
        } = this.props; // Merge success, since we can't specify target, we need to redirect to new parent

        react_router__WEBPACK_IMPORTED_MODULE_5__.browserHistory.push(`/organizations/${params.orgId}/issues/${mergedParent}/similar/`);
        return;
      }

      return;
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "listener", sentry_stores_groupingStore__WEBPACK_IMPORTED_MODULE_15__["default"].listen(this.onGroupingChange, undefined));

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleMerge", () => {
      const {
        params,
        location
      } = this.props;
      const query = location.query;

      if (!params) {
        return;
      } // You need at least 1 similarItem OR filteredSimilarItems to be able to merge,
      // so `firstIssue` should always exist from one of those lists.
      //
      // Similar issues API currently does not return issues across projects,
      // so we can assume that the first issues project slug is the project in
      // scope


      const [firstIssue] = this.state.similarItems.length ? this.state.similarItems : this.state.filteredSimilarItems;
      sentry_actions_groupingActions__WEBPACK_IMPORTED_MODULE_7__["default"].merge({
        params,
        query,
        projectId: firstIssue.issue.project.slug
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "toggleSimilarityVersion", () => {
      this.setState(prevState => ({
        v2: !prevState.v2
      }), this.fetchData);
    });
  }

  componentDidMount() {
    this.fetchData();
  }

  componentWillReceiveProps(nextProps) {
    if (nextProps.params.groupId !== this.props.params.groupId || nextProps.location.search !== this.props.location.search) {
      this.fetchData();
    }
  }

  componentWillUnmount() {
    (0,sentry_utils_callIfFunction__WEBPACK_IMPORTED_MODULE_17__.callIfFunction)(this.listener);
  }

  fetchData() {
    const {
      params,
      location
    } = this.props;
    this.setState({
      loading: true,
      error: false
    });
    const reqs = [];

    if (this.hasSimilarityFeature()) {
      const version = this.state.v2 ? '2' : '1';
      reqs.push({
        endpoint: `/issues/${params.groupId}/similar/?${query_string__WEBPACK_IMPORTED_MODULE_6__.stringify({ ...location.query,
          limit: 50,
          version
        })}`,
        dataKey: 'similar'
      });
    }

    sentry_actions_groupingActions__WEBPACK_IMPORTED_MODULE_7__["default"].fetch(reqs);
  }

  hasSimilarityV2Feature() {
    return this.props.project.features.includes('similarity-view-v2');
  }

  hasSimilarityFeature() {
    return this.props.project.features.includes('similarity-view');
  }

  render() {
    const {
      params,
      project
    } = this.props;
    const {
      orgId,
      groupId
    } = params;
    const {
      similarItems,
      filteredSimilarItems,
      loading,
      error,
      v2,
      similarLinks
    } = this.state;
    const hasV2 = this.hasSimilarityV2Feature();
    const isLoading = loading;
    const isError = error && !isLoading;
    const isLoadedSuccessfully = !isError && !isLoading;
    const hasSimilarItems = this.hasSimilarityFeature() && (similarItems.length > 0 || filteredSimilarItems.length > 0) && isLoadedSuccessfully;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_11__.Body, {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsxs)(sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_11__.Main, {
        fullWidth: true,
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(sentry_components_alert__WEBPACK_IMPORTED_MODULE_8__["default"], {
          type: "warning",
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)('This is an experimental feature. Data may not be immediately available while we process merges.')
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsxs)(HeaderWrapper, {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(Title, {
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)('Issues with a similar stack trace')
          }), hasV2 && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsxs)(sentry_components_buttonBar__WEBPACK_IMPORTED_MODULE_10__["default"], {
            merged: true,
            active: v2 ? 'new' : 'old',
            children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_9__["default"], {
              barId: "old",
              size: "sm",
              onClick: this.toggleSimilarityVersion,
              children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)('Old Algorithm')
            }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_9__["default"], {
              barId: "new",
              size: "sm",
              onClick: this.toggleSimilarityVersion,
              children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)('New Algorithm')
            })]
          })]
        }), isLoading && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_13__["default"], {}), isError && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(sentry_components_loadingError__WEBPACK_IMPORTED_MODULE_12__["default"], {
          message: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)('Unable to load similar issues, please try again later'),
          onRetry: this.fetchData
        }), hasSimilarItems && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(_list__WEBPACK_IMPORTED_MODULE_18__["default"], {
          items: similarItems,
          filteredItems: filteredSimilarItems,
          onMerge: this.handleMerge,
          orgId: orgId,
          project: project,
          groupId: groupId,
          pageLinks: similarLinks,
          v2: v2
        })]
      })
    });
  }

}

SimilarStackTrace.displayName = "SimilarStackTrace";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (SimilarStackTrace);

const Title = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('h4',  true ? {
  target: "exs0z1v1"
} : 0)( true ? {
  name: "1ykowef",
  styles: "margin-bottom:0"
} : 0);

const HeaderWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "exs0z1v0"
} : 0)("display:flex;align-items:center;justify-content:space-between;margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_16__["default"])(2), ";" + ( true ? "" : 0));

/***/ }),

/***/ "./app/views/organizationGroupDetails/groupSimilarIssues/similarStackTrace/item.tsx":
/*!******************************************************************************************!*\
  !*** ./app/views/organizationGroupDetails/groupSimilarIssues/similarStackTrace/item.tsx ***!
  \******************************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var _emotion_react__WEBPACK_IMPORTED_MODULE_21__ = __webpack_require__(/*! @emotion/react */ "../node_modules/@emotion/react/dist/emotion-react.browser.esm.js");
/* harmony import */ var classnames__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! classnames */ "../node_modules/classnames/index.js");
/* harmony import */ var classnames__WEBPACK_IMPORTED_MODULE_4___default = /*#__PURE__*/__webpack_require__.n(classnames__WEBPACK_IMPORTED_MODULE_4__);
/* harmony import */ var sentry_actionCreators_modal__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/actionCreators/modal */ "./app/actionCreators/modal.tsx");
/* harmony import */ var sentry_actions_groupingActions__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/actions/groupingActions */ "./app/actions/groupingActions.tsx");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_checkbox__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/checkbox */ "./app/components/checkbox.tsx");
/* harmony import */ var sentry_components_count__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/count */ "./app/components/count.tsx");
/* harmony import */ var sentry_components_eventOrGroupExtraDetails__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/eventOrGroupExtraDetails */ "./app/components/eventOrGroupExtraDetails.tsx");
/* harmony import */ var sentry_components_eventOrGroupHeader__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/components/eventOrGroupHeader */ "./app/components/eventOrGroupHeader.tsx");
/* harmony import */ var sentry_components_hovercard__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/components/hovercard */ "./app/components/hovercard.tsx");
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var sentry_components_scoreBar__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/components/scoreBar */ "./app/components/scoreBar.tsx");
/* harmony import */ var sentry_components_similarScoreCard__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/components/similarScoreCard */ "./app/components/similarScoreCard.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_stores_groupingStore__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! sentry/stores/groupingStore */ "./app/stores/groupingStore.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_callIfFunction__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! sentry/utils/callIfFunction */ "./app/utils/callIfFunction.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }





















const initialState = {
  visible: true,
  checked: false,
  busy: false
};

class Item extends react__WEBPACK_IMPORTED_MODULE_3__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", initialState);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "listener", sentry_stores_groupingStore__WEBPACK_IMPORTED_MODULE_17__["default"].listen(data => this.onGroupChange(data), undefined));

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleToggle", () => {
      const {
        issue
      } = this.props; // clicking anywhere in the row will toggle the checkbox

      if (!this.state.busy) {
        sentry_actions_groupingActions__WEBPACK_IMPORTED_MODULE_6__["default"].toggleMerge(issue.id);
      }
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleShowDiff", event => {
      const {
        orgId,
        groupId: baseIssueId,
        issue,
        project
      } = this.props;
      const {
        id: targetIssueId
      } = issue;
      (0,sentry_actionCreators_modal__WEBPACK_IMPORTED_MODULE_5__.openDiffModal)({
        baseIssueId,
        targetIssueId,
        project,
        orgId
      });
      event.stopPropagation();
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleCheckClick", () => {// noop to appease React warnings
      // This is controlled via row click instead of only Checkbox
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "onGroupChange", _ref => {
      let {
        mergeState
      } = _ref;

      if (!mergeState) {
        return;
      }

      const {
        issue
      } = this.props;
      const stateForId = mergeState.has(issue.id) && mergeState.get(issue.id);

      if (!stateForId) {
        return;
      }

      Object.keys(stateForId).forEach(key => {
        if (stateForId[key] === this.state[key]) {
          return;
        }

        this.setState(prevState => ({ ...prevState,
          [key]: stateForId[key]
        }));
      });
    });
  }

  componentWillUnmount() {
    (0,sentry_utils_callIfFunction__WEBPACK_IMPORTED_MODULE_19__.callIfFunction)(this.listener);
  }

  render() {
    const {
      aggregate,
      scoresByInterface,
      issue,
      v2
    } = this.props;
    const {
      visible,
      busy
    } = this.state;
    const similarInterfaces = v2 ? ['similarity'] : ['exception', 'message'];

    if (!visible) {
      return null;
    }

    const cx = classnames__WEBPACK_IMPORTED_MODULE_4___default()('group', {
      isResolved: issue.status === 'resolved',
      busy
    });
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsxs)(StyledPanelItem, {
      "data-test-id": "similar-item-row",
      className: cx,
      onClick: this.handleToggle,
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsxs)(Details, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_checkbox__WEBPACK_IMPORTED_MODULE_8__["default"], {
          id: issue.id,
          value: issue.id,
          checked: this.state.checked,
          onChange: this.handleCheckClick
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsxs)(EventDetails, {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_eventOrGroupHeader__WEBPACK_IMPORTED_MODULE_11__["default"], {
            data: issue,
            includeLink: true,
            size: "normal"
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_eventOrGroupExtraDetails__WEBPACK_IMPORTED_MODULE_10__["default"], {
            data: { ...issue,
              lastSeen: ''
            },
            showAssignee: true
          })]
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(Diff, {
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_7__["default"], {
            onClick: this.handleShowDiff,
            size: "sm",
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('Diff')
          })
        })]
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsxs)(Columns, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(StyledCount, {
          value: issue.count
        }), similarInterfaces.map(interfaceName => {
          const avgScore = aggregate === null || aggregate === void 0 ? void 0 : aggregate[interfaceName];
          const scoreList = (scoresByInterface === null || scoresByInterface === void 0 ? void 0 : scoresByInterface[interfaceName]) || []; // Check for valid number (and not NaN)

          const scoreValue = typeof avgScore === 'number' && !Number.isNaN(avgScore) ? avgScore : 0;
          return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(Column, {
            children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_hovercard__WEBPACK_IMPORTED_MODULE_12__.Hovercard, {
              body: scoreList.length && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_similarScoreCard__WEBPACK_IMPORTED_MODULE_15__["default"], {
                scoreList: scoreList
              }),
              children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_scoreBar__WEBPACK_IMPORTED_MODULE_14__["default"], {
                vertical: true,
                score: Math.round(scoreValue * 5)
              })
            })
          }, interfaceName);
        })]
      })]
    });
  }

}

Item.displayName = "Item";

const Details = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "eu3dffi6"
} : 0)(p => p.theme.overflowEllipsis, ";display:grid;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_18__["default"])(1), ";grid-template-columns:max-content auto max-content;margin-left:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_18__["default"])(2), ";input[type='checkbox']{margin:0;}" + ( true ? "" : 0));

const StyledPanelItem = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_panels__WEBPACK_IMPORTED_MODULE_13__.PanelItem,  true ? {
  target: "eu3dffi5"
} : 0)("padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_18__["default"])(1), " 0;" + ( true ? "" : 0));

const Columns = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "eu3dffi4"
} : 0)( true ? {
  name: "yresjl",
  styles: "display:flex;align-items:center;flex-shrink:0;min-width:300px;width:300px"
} : 0);

const columnStyle = /*#__PURE__*/(0,_emotion_react__WEBPACK_IMPORTED_MODULE_21__.css)("flex:1;flex-shrink:0;display:flex;justify-content:center;padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_18__["default"])(0.5), " 0;" + ( true ? "" : 0),  true ? "" : 0);

const Column = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "eu3dffi3"
} : 0)(columnStyle, ";" + ( true ? "" : 0));

const StyledCount = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_count__WEBPACK_IMPORTED_MODULE_9__["default"],  true ? {
  target: "eu3dffi2"
} : 0)(columnStyle, " font-variant-numeric:tabular-nums;" + ( true ? "" : 0));

const Diff = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "eu3dffi1"
} : 0)("display:flex;align-items:center;margin-right:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_18__["default"])(0.25), ";" + ( true ? "" : 0));

const EventDetails = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "eu3dffi0"
} : 0)("flex:1;", p => p.theme.overflowEllipsis, ";" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (Item);

/***/ }),

/***/ "./app/views/organizationGroupDetails/groupSimilarIssues/similarStackTrace/list.tsx":
/*!******************************************************************************************!*\
  !*** ./app/views/organizationGroupDetails/groupSimilarIssues/similarStackTrace/list.tsx ***!
  \******************************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_emptyStateWarning__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/emptyStateWarning */ "./app/components/emptyStateWarning.tsx");
/* harmony import */ var sentry_components_pagination__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/pagination */ "./app/components/pagination.tsx");
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var sentry_components_similarSpectrum__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/similarSpectrum */ "./app/components/similarSpectrum.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var _item__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! ./item */ "./app/views/organizationGroupDetails/groupSimilarIssues/similarStackTrace/item.tsx");
/* harmony import */ var _toolbar__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! ./toolbar */ "./app/views/organizationGroupDetails/groupSimilarIssues/similarStackTrace/toolbar.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");
















class List extends react__WEBPACK_IMPORTED_MODULE_3__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", {
      showAllItems: false
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "renderEmpty", () => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_7__.Panel, {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_7__.PanelBody, {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_components_emptyStateWarning__WEBPACK_IMPORTED_MODULE_5__["default"], {
          small: true,
          withIcon: false,
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('No issues with a similar stack trace have been found.')
        })
      })
    }));

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleShowAll", () => {
      this.setState({
        showAllItems: true
      });
    });
  }

  render() {
    const {
      orgId,
      groupId,
      project,
      items,
      filteredItems,
      pageLinks,
      onMerge,
      v2
    } = this.props;
    const {
      showAllItems
    } = this.state;
    const hasHiddenItems = !!filteredItems.length;
    const hasResults = items.length > 0 || hasHiddenItems;
    const itemsWithFiltered = items.concat(showAllItems && filteredItems || []);

    if (!hasResults) {
      return this.renderEmpty();
    }

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsxs)(react__WEBPACK_IMPORTED_MODULE_3__.Fragment, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(Header, {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_components_similarSpectrum__WEBPACK_IMPORTED_MODULE_8__["default"], {})
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsxs)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_7__.Panel, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(_toolbar__WEBPACK_IMPORTED_MODULE_12__["default"], {
          v2: v2,
          onMerge: onMerge
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsxs)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_7__.PanelBody, {
          children: [itemsWithFiltered.map(item => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(_item__WEBPACK_IMPORTED_MODULE_11__["default"], {
            orgId: orgId,
            v2: v2,
            groupId: groupId,
            project: project,
            ...item
          }, item.issue.id)), hasHiddenItems && !showAllItems && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(Footer, {
            children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_4__["default"], {
              onClick: this.handleShowAll,
              children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Show %s issues below threshold', filteredItems.length)
            })
          })]
        })]
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_components_pagination__WEBPACK_IMPORTED_MODULE_6__["default"], {
        pageLinks: pageLinks
      })]
    });
  }

}

List.displayName = "List";

(0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(List, "defaultProps", {
  filteredItems: []
});

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (List);

const Header = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "ex4pz811"
} : 0)("display:flex;justify-content:flex-end;margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_10__["default"])(1), ";" + ( true ? "" : 0));

const Footer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "ex4pz810"
} : 0)("display:flex;justify-content:center;padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_10__["default"])(1.5), ";" + ( true ? "" : 0));

/***/ }),

/***/ "./app/views/organizationGroupDetails/groupSimilarIssues/similarStackTrace/toolbar.tsx":
/*!*********************************************************************************************!*\
  !*** ./app/views/organizationGroupDetails/groupSimilarIssues/similarStackTrace/toolbar.tsx ***!
  \*********************************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_confirm__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/confirm */ "./app/components/confirm.tsx");
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var sentry_components_toolbarHeader__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/toolbarHeader */ "./app/components/toolbarHeader.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_stores_groupingStore__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/stores/groupingStore */ "./app/stores/groupingStore.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_callIfFunction__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/utils/callIfFunction */ "./app/utils/callIfFunction.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }












const initialState = {
  mergeCount: 0
};

class SimilarToolbar extends react__WEBPACK_IMPORTED_MODULE_3__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", initialState);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "onGroupChange", _ref => {
      let {
        mergeList
      } = _ref;

      if (!(mergeList !== null && mergeList !== void 0 && mergeList.length)) {
        return;
      }

      if (mergeList.length !== this.state.mergeCount) {
        this.setState({
          mergeCount: mergeList.length
        });
      }
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "listener", sentry_stores_groupingStore__WEBPACK_IMPORTED_MODULE_9__["default"].listen(this.onGroupChange, undefined));
  }

  componentWillUnmount() {
    (0,sentry_utils_callIfFunction__WEBPACK_IMPORTED_MODULE_11__.callIfFunction)(this.listener);
  }

  render() {
    const {
      onMerge,
      v2
    } = this.props;
    const {
      mergeCount
    } = this.state;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsxs)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_6__.PanelHeader, {
      hasButtons: true,
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(sentry_components_confirm__WEBPACK_IMPORTED_MODULE_5__["default"], {
        disabled: mergeCount === 0,
        message: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('Are you sure you want to merge these issues?'),
        onConfirm: onMerge,
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_4__["default"], {
          size: "sm",
          title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('Merging %s issues', mergeCount),
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('Merge %s', `(${mergeCount || 0})`)
        })
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsxs)(Columns, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(StyledToolbarHeader, {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('Events')
        }), v2 ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(StyledToolbarHeader, {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('Score')
        }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsxs)(react__WEBPACK_IMPORTED_MODULE_3__.Fragment, {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(StyledToolbarHeader, {
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('Exception')
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(StyledToolbarHeader, {
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('Message')
          })]
        })]
      })]
    });
  }

}

SimilarToolbar.displayName = "SimilarToolbar";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (SimilarToolbar);

const Columns = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e1u9d3041"
} : 0)( true ? {
  name: "yresjl",
  styles: "display:flex;align-items:center;flex-shrink:0;min-width:300px;width:300px"
} : 0);

const StyledToolbarHeader = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_toolbarHeader__WEBPACK_IMPORTED_MODULE_7__["default"],  true ? {
  target: "e1u9d3040"
} : 0)("flex:1;flex-shrink:0;display:flex;justify-content:center;padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_10__["default"])(0.5), " 0;" + ( true ? "" : 0));

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_views_organizationGroupDetails_groupSimilarIssues_index_tsx.774ce265b63c05ac19c2fb2cf76c9538.js.map