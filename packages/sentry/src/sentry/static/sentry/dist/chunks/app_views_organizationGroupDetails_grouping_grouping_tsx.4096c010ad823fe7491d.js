"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_views_organizationGroupDetails_grouping_grouping_tsx"],{

/***/ "./app/components/featureFeedback/index.tsx":
/*!**************************************************!*\
  !*** ./app/components/featureFeedback/index.tsx ***!
  \**************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "FeatureFeedback": () => (/* binding */ FeatureFeedback)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var sentry_actionCreators_modal__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/actionCreators/modal */ "./app/actionCreators/modal.tsx");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");






// Provides a button that, when clicked, opens a modal with a form that,
// when filled and submitted, will send feedback to Sentry (feedbacks project).
function FeatureFeedback(_ref) {
  let {
    feedbackTypes,
    featureName,
    buttonProps = {}
  } = _ref;

  async function handleClick() {
    const mod = await __webpack_require__.e(/*! import() */ "app_components_featureFeedback_feedbackModal_tsx").then(__webpack_require__.bind(__webpack_require__, /*! sentry/components/featureFeedback/feedbackModal */ "./app/components/featureFeedback/feedbackModal.tsx"));
    const {
      FeedbackModal,
      modalCss
    } = mod;
    (0,sentry_actionCreators_modal__WEBPACK_IMPORTED_MODULE_1__.openModal)(deps => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(FeedbackModal, { ...deps,
      featureName: featureName,
      feedbackTypes: feedbackTypes
    }), {
      modalCss
    });
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_2__["default"], {
    icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_3__.IconMegaphone, {}),
    onClick: handleClick,
    ...buttonProps,
    children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Give Feedback')
  });
}
FeatureFeedback.displayName = "FeatureFeedback";

/***/ }),

/***/ "./app/views/organizationGroupDetails/grouping/errorMessage.tsx":
/*!**********************************************************************!*\
  !*** ./app/views/organizationGroupDetails/grouping/errorMessage.tsx ***!
  \**********************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_alert__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/alert */ "./app/components/alert.tsx");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_buttonBar__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/buttonBar */ "./app/components/buttonBar.tsx");
/* harmony import */ var sentry_components_featureBadge__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/featureBadge */ "./app/components/featureBadge.tsx");
/* harmony import */ var sentry_components_loadingError__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/loadingError */ "./app/components/loadingError.tsx");
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_views_settings_components_emptyMessage__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/views/settings/components/emptyMessage */ "./app/views/settings/components/emptyMessage.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");












function ErrorMessage(_ref) {
  var _error$responseJSON;

  let {
    error,
    groupId,
    onRetry,
    orgSlug,
    projSlug,
    hasProjectWriteAccess,
    className
  } = _ref;

  function getErrorDetails(errorCode) {
    switch (errorCode) {
      case 'merged_issues':
        return {
          title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Grouping breakdown is not available in this issue'),
          subTitle: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('This issue needs to be fully unmerged before grouping breakdown is available'),
          action: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_2__["default"], {
            priority: "primary",
            to: `/organizations/${orgSlug}/issues/${groupId}/merged/?${location.search}`,
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Unmerge issue')
          })
        };

      case 'missing_feature':
        return {
          title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('This project does not have the grouping breakdown available. Is your organization still an early adopter?')
        };

      case 'no_events':
        return {
          title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('This issue has no events')
        };

      case 'issue_not_hierarchical':
        return {
          title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Grouping breakdown is not available in this issue'),
          subTitle: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Only new issues with the latest grouping strategy have this feature available')
        };

      case 'project_not_hierarchical':
        return {
          title: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsxs)(react__WEBPACK_IMPORTED_MODULE_0__.Fragment, {
            children: [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Update your Grouping Config'), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(sentry_components_featureBadge__WEBPACK_IMPORTED_MODULE_4__["default"], {
              type: "beta"
            })]
          }),
          subTitle: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsxs)(react__WEBPACK_IMPORTED_MODULE_0__.Fragment, {
            children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)("p", {
              children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Enable advanced grouping insights and functionality by updating this project to the latest Grouping Config:')
            }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsxs)("ul", {
              children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)("li", {
                children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.tct)('[strong:Breakdowns:] Explore events in this issue by call hierarchy.', {
                  strong: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)("strong", {})
                })
              }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)("li", {
                children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.tct)('[strong:Stack trace annotations:] See important frames Sentry uses to group issues directly in the stack trace.', {
                  strong: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)("strong", {})
                })
              })]
            })]
          }),
          leftAligned: true,
          action: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsxs)(sentry_components_buttonBar__WEBPACK_IMPORTED_MODULE_3__["default"], {
            gap: 1,
            children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_2__["default"], {
              priority: "primary",
              to: `/settings/${orgSlug}/projects/${projSlug}/issue-grouping/#upgrade-grouping`,
              disabled: !hasProjectWriteAccess,
              title: !hasProjectWriteAccess ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('You do not have permission to update this project') : undefined,
              children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Upgrade Grouping Strategy')
            }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_2__["default"], {
              href: "https://docs.sentry.io/product/data-management-settings/event-grouping/grouping-breakdown/",
              children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Read the docs')
            })]
          })
        };

      default:
        return {};
    }
  }

  if (typeof error === 'string') {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(sentry_components_alert__WEBPACK_IMPORTED_MODULE_1__["default"], {
      type: "warning",
      className: className,
      children: error
    });
  }

  if (error.status === 403 && (_error$responseJSON = error.responseJSON) !== null && _error$responseJSON !== void 0 && _error$responseJSON.detail) {
    const {
      code,
      message
    } = error.responseJSON.detail;
    const {
      action,
      title,
      subTitle,
      leftAligned
    } = getErrorDetails(code);
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_6__.Panel, {
      className: className,
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(sentry_views_settings_components_emptyMessage__WEBPACK_IMPORTED_MODULE_8__["default"], {
        size: "large",
        title: title !== null && title !== void 0 ? title : message,
        description: subTitle,
        action: action,
        leftAligned: leftAligned
      })
    });
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(sentry_components_loadingError__WEBPACK_IMPORTED_MODULE_5__["default"], {
    message: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Unable to load grouping levels, please try again later'),
    onRetry: onRetry,
    className: className
  });
}

ErrorMessage.displayName = "ErrorMessage";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (ErrorMessage);

/***/ }),

/***/ "./app/views/organizationGroupDetails/grouping/grouping.tsx":
/*!******************************************************************!*\
  !*** ./app/views/organizationGroupDetails/grouping/grouping.tsx ***!
  \******************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__),
/* harmony export */   "groupingFeedbackTypes": () => (/* binding */ groupingFeedbackTypes)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/es.string.replace.js */ "../node_modules/core-js/modules/es.string.replace.js");
/* harmony import */ var core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var react_router__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! react-router */ "../node_modules/react-router/es/index.js");
/* harmony import */ var lodash_debounce__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! lodash/debounce */ "../node_modules/lodash/debounce.js");
/* harmony import */ var lodash_debounce__WEBPACK_IMPORTED_MODULE_6___default = /*#__PURE__*/__webpack_require__.n(lodash_debounce__WEBPACK_IMPORTED_MODULE_6__);
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_buttonBar__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/buttonBar */ "./app/components/buttonBar.tsx");
/* harmony import */ var sentry_components_featureFeedback__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/featureFeedback */ "./app/components/featureFeedback/index.tsx");
/* harmony import */ var sentry_components_forms_controls_rangeSlider__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/forms/controls/rangeSlider */ "./app/components/forms/controls/rangeSlider/index.tsx");
/* harmony import */ var sentry_components_forms_controls_rangeSlider_slider__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/components/forms/controls/rangeSlider/slider */ "./app/components/forms/controls/rangeSlider/slider.tsx");
/* harmony import */ var sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/components/layouts/thirds */ "./app/components/layouts/thirds.tsx");
/* harmony import */ var sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/components/loadingIndicator */ "./app/components/loadingIndicator.tsx");
/* harmony import */ var sentry_components_pagination__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/components/pagination */ "./app/components/pagination.tsx");
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var sentry_constants__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/constants */ "./app/constants/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");
/* harmony import */ var sentry_utils_parseLinkHeader__WEBPACK_IMPORTED_MODULE_20__ = __webpack_require__(/*! sentry/utils/parseLinkHeader */ "./app/utils/parseLinkHeader.tsx");
/* harmony import */ var sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_21__ = __webpack_require__(/*! sentry/utils/withApi */ "./app/utils/withApi.tsx");
/* harmony import */ var _errorMessage__WEBPACK_IMPORTED_MODULE_22__ = __webpack_require__(/*! ./errorMessage */ "./app/views/organizationGroupDetails/grouping/errorMessage.tsx");
/* harmony import */ var _newIssue__WEBPACK_IMPORTED_MODULE_23__ = __webpack_require__(/*! ./newIssue */ "./app/views/organizationGroupDetails/grouping/newIssue.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");





function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }























const groupingFeedbackTypes = [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_17__.t)('Too eager grouping'), (0,sentry_locale__WEBPACK_IMPORTED_MODULE_17__.t)('Too specific grouping'), (0,sentry_locale__WEBPACK_IMPORTED_MODULE_17__.t)('Other grouping issue')];
const GROUPING_BREAKDOWN__DOC_LINK = 'https://docs.sentry.io/product/data-management-settings/event-grouping/grouping-breakdown/';

function Grouping(_ref) {
  var _links$previous, _links$next;

  let {
    api,
    groupId,
    location,
    organization,
    router,
    projSlug
  } = _ref;
  const {
    cursor,
    level
  } = location.query;
  const [isLoading, setIsLoading] = (0,react__WEBPACK_IMPORTED_MODULE_4__.useState)(false);
  const [isGroupingLevelDetailsLoading, setIsGroupingLevelDetailsLoading] = (0,react__WEBPACK_IMPORTED_MODULE_4__.useState)(false);
  const [error, setError] = (0,react__WEBPACK_IMPORTED_MODULE_4__.useState)(undefined);
  const [groupingLevels, setGroupingLevels] = (0,react__WEBPACK_IMPORTED_MODULE_4__.useState)([]);
  const [activeGroupingLevel, setActiveGroupingLevel] = (0,react__WEBPACK_IMPORTED_MODULE_4__.useState)(undefined);
  const [activeGroupingLevelDetails, setActiveGroupingLevelDetails] = (0,react__WEBPACK_IMPORTED_MODULE_4__.useState)([]);
  const [pagination, setPagination] = (0,react__WEBPACK_IMPORTED_MODULE_4__.useState)('');
  (0,react__WEBPACK_IMPORTED_MODULE_4__.useEffect)(() => {
    fetchGroupingLevels();
    return react_router__WEBPACK_IMPORTED_MODULE_5__.browserHistory.listen(handleRouteLeave);
  }, []);
  (0,react__WEBPACK_IMPORTED_MODULE_4__.useEffect)(() => {
    setSecondGrouping();
  }, [groupingLevels]);
  (0,react__WEBPACK_IMPORTED_MODULE_4__.useEffect)(() => {
    updateUrlWithNewLevel();
  }, [activeGroupingLevel]);
  (0,react__WEBPACK_IMPORTED_MODULE_4__.useEffect)(() => {
    fetchGroupingLevelDetails();
  }, [activeGroupingLevel, cursor]);

  function handleRouteLeave(newLocation) {
    if (newLocation.pathname === location.pathname || newLocation.pathname !== location.pathname && newLocation.query.cursor === undefined && newLocation.query.level === undefined) {
      return true;
    } // Removes cursor and level from the URL on route leave
    // so that the parameters will not interfere with other pages


    react_router__WEBPACK_IMPORTED_MODULE_5__.browserHistory.replace({
      pathname: newLocation.pathname,
      query: { ...newLocation.query,
        cursor: undefined,
        level: undefined
      }
    });
    return false;
  }

  const handleSetActiveGroupingLevel = lodash_debounce__WEBPACK_IMPORTED_MODULE_6___default()(groupingLevelId => {
    setActiveGroupingLevel(Number(groupingLevelId));
  }, sentry_constants__WEBPACK_IMPORTED_MODULE_16__.DEFAULT_DEBOUNCE_DURATION);

  async function fetchGroupingLevels() {
    setIsLoading(true);
    setError(undefined);

    try {
      const response = await api.requestPromise(`/issues/${groupId}/grouping/levels/`);
      setIsLoading(false);
      setGroupingLevels(response.levels);
    } catch (err) {
      setIsLoading(false);
      setError(err);
    }
  }

  async function fetchGroupingLevelDetails() {
    if (!groupingLevels.length || !(0,sentry_utils__WEBPACK_IMPORTED_MODULE_19__.defined)(activeGroupingLevel)) {
      return;
    }

    setIsGroupingLevelDetailsLoading(true);
    setError(undefined);

    try {
      var _resp$getResponseHead;

      const [data,, resp] = await api.requestPromise(`/issues/${groupId}/grouping/levels/${activeGroupingLevel}/new-issues/`, {
        method: 'GET',
        includeAllArgs: true,
        query: { ...location.query,
          per_page: 10
        }
      });
      const pageLinks = resp === null || resp === void 0 ? void 0 : (_resp$getResponseHead = resp.getResponseHeader) === null || _resp$getResponseHead === void 0 ? void 0 : _resp$getResponseHead.call(resp, 'Link');
      setPagination(pageLinks !== null && pageLinks !== void 0 ? pageLinks : '');
      setActiveGroupingLevelDetails(Array.isArray(data) ? data : [data]);
      setIsGroupingLevelDetailsLoading(false);
    } catch (err) {
      setIsGroupingLevelDetailsLoading(false);
      setError(err);
    }
  }

  function updateUrlWithNewLevel() {
    if (!(0,sentry_utils__WEBPACK_IMPORTED_MODULE_19__.defined)(activeGroupingLevel) || level === activeGroupingLevel) {
      return;
    }

    router.replace({
      pathname: location.pathname,
      query: { ...location.query,
        cursor: undefined,
        level: activeGroupingLevel
      }
    });
  }

  function setSecondGrouping() {
    if (!groupingLevels.length) {
      return;
    }

    if ((0,sentry_utils__WEBPACK_IMPORTED_MODULE_19__.defined)(level)) {
      if (!(0,sentry_utils__WEBPACK_IMPORTED_MODULE_19__.defined)(groupingLevels[level])) {
        setError((0,sentry_locale__WEBPACK_IMPORTED_MODULE_17__.t)('The level you were looking for was not found.'));
        return;
      }

      if (level === activeGroupingLevel) {
        return;
      }

      setActiveGroupingLevel(level);
      return;
    }

    if (groupingLevels.length > 1) {
      setActiveGroupingLevel(groupingLevels[1].id);
      return;
    }

    setActiveGroupingLevel(groupingLevels[0].id);
  }

  if (isLoading) {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsx)(sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_13__["default"], {});
  }

  if (error) {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsx)(react__WEBPACK_IMPORTED_MODULE_4__.Fragment, {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsx)(sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_12__.Body, {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsx)(sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_12__.Main, {
          fullWidth: true,
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsxs)(ErrorWrapper, {
            children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsxs)(sentry_components_buttonBar__WEBPACK_IMPORTED_MODULE_8__["default"], {
              gap: 1,
              children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_7__["default"], {
                href: GROUPING_BREAKDOWN__DOC_LINK,
                external: true,
                children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_17__.t)('Read Docs')
              }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsx)(sentry_components_featureFeedback__WEBPACK_IMPORTED_MODULE_9__.FeatureFeedback, {
                featureName: "grouping",
                feedbackTypes: groupingFeedbackTypes
              })]
            }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsx)(StyledErrorMessage, {
              onRetry: fetchGroupingLevels,
              groupId: groupId,
              error: error,
              projSlug: projSlug,
              orgSlug: organization.slug,
              hasProjectWriteAccess: organization.access.includes('project:write')
            })]
          })
        })
      })
    });
  }

  if (!activeGroupingLevelDetails.length) {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsx)(sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_13__["default"], {});
  }

  const links = (0,sentry_utils_parseLinkHeader__WEBPACK_IMPORTED_MODULE_20__["default"])(pagination);
  const hasMore = ((_links$previous = links.previous) === null || _links$previous === void 0 ? void 0 : _links$previous.results) || ((_links$next = links.next) === null || _links$next === void 0 ? void 0 : _links$next.results);
  const paginationCurrentQuantity = activeGroupingLevelDetails.length;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsx)(sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_12__.Body, {
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsx)(sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_12__.Main, {
      fullWidth: true,
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsxs)(Wrapper, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsx)(Header, {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_17__.t)('This issue is an aggregate of multiple events that sentry determined originate from the same root-cause. Use this page to explore more detailed groupings that exist within this issue.')
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsxs)(Body, {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsxs)(Actions, {
            children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsxs)(SliderWrapper, {
              children: [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_17__.t)('Fewer issues'), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsx)(StyledRangeSlider, {
                name: "grouping-level",
                allowedValues: groupingLevels.map(groupingLevel => Number(groupingLevel.id)),
                value: activeGroupingLevel !== null && activeGroupingLevel !== void 0 ? activeGroupingLevel : 0,
                onChange: handleSetActiveGroupingLevel,
                showLabel: false
              }), (0,sentry_locale__WEBPACK_IMPORTED_MODULE_17__.t)('More issues')]
            }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsxs)(StyledButtonBar, {
              gap: 1,
              children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_7__["default"], {
                href: GROUPING_BREAKDOWN__DOC_LINK,
                external: true,
                children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_17__.t)('Read Docs')
              }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsx)(sentry_components_featureFeedback__WEBPACK_IMPORTED_MODULE_9__.FeatureFeedback, {
                featureName: "grouping",
                feedbackTypes: groupingFeedbackTypes
              })]
            })]
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsxs)(Content, {
            isReloading: isGroupingLevelDetailsLoading,
            children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsx)(StyledPanelTable, {
              headers: ['', (0,sentry_locale__WEBPACK_IMPORTED_MODULE_17__.t)('Events')],
              children: activeGroupingLevelDetails.map(_ref2 => {
                let {
                  hash,
                  title,
                  metadata,
                  latestEvent,
                  eventCount
                } = _ref2;
                // XXX(markus): Ugly hack to make NewIssue show the right things.
                return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsx)(_newIssue__WEBPACK_IMPORTED_MODULE_23__["default"], {
                  sampleEvent: { ...latestEvent,
                    metadata: { ...(metadata || latestEvent.metadata),
                      current_level: activeGroupingLevel
                    },
                    title: title || latestEvent.title
                  },
                  eventCount: eventCount,
                  organization: organization
                }, hash);
              })
            }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsx)(StyledPagination, {
              pageLinks: pagination,
              disabled: isGroupingLevelDetailsLoading,
              caption: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_17__.tct)('Showing [current] of [total] [result]', {
                result: hasMore ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_17__.t)('results') : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_17__.tn)('result', 'results', paginationCurrentQuantity),
                current: paginationCurrentQuantity,
                total: hasMore ? `${paginationCurrentQuantity}+` : paginationCurrentQuantity
              })
            })]
          })]
        })]
      })
    })
  });
}

Grouping.displayName = "Grouping";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_21__["default"])(Grouping));

const Wrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1m7ctwt11"
} : 0)("flex:1;display:grid;align-content:flex-start;margin:-", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_18__["default"])(3), " -", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_18__["default"])(4), ";padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_18__["default"])(3), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_18__["default"])(4), ";" + ( true ? "" : 0));

const Header = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('p',  true ? {
  target: "e1m7ctwt10"
} : 0)("&&{margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_18__["default"])(2), ";}" + ( true ? "" : 0));

const Body = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1m7ctwt9"
} : 0)("display:grid;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_18__["default"])(3), ";" + ( true ? "" : 0));

const Actions = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1m7ctwt8"
} : 0)("display:grid;align-items:center;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_18__["default"])(3), ";@media (min-width: ", p => p.theme.breakpoints.small, "){grid-template-columns:1fr max-content;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_18__["default"])(2), ";}" + ( true ? "" : 0));

const StyledButtonBar = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_buttonBar__WEBPACK_IMPORTED_MODULE_8__["default"],  true ? {
  target: "e1m7ctwt7"
} : 0)( true ? {
  name: "11g6mpt",
  styles: "justify-content:flex-start"
} : 0);

const StyledErrorMessage = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(_errorMessage__WEBPACK_IMPORTED_MODULE_22__["default"],  true ? {
  target: "e1m7ctwt6"
} : 0)( true ? {
  name: "1d3w5wq",
  styles: "width:100%"
} : 0);

const ErrorWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1m7ctwt5"
} : 0)("display:flex;flex-direction:column;align-items:flex-end;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_18__["default"])(1), ";" + ( true ? "" : 0));

const StyledPanelTable = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_panels__WEBPACK_IMPORTED_MODULE_15__.PanelTable,  true ? {
  target: "e1m7ctwt4"
} : 0)("grid-template-columns:1fr minmax(60px, auto);>*{padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_18__["default"])(1.5), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_18__["default"])(2), ";:nth-child(-n + 2){padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_18__["default"])(2), ";}:nth-child(2n){display:flex;text-align:right;justify-content:flex-end;}}@media (min-width: ", p => p.theme.breakpoints.xlarge, "){grid-template-columns:1fr minmax(80px, auto);}" + ( true ? "" : 0));

const StyledPagination = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_pagination__WEBPACK_IMPORTED_MODULE_14__["default"],  true ? {
  target: "e1m7ctwt3"
} : 0)( true ? {
  name: "1i9vogi",
  styles: "margin-top:0"
} : 0);

const Content = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1m7ctwt2"
} : 0)(p => p.isReloading && `
      ${StyledPanelTable}, ${StyledPagination} {
        opacity: 0.5;
        pointer-events: none;
      }
    `, ";" + ( true ? "" : 0));

const SliderWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1m7ctwt1"
} : 0)("display:grid;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_18__["default"])(1.5), ";grid-template-columns:max-content max-content;justify-content:space-between;align-items:flex-start;position:relative;font-size:", p => p.theme.fontSizeMedium, ";color:", p => p.theme.subText, ";padding-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_18__["default"])(2), ";@media (min-width: 700px){grid-template-columns:max-content minmax(270px, auto) max-content;align-items:center;justify-content:flex-start;padding-bottom:0;}" + ( true ? "" : 0));

const StyledRangeSlider = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_forms_controls_rangeSlider__WEBPACK_IMPORTED_MODULE_10__["default"],  true ? {
  target: "e1m7ctwt0"
} : 0)(sentry_components_forms_controls_rangeSlider_slider__WEBPACK_IMPORTED_MODULE_11__["default"], "{background:transparent;margin-top:0;margin-bottom:0;::-ms-thumb{box-shadow:0 0 0 3px ", p => p.theme.backgroundSecondary, ";}::-moz-range-thumb{box-shadow:0 0 0 3px ", p => p.theme.backgroundSecondary, ";}::-webkit-slider-thumb{box-shadow:0 0 0 3px ", p => p.theme.backgroundSecondary, ";}}position:absolute;bottom:0;left:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_18__["default"])(1.5), ";right:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_18__["default"])(1.5), ";@media (min-width: 700px){position:static;left:auto;right:auto;}" + ( true ? "" : 0));

/***/ }),

/***/ "./app/views/organizationGroupDetails/grouping/newIssue.tsx":
/*!******************************************************************!*\
  !*** ./app/views/organizationGroupDetails/grouping/newIssue.tsx ***!
  \******************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_eventOrGroupHeader__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/eventOrGroupHeader */ "./app/components/eventOrGroupHeader.tsx");
/* harmony import */ var sentry_components_timeSince__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/timeSince */ "./app/components/timeSince.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }










function NewIssue(_ref) {
  let {
    sampleEvent,
    eventCount,
    organization
  } = _ref;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsxs)(react__WEBPACK_IMPORTED_MODULE_1__.Fragment, {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsxs)(EventDetails, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(sentry_components_eventOrGroupHeader__WEBPACK_IMPORTED_MODULE_2__["default"], {
        data: sampleEvent,
        organization: organization,
        grouping: true,
        hideIcons: true,
        hideLevel: true
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(ExtraInfo, {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsxs)(TimeWrapper, {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(StyledIconClock, {
            size: "11px"
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(sentry_components_timeSince__WEBPACK_IMPORTED_MODULE_3__["default"], {
            date: sampleEvent.dateCreated ? sampleEvent.dateCreated : sampleEvent.dateReceived,
            suffix: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_5__.t)('old')
          })]
        })
      })]
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(EventCount, {
      children: eventCount
    })]
  });
}

NewIssue.displayName = "NewIssue";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (NewIssue);

const EventDetails = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "ebu51d34"
} : 0)( true ? {
  name: "1eiwmge",
  styles: "overflow:hidden;line-height:1.1"
} : 0);

const ExtraInfo = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "ebu51d33"
} : 0)("display:grid;grid-auto-flow:column;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_6__["default"])(2), ";justify-content:flex-start;" + ( true ? "" : 0));

const TimeWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "ebu51d32"
} : 0)("display:grid;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_6__["default"])(0.5), ";grid-template-columns:max-content 1fr;align-items:center;font-size:", p => p.theme.fontSizeSmall, ";" + ( true ? "" : 0));

const EventCount = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "ebu51d31"
} : 0)( true ? {
  name: "1ewtsvq",
  styles: "align-items:center;font-variant-numeric:tabular-nums;line-height:1.1"
} : 0);

const StyledIconClock = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_icons__WEBPACK_IMPORTED_MODULE_4__.IconClock,  true ? {
  target: "ebu51d30"
} : 0)("color:", p => p.theme.subText, ";" + ( true ? "" : 0));

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_views_organizationGroupDetails_grouping_grouping_tsx.c5d9cfbdcc518bb0f5b836125c76a71c.js.map