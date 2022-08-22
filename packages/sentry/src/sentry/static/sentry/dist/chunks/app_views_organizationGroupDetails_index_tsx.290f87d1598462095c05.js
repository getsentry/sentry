(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_views_organizationGroupDetails_index_tsx"],{

/***/ "./app/components/avatar/avatarList.tsx":
/*!**********************************************!*\
  !*** ./app/components/avatar/avatarList.tsx ***!
  \**********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "AvatarListWrapper": () => (/* binding */ AvatarListWrapper),
/* harmony export */   "default": () => (/* binding */ AvatarList)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var _emotion_react__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! @emotion/react */ "../node_modules/@emotion/react/dist/emotion-react.browser.esm.js");
/* harmony import */ var sentry_components_avatar_userAvatar__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/avatar/userAvatar */ "./app/components/avatar/userAvatar.tsx");
/* harmony import */ var sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/tooltip */ "./app/components/tooltip.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");



function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }







const defaultProps = {
  avatarSize: 28,
  maxVisibleAvatars: 5,
  typeMembers: 'users',
  tooltipOptions: {}
};
class AvatarList extends react__WEBPACK_IMPORTED_MODULE_2__.Component {
  render() {
    const {
      className,
      users,
      avatarSize,
      maxVisibleAvatars,
      renderTooltip,
      typeMembers,
      tooltipOptions
    } = this.props;
    const visibleUsers = users.slice(0, maxVisibleAvatars);
    const numCollapsedUsers = users.length - visibleUsers.length;

    if (!tooltipOptions.position) {
      tooltipOptions.position = 'top';
    }

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsxs)(AvatarListWrapper, {
      className: className,
      children: [!!numCollapsedUsers && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_4__["default"], {
        title: `${numCollapsedUsers} other ${typeMembers}`,
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsxs)(CollapsedUsers, {
          size: avatarSize,
          "data-test-id": "avatarList-collapsedusers",
          children: [numCollapsedUsers < 99 && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(Plus, {
            children: "+"
          }), numCollapsedUsers]
        })
      }), visibleUsers.map(user => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(StyledAvatar, {
        user: user,
        size: avatarSize,
        renderTooltip: renderTooltip,
        tooltipOptions: tooltipOptions,
        hasTooltip: true
      }, `${user.id}-${user.email}`))]
    });
  }

}
AvatarList.displayName = "AvatarList";

(0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(AvatarList, "defaultProps", defaultProps);

// used in releases list page to do some alignment
const AvatarListWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e7y2scs3"
} : 0)( true ? {
  name: "4hray5",
  styles: "display:flex;flex-direction:row-reverse"
} : 0);

const Circle = p => /*#__PURE__*/(0,_emotion_react__WEBPACK_IMPORTED_MODULE_6__.css)("border-radius:50%;border:2px solid ", p.theme.background, ";margin-left:-8px;cursor:default;&:hover{z-index:1;}" + ( true ? "" : 0),  true ? "" : 0);

const StyledAvatar = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_avatar_userAvatar__WEBPACK_IMPORTED_MODULE_3__["default"],  true ? {
  target: "e7y2scs2"
} : 0)("overflow:hidden;", Circle, ";" + ( true ? "" : 0));

const CollapsedUsers = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e7y2scs1"
} : 0)("display:flex;align-items:center;justify-content:center;position:relative;text-align:center;font-weight:600;background-color:", p => p.theme.gray200, ";color:", p => p.theme.gray300, ";font-size:", p => Math.floor(p.size / 2.3), "px;width:", p => p.size, "px;height:", p => p.size, "px;", Circle, ";" + ( true ? "" : 0));

const Plus = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('span',  true ? {
  target: "e7y2scs0"
} : 0)( true ? {
  name: "1enq4bv",
  styles: "font-size:10px;margin-left:1px;margin-right:-1px"
} : 0);

/***/ }),

/***/ "./app/components/events/errorLevel.tsx":
/*!**********************************************!*\
  !*** ./app/components/events/errorLevel.tsx ***!
  \**********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");

const DEFAULT_SIZE = '13px';

const ErrorLevel = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('span',  true ? {
  target: "e145dcfe0"
} : 0)("padding:0;position:relative;width:", p => p.size || DEFAULT_SIZE, ";height:", p => p.size || DEFAULT_SIZE, ";text-indent:-9999em;display:inline-block;border-radius:50%;flex-shrink:0;background-color:", p => p.level ? p.theme.level[p.level] : p.theme.level.error, ";" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (ErrorLevel);

/***/ }),

/***/ "./app/components/events/eventMessage.tsx":
/*!************************************************!*\
  !*** ./app/components/events/eventMessage.tsx ***!
  \************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var sentry_components_events_errorLevel__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/events/errorLevel */ "./app/components/events/errorLevel.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }






const BaseEventMessage = _ref => {
  let {
    className,
    level,
    levelIndicatorSize,
    message,
    annotations
  } = _ref;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsxs)("div", {
    className: className,
    children: [level && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(StyledErrorLevel, {
      size: levelIndicatorSize,
      level: level,
      children: level
    }), message && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(Message, {
      children: message
    }), annotations]
  });
};

BaseEventMessage.displayName = "BaseEventMessage";

const EventMessage = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(BaseEventMessage,  true ? {
  target: "e1rp796r2"
} : 0)( true ? {
  name: "1go2o7p",
  styles: "display:flex;align-items:center;position:relative;line-height:1.2;overflow:hidden"
} : 0);

const StyledErrorLevel = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_events_errorLevel__WEBPACK_IMPORTED_MODULE_1__["default"],  true ? {
  target: "e1rp796r1"
} : 0)("margin-right:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_2__["default"])(1), ";" + ( true ? "" : 0));

const Message = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('span',  true ? {
  target: "e1rp796r0"
} : 0)(p => p.theme.overflowEllipsis, " width:auto;max-height:38px;" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (EventMessage);

/***/ }),

/***/ "./app/components/links/listLink.tsx":
/*!*******************************************!*\
  !*** ./app/components/links/listLink.tsx ***!
  \*******************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var react_router__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! react-router */ "../node_modules/react-router/es/index.js");
/* harmony import */ var classnames__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! classnames */ "../node_modules/classnames/index.js");
/* harmony import */ var classnames__WEBPACK_IMPORTED_MODULE_5___default = /*#__PURE__*/__webpack_require__.n(classnames__WEBPACK_IMPORTED_MODULE_5__);
/* harmony import */ var lodash_omit__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! lodash/omit */ "../node_modules/lodash/omit.js");
/* harmony import */ var lodash_omit__WEBPACK_IMPORTED_MODULE_6___default = /*#__PURE__*/__webpack_require__.n(lodash_omit__WEBPACK_IMPORTED_MODULE_6__);
/* harmony import */ var query_string__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! query-string */ "../node_modules/query-string/index.js");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");



 // eslint-disable-next-line no-restricted-imports







class ListLink extends react__WEBPACK_IMPORTED_MODULE_3__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "getClassName", () => {
      const _classNames = {};
      const {
        className,
        activeClassName
      } = this.props;

      if (className) {
        _classNames[className] = true;
      }

      if (this.isActive() && activeClassName) {
        _classNames[activeClassName] = true;
      }

      return classnames__WEBPACK_IMPORTED_MODULE_5___default()(_classNames);
    });
  }

  isActive() {
    const {
      isActive,
      to,
      query,
      index,
      router
    } = this.props;
    const queryData = query ? query_string__WEBPACK_IMPORTED_MODULE_7__.parse(query) : undefined;
    const target = typeof to === 'string' ? {
      pathname: to,
      query: queryData
    } : to;

    if (typeof isActive === 'function') {
      return isActive(target, index);
    }

    return router.isActive(target, index);
  }

  render() {
    const {
      index,
      children,
      to,
      disabled,
      ...props
    } = this.props;
    const carriedProps = lodash_omit__WEBPACK_IMPORTED_MODULE_6___default()(props, 'activeClassName', 'css', 'isActive', 'index', 'router', 'location');
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(StyledLi, {
      className: this.getClassName(),
      disabled: disabled,
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(react_router__WEBPACK_IMPORTED_MODULE_4__.Link, { ...carriedProps,
        onlyActiveOnIndex: index,
        to: disabled ? '' : to,
        children: children
      })
    });
  }

}

ListLink.displayName = "ListLink";

(0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(ListLink, "displayName", 'ListLink');

(0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(ListLink, "defaultProps", {
  activeClassName: 'active',
  index: false,
  disabled: false
});

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,react_router__WEBPACK_IMPORTED_MODULE_4__.withRouter)(ListLink));

const StyledLi = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('li',  true ? {
  shouldForwardProp: prop => prop !== 'disabled',
  target: "er8tqc10"
} : 0)(p => p.disabled && `
   a {
    color:${p.theme.disabled} !important;
    pointer-events: none;
    :hover {
      color: ${p.theme.disabled}  !important;
    }
   }
`, ";" + ( true ? "" : 0));

/***/ }),

/***/ "./app/components/pageAlertBar.tsx":
/*!*****************************************!*\
  !*** ./app/components/pageAlertBar.tsx ***!
  \*****************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");


const PageAlertBar = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "eb4vrz50"
} : 0)("display:flex;align-items:center;justify-content:center;color:", p => p.theme.headerBackground, ";background-color:", p => p.theme.bannerBackground, ";padding:6px 30px;font-size:14px;" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (PageAlertBar);

/***/ }),

/***/ "./app/components/replays/replaysFeatureBadge.tsx":
/*!********************************************************!*\
  !*** ./app/components/replays/replaysFeatureBadge.tsx ***!
  \********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var sentry_components_featureBadge__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/components/featureBadge */ "./app/components/featureBadge.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");



function ReplaysFeatureBadge(props) {
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_1__.jsx)(sentry_components_featureBadge__WEBPACK_IMPORTED_MODULE_0__["default"], { ...props,
    type: "alpha"
  });
}

ReplaysFeatureBadge.displayName = "ReplaysFeatureBadge";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (ReplaysFeatureBadge);

/***/ }),

/***/ "./app/components/seenByList.tsx":
/*!***************************************!*\
  !*** ./app/components/seenByList.tsx ***!
  \***************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var classnames__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! classnames */ "../node_modules/classnames/index.js");
/* harmony import */ var classnames__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(classnames__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var moment__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! moment */ "../node_modules/moment/moment.js");
/* harmony import */ var moment__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(moment__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var sentry_components_avatar_avatarList__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/avatar/avatarList */ "./app/components/avatar/avatarList.tsx");
/* harmony import */ var sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/tooltip */ "./app/components/tooltip.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_stores_configStore__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/stores/configStore */ "./app/stores/configStore.tsx");
/* harmony import */ var sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/utils/formatters */ "./app/utils/formatters.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");













const SeenByList = _ref => {
  let {
    avatarSize = 28,
    seenBy = [],
    iconTooltip = (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('People who have viewed this'),
    maxVisibleAvatars = 10,
    iconPosition = 'left',
    className
  } = _ref;
  const activeUser = sentry_stores_configStore__WEBPACK_IMPORTED_MODULE_8__["default"].get('user');
  const displayUsers = seenBy.filter(user => activeUser.id !== user.id);

  if (displayUsers.length === 0) {
    return null;
  } // Note className="seen-by" is required for responsive design


  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsxs)(SeenByWrapper, {
    iconPosition: iconPosition,
    className: classnames__WEBPACK_IMPORTED_MODULE_2___default()('seen-by', className),
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(sentry_components_avatar_avatarList__WEBPACK_IMPORTED_MODULE_4__["default"], {
      users: displayUsers,
      avatarSize: avatarSize,
      maxVisibleAvatars: maxVisibleAvatars,
      renderTooltip: user => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsxs)(react__WEBPACK_IMPORTED_MODULE_1__.Fragment, {
        children: [(0,sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_9__.userDisplayName)(user), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)("br", {}), moment__WEBPACK_IMPORTED_MODULE_3___default()(user.lastSeen).format('LL')]
      })
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(IconWrapper, {
      iconPosition: iconPosition,
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_5__["default"], {
        title: iconTooltip,
        skipWrapper: true,
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_6__.IconShow, {
          size: "sm",
          color: "subText"
        })
      })
    })]
  });
};

SeenByList.displayName = "SeenByList";

const SeenByWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1ayiung1"
} : 0)("display:flex;margin-top:15px;float:right;", p => p.iconPosition === 'left' ? 'flex-direction: row-reverse' : '', ";" + ( true ? "" : 0));

const IconWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1ayiung0"
} : 0)("display:flex;align-items:center;background-color:transparent;color:", p => p.theme.textColor, ";height:28px;width:24px;text-align:center;", p => p.iconPosition === 'left' ? 'margin-right: 10px' : '', ";" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (SeenByList);

/***/ }),

/***/ "./app/utils/discover/genericDiscoverQuery.tsx":
/*!*****************************************************!*\
  !*** ./app/utils/discover/genericDiscoverQuery.tsx ***!
  \*****************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "GenericDiscoverQuery": () => (/* binding */ GenericDiscoverQuery),
/* harmony export */   "QueryError": () => (/* binding */ QueryError),
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__),
/* harmony export */   "doDiscoverQuery": () => (/* binding */ doDiscoverQuery)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/es.error.cause.js */ "../node_modules/core-js/modules/es.error.cause.js");
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_discover_eventView__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/utils/discover/eventView */ "./app/utils/discover/eventView.tsx");
/* harmony import */ var sentry_utils_performance_contexts_performanceEventViewContext__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/utils/performance/contexts/performanceEventViewContext */ "./app/utils/performance/contexts/performanceEventViewContext.tsx");
/* harmony import */ var sentry_views_organizationContext__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/views/organizationContext */ "./app/views/organizationContext.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");









class QueryError {
  // For debugging in case parseError picks a value that doesn't make sense.
  constructor(errorMessage, originalError) {
    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "message", void 0);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "originalError", void 0);

    this.message = errorMessage;
    this.originalError = originalError;
  }

  getOriginalError() {
    return this.originalError;
  }

}

/**
 * Generic component for discover queries
 */
class _GenericDiscoverQuery extends react__WEBPACK_IMPORTED_MODULE_3__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", {
      isLoading: true,
      tableFetchID: undefined,
      error: null,
      tableData: null,
      pageLinks: null
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "_shouldRefetchData", prevProps => {
      const thisAPIPayload = this.getPayload(this.props);
      const otherAPIPayload = this.getPayload(prevProps);
      return !(0,sentry_utils_discover_eventView__WEBPACK_IMPORTED_MODULE_5__.isAPIPayloadSimilar)(thisAPIPayload, otherAPIPayload) || prevProps.limit !== this.props.limit || prevProps.route !== this.props.route || prevProps.cursor !== this.props.cursor;
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "_parseError", error => {
      var _error$responseJSON;

      if (this.props.parseError) {
        return this.props.parseError(error);
      }

      if (!error) {
        return null;
      }

      const detail = (_error$responseJSON = error.responseJSON) === null || _error$responseJSON === void 0 ? void 0 : _error$responseJSON.detail;

      if (typeof detail === 'string') {
        return new QueryError(detail, error);
      }

      const message = detail === null || detail === void 0 ? void 0 : detail.message;

      if (typeof message === 'string') {
        return new QueryError(message, error);
      }

      const unknownError = new QueryError((0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('An unknown error occurred.'), error);
      return unknownError;
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "fetchData", async () => {
      const {
        api,
        queryBatching,
        beforeFetch,
        afterFetch,
        didFetch,
        eventView,
        orgSlug,
        route,
        setError
      } = this.props;

      if (!eventView.isValid()) {
        return;
      }

      const url = `/organizations/${orgSlug}/${route}/`;
      const tableFetchID = Symbol(`tableFetchID`);
      const apiPayload = this.getPayload(this.props);
      this.setState({
        isLoading: true,
        tableFetchID
      });
      setError === null || setError === void 0 ? void 0 : setError(undefined);
      beforeFetch === null || beforeFetch === void 0 ? void 0 : beforeFetch(api); // clear any inflight requests since they are now stale

      api.clear();

      try {
        const [data,, resp] = await doDiscoverQuery(api, url, apiPayload, queryBatching);

        if (this.state.tableFetchID !== tableFetchID) {
          // invariant: a different request was initiated after this request
          return;
        }

        const tableData = afterFetch ? afterFetch(data, this.props) : data;
        didFetch === null || didFetch === void 0 ? void 0 : didFetch(tableData);
        this.setState(prevState => {
          var _resp$getResponseHead;

          return {
            isLoading: false,
            tableFetchID: undefined,
            error: null,
            pageLinks: (_resp$getResponseHead = resp === null || resp === void 0 ? void 0 : resp.getResponseHeader('Link')) !== null && _resp$getResponseHead !== void 0 ? _resp$getResponseHead : prevState.pageLinks,
            tableData
          };
        });
      } catch (err) {
        const error = this._parseError(err);

        this.setState({
          isLoading: false,
          tableFetchID: undefined,
          error,
          tableData: null
        });

        if (setError) {
          setError(error !== null && error !== void 0 ? error : undefined);
        }
      }
    });
  }

  componentDidMount() {
    this.fetchData();
  }

  componentDidUpdate(prevProps) {
    // Reload data if the payload changes
    const refetchCondition = this._shouldRefetchData(prevProps); // or if we've moved from an invalid view state to a valid one,


    const eventViewValidation = prevProps.eventView.isValid() === false && this.props.eventView.isValid();
    const shouldRefetchExternal = this.props.shouldRefetchData ? this.props.shouldRefetchData(prevProps, this.props) : false;

    if (refetchCondition || eventViewValidation || shouldRefetchExternal) {
      this.fetchData();
    }
  }

  getPayload(props) {
    var _props$queryExtras;

    const {
      cursor,
      limit,
      noPagination,
      referrer
    } = props;
    const payload = this.props.getRequestPayload ? this.props.getRequestPayload(props) : props.eventView.getEventsAPIPayload(props.location, props.forceAppendRawQueryString);

    if (cursor) {
      payload.cursor = cursor;
    }

    if (limit) {
      payload.per_page = limit;
    }

    if (noPagination) {
      payload.noPagination = noPagination;
    }

    if (referrer) {
      payload.referrer = referrer;
    }

    Object.assign(payload, (_props$queryExtras = props.queryExtras) !== null && _props$queryExtras !== void 0 ? _props$queryExtras : {});
    return payload;
  }

  render() {
    const {
      isLoading,
      error,
      tableData,
      pageLinks
    } = this.state;
    const childrenProps = {
      isLoading,
      error,
      tableData,
      pageLinks
    };
    const children = this.props.children; // Explicitly setting type due to issues with generics and React's children

    return children === null || children === void 0 ? void 0 : children(childrenProps);
  }

}

_GenericDiscoverQuery.displayName = "_GenericDiscoverQuery";
// Shim to allow us to use generic discover query or any specialization with or without passing org slug or eventview, which are now contexts.
// This will help keep tests working and we can remove extra uses of context-provided props and update tests as we go.
function GenericDiscoverQuery(props) {
  var _useContext, _useContext2, _props$orgSlug, _props$eventView;

  const organizationSlug = (_useContext = (0,react__WEBPACK_IMPORTED_MODULE_3__.useContext)(sentry_views_organizationContext__WEBPACK_IMPORTED_MODULE_7__.OrganizationContext)) === null || _useContext === void 0 ? void 0 : _useContext.slug;
  const performanceEventView = (_useContext2 = (0,react__WEBPACK_IMPORTED_MODULE_3__.useContext)(sentry_utils_performance_contexts_performanceEventViewContext__WEBPACK_IMPORTED_MODULE_6__.PerformanceEventViewContext)) === null || _useContext2 === void 0 ? void 0 : _useContext2.eventView;
  const orgSlug = (_props$orgSlug = props.orgSlug) !== null && _props$orgSlug !== void 0 ? _props$orgSlug : organizationSlug;
  const eventView = (_props$eventView = props.eventView) !== null && _props$eventView !== void 0 ? _props$eventView : performanceEventView;

  if (orgSlug === undefined || eventView === undefined) {
    throw new Error('GenericDiscoverQuery requires both an orgSlug and eventView');
  }

  const _props = { ...props,
    orgSlug,
    eventView
  };
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(_GenericDiscoverQuery, { ..._props
  });
}
GenericDiscoverQuery.displayName = "GenericDiscoverQuery";
function doDiscoverQuery(api, url, params, queryBatching) {
  if (queryBatching !== null && queryBatching !== void 0 && queryBatching.batchRequest) {
    return queryBatching.batchRequest(api, url, {
      query: params,
      includeAllArgs: true
    });
  }

  return api.requestPromise(url, {
    method: 'GET',
    includeAllArgs: true,
    query: { // marking params as any so as to not cause typescript errors
      ...params
    }
  });
}
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (GenericDiscoverQuery);

/***/ }),

/***/ "./app/utils/displayReprocessEventAction.tsx":
/*!***************************************************!*\
  !*** ./app/utils/displayReprocessEventAction.tsx ***!
  \***************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "displayReprocessEventAction": () => (/* binding */ displayReprocessEventAction)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var sentry_types__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/types */ "./app/types/index.tsx");



const NATIVE_PLATFORMS = ['cocoa', 'native']; // Finds all frames in a given data blob and returns it's platforms

function getPlatforms(exceptionValue) {
  var _exceptionValue$frame, _stacktrace$frames, _stacktrace;

  const frames = (_exceptionValue$frame = exceptionValue === null || exceptionValue === void 0 ? void 0 : exceptionValue.frames) !== null && _exceptionValue$frame !== void 0 ? _exceptionValue$frame : [];
  const stacktraceFrames = (_stacktrace$frames = exceptionValue === null || exceptionValue === void 0 ? void 0 : (_stacktrace = exceptionValue.stacktrace) === null || _stacktrace === void 0 ? void 0 : _stacktrace.frames) !== null && _stacktrace$frames !== void 0 ? _stacktrace$frames : [];

  if (!frames.length && !stacktraceFrames.length) {
    return [];
  }

  return [...frames, ...stacktraceFrames].map(frame => frame.platform).filter(platform => !!platform);
}

function getStackTracePlatforms(event, exceptionEntry) {
  var _exceptionEntry$data$, _event$entries$find$d, _event$entries$find, _event$entries$find$d2, _event$entries$find2;

  // Fetch platforms in stack traces of an exception entry
  const exceptionEntryPlatforms = ((_exceptionEntry$data$ = exceptionEntry.data.values) !== null && _exceptionEntry$data$ !== void 0 ? _exceptionEntry$data$ : []).flatMap(getPlatforms); // Fetch platforms in an exception entry

  const stackTraceEntry = (_event$entries$find$d = (_event$entries$find = event.entries.find(entry => entry.type === sentry_types__WEBPACK_IMPORTED_MODULE_2__.EntryType.STACKTRACE)) === null || _event$entries$find === void 0 ? void 0 : _event$entries$find.data) !== null && _event$entries$find$d !== void 0 ? _event$entries$find$d : {}; // Fetch platforms in an exception entry

  const stackTraceEntryPlatforms = Object.keys(stackTraceEntry).flatMap(key => getPlatforms(stackTraceEntry[key])); // Fetch platforms in an thread entry

  const threadEntry = (_event$entries$find$d2 = (_event$entries$find2 = event.entries.find(entry => entry.type === sentry_types__WEBPACK_IMPORTED_MODULE_2__.EntryType.THREADS)) === null || _event$entries$find2 === void 0 ? void 0 : _event$entries$find2.data.values) !== null && _event$entries$find$d2 !== void 0 ? _event$entries$find$d2 : []; // Fetch platforms in a thread entry

  const threadEntryPlatforms = threadEntry.flatMap(_ref => {
    let {
      stacktrace
    } = _ref;
    return getPlatforms(stacktrace);
  });
  return new Set([...exceptionEntryPlatforms, ...stackTraceEntryPlatforms, ...threadEntryPlatforms]);
} // Checks whether an event indicates that it is a native event.


function isNativeEvent(event, exceptionEntry) {
  const {
    platform
  } = event;

  if (platform && NATIVE_PLATFORMS.includes(platform)) {
    return true;
  }

  const stackTracePlatforms = getStackTracePlatforms(event, exceptionEntry);
  return NATIVE_PLATFORMS.some(nativePlatform => stackTracePlatforms.has(nativePlatform));
} //  Checks whether an event indicates that it has an associated minidump.


function isMinidumpEvent(exceptionEntry) {
  var _data$values;

  const {
    data
  } = exceptionEntry;
  return ((_data$values = data.values) !== null && _data$values !== void 0 ? _data$values : []).some(value => {
    var _value$mechanism;

    return ((_value$mechanism = value.mechanism) === null || _value$mechanism === void 0 ? void 0 : _value$mechanism.type) === 'minidump';
  });
} // Checks whether an event indicates that it has an apple crash report.


function isAppleCrashReportEvent(exceptionEntry) {
  var _data$values2;

  const {
    data
  } = exceptionEntry;
  return ((_data$values2 = data.values) !== null && _data$values2 !== void 0 ? _data$values2 : []).some(value => {
    var _value$mechanism2;

    return ((_value$mechanism2 = value.mechanism) === null || _value$mechanism2 === void 0 ? void 0 : _value$mechanism2.type) === 'applecrashreport';
  });
}

function displayReprocessEventAction(orgFeatures, event) {
  if (!event || !orgFeatures.includes('reprocessing-v2')) {
    return false;
  }

  const {
    entries
  } = event;
  const exceptionEntry = entries.find(entry => entry.type === sentry_types__WEBPACK_IMPORTED_MODULE_2__.EntryType.EXCEPTION);

  if (!exceptionEntry) {
    return false;
  } // We want to show the reprocessing button if the issue in question is native or contains native frames.
  // The logic is taken from the symbolication pipeline in Python, where it is used to determine whether reprocessing
  // payloads should be stored:
  // https://github.com/getsentry/sentry/blob/cb7baef414890336881d67b7a8433ee47198c701/src/sentry/lang/native/processing.py#L425-L426
  // It is still not ideal as one can always merge native and non-native events together into one issue,
  // but it's the best approximation we have.


  if (!isMinidumpEvent(exceptionEntry) && !isAppleCrashReportEvent(exceptionEntry) && !isNativeEvent(event, exceptionEntry)) {
    return false;
  }

  return true;
}

/***/ }),

/***/ "./app/utils/performance/contexts/performanceEventViewContext.tsx":
/*!************************************************************************!*\
  !*** ./app/utils/performance/contexts/performanceEventViewContext.tsx ***!
  \************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "PerformanceEventViewContext": () => (/* binding */ PerformanceEventViewContext),
/* harmony export */   "PerformanceEventViewProvider": () => (/* binding */ PerformanceEventViewProvider),
/* harmony export */   "useMutablePerformanceEventView": () => (/* binding */ useMutablePerformanceEventView),
/* harmony export */   "usePerformanceEventView": () => (/* binding */ usePerformanceEventView)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./utils */ "./app/utils/performance/contexts/utils.tsx");


const [PerformanceEventViewProvider, _usePerformanceEventView, PerformanceEventViewContext] = (0,_utils__WEBPACK_IMPORTED_MODULE_1__.createDefinedContext)({
  name: 'PerformanceEventViewContext'
});
 // Provides a readonly event view. Also omits anything that isn't currently read-only, although in the future we should switch the code in EventView instead.
// If you need mutability, use the mutable version.

function usePerformanceEventView() {
  return _usePerformanceEventView().eventView;
}
function useMutablePerformanceEventView() {
  return usePerformanceEventView().clone();
}

/***/ }),

/***/ "./app/utils/performance/contexts/utils.tsx":
/*!**************************************************!*\
  !*** ./app/utils/performance/contexts/utils.tsx ***!
  \**************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "createDefinedContext": () => (/* binding */ createDefinedContext)
/* harmony export */ });
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/es.error.cause.js */ "../node_modules/core-js/modules/es.error.cause.js");
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");



/*
 * Creates provider, context and useContext hook, guarding against calling useContext without a provider.
 * [0]: https://github.com/chakra-ui/chakra-ui/blob/c0f9c287df0397e2aa9bd90eb3d5c2f2c08aa0b1/packages/utils/src/react-helpers.ts#L27
 *
 * Renamed to createDefinedContext to not conflate with React context.
 */
function createDefinedContext(options) {
  const {
    strict = true,
    errorMessage = `useContext for "${options.name}" must be inside a Provider with a value`,
    name
  } = options;
  const Context = /*#__PURE__*/(0,react__WEBPACK_IMPORTED_MODULE_1__.createContext)(undefined);
  Context.displayName = name;

  function useDefinedContext() {
    const context = (0,react__WEBPACK_IMPORTED_MODULE_1__.useContext)(Context);

    if (!context && strict) {
      throw new Error(errorMessage);
    }

    return context;
  }

  return [Context.Provider, useDefinedContext, Context];
}

/***/ }),

/***/ "./app/utils/recreateRoute.tsx":
/*!*************************************!*\
  !*** ./app/utils/recreateRoute.tsx ***!
  \*************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ recreateRoute)
/* harmony export */ });
/* harmony import */ var lodash_findLastIndex__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! lodash/findLastIndex */ "../node_modules/lodash/findLastIndex.js");
/* harmony import */ var lodash_findLastIndex__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(lodash_findLastIndex__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var sentry_utils_replaceRouterParams__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/utils/replaceRouterParams */ "./app/utils/replaceRouterParams.tsx");



/**
 * Given a route object or a string and a list of routes + params from router, this will attempt to recreate a location string while replacing url params.
 * Can additionally specify the number of routes to move back
 *
 * See tests for examples
 */
function recreateRoute(to, options) {
  var _location$search, _location$hash;

  const {
    routes,
    params,
    location,
    stepBack
  } = options;
  const paths = routes.map(_ref => {
    let {
      path
    } = _ref;
    return path || '';
  });
  let lastRootIndex;
  let routeIndex; // TODO(ts): typescript things

  if (typeof to !== 'string') {
    routeIndex = routes.indexOf(to) + 1;
    lastRootIndex = lodash_findLastIndex__WEBPACK_IMPORTED_MODULE_0___default()(paths.slice(0, routeIndex), path => path[0] === '/');
  } else {
    lastRootIndex = lodash_findLastIndex__WEBPACK_IMPORTED_MODULE_0___default()(paths, path => path[0] === '/');
  }

  let baseRoute = paths.slice(lastRootIndex, routeIndex);

  if (typeof stepBack !== 'undefined') {
    baseRoute = baseRoute.slice(0, stepBack);
  }

  const search = (_location$search = location === null || location === void 0 ? void 0 : location.search) !== null && _location$search !== void 0 ? _location$search : '';
  const hash = (_location$hash = location === null || location === void 0 ? void 0 : location.hash) !== null && _location$hash !== void 0 ? _location$hash : '';
  const fullRoute = `${baseRoute.join('')}${typeof to !== 'string' ? '' : to}${search}${hash}`;
  return (0,sentry_utils_replaceRouterParams__WEBPACK_IMPORTED_MODULE_1__["default"])(fullRoute, params);
}

/***/ }),

/***/ "./app/views/organizationGroupDetails/actions/index.tsx":
/*!**************************************************************!*\
  !*** ./app/views/organizationGroupDetails/actions/index.tsx ***!
  \**************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "Actions": () => (/* binding */ Actions),
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
/* harmony import */ var sentry_actionCreators_group__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/actionCreators/group */ "./app/actionCreators/group.tsx");
/* harmony import */ var sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/actionCreators/indicator */ "./app/actionCreators/indicator.tsx");
/* harmony import */ var sentry_actionCreators_modal__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/actionCreators/modal */ "./app/actionCreators/modal.tsx");
/* harmony import */ var sentry_components_acl_access__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/acl/access */ "./app/components/acl/access.tsx");
/* harmony import */ var sentry_components_acl_feature__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/acl/feature */ "./app/components/acl/feature.tsx");
/* harmony import */ var sentry_components_acl_featureDisabled__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/components/acl/featureDisabled */ "./app/components/acl/featureDisabled.tsx");
/* harmony import */ var sentry_components_actions_button__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/components/actions/button */ "./app/components/actions/button.tsx");
/* harmony import */ var sentry_components_actions_ignore__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/components/actions/ignore */ "./app/components/actions/ignore.tsx");
/* harmony import */ var sentry_components_actions_resolve__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/components/actions/resolve */ "./app/components/actions/resolve.tsx");
/* harmony import */ var sentry_components_assistant_guideAnchor__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/components/assistant/guideAnchor */ "./app/components/assistant/guideAnchor.tsx");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_dropdownMenuControl__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! sentry/components/dropdownMenuControl */ "./app/components/dropdownMenuControl.tsx");
/* harmony import */ var sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! sentry/components/tooltip */ "./app/components/tooltip.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_20__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_stores_groupStore__WEBPACK_IMPORTED_MODULE_21__ = __webpack_require__(/*! sentry/stores/groupStore */ "./app/stores/groupStore.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_22__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_analytics__WEBPACK_IMPORTED_MODULE_23__ = __webpack_require__(/*! sentry/utils/analytics */ "./app/utils/analytics.tsx");
/* harmony import */ var sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_24__ = __webpack_require__(/*! sentry/utils/analytics/trackAdvancedAnalyticsEvent */ "./app/utils/analytics/trackAdvancedAnalyticsEvent.tsx");
/* harmony import */ var sentry_utils_dates__WEBPACK_IMPORTED_MODULE_25__ = __webpack_require__(/*! sentry/utils/dates */ "./app/utils/dates.tsx");
/* harmony import */ var sentry_utils_discover_eventView__WEBPACK_IMPORTED_MODULE_26__ = __webpack_require__(/*! sentry/utils/discover/eventView */ "./app/utils/discover/eventView.tsx");
/* harmony import */ var sentry_utils_displayReprocessEventAction__WEBPACK_IMPORTED_MODULE_27__ = __webpack_require__(/*! sentry/utils/displayReprocessEventAction */ "./app/utils/displayReprocessEventAction.tsx");
/* harmony import */ var sentry_utils_guid__WEBPACK_IMPORTED_MODULE_28__ = __webpack_require__(/*! sentry/utils/guid */ "./app/utils/guid.tsx");
/* harmony import */ var sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_29__ = __webpack_require__(/*! sentry/utils/withApi */ "./app/utils/withApi.tsx");
/* harmony import */ var sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_30__ = __webpack_require__(/*! sentry/utils/withOrganization */ "./app/utils/withOrganization.tsx");
/* harmony import */ var sentry_views_issueList_actions_reviewAction__WEBPACK_IMPORTED_MODULE_31__ = __webpack_require__(/*! sentry/views/issueList/actions/reviewAction */ "./app/views/issueList/actions/reviewAction.tsx");
/* harmony import */ var sentry_views_organizationGroupDetails_actions_shareIssue__WEBPACK_IMPORTED_MODULE_32__ = __webpack_require__(/*! sentry/views/organizationGroupDetails/actions/shareIssue */ "./app/views/organizationGroupDetails/actions/shareIssue.tsx");
/* harmony import */ var _subscribeAction__WEBPACK_IMPORTED_MODULE_33__ = __webpack_require__(/*! ./subscribeAction */ "./app/views/organizationGroupDetails/actions/subscribeAction.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_34__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");





































class Actions extends react__WEBPACK_IMPORTED_MODULE_4__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", {
      shareBusy: false
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "onDelete", () => {
      const {
        group,
        project,
        organization,
        api
      } = this.props;
      (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_7__.addLoadingMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_20__.t)('Delete event\u2026'));
      (0,sentry_actionCreators_group__WEBPACK_IMPORTED_MODULE_6__.bulkDelete)(api, {
        orgId: organization.slug,
        projectId: project.slug,
        itemIds: [group.id]
      }, {
        complete: () => {
          (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_7__.clearIndicators)();
          react_router__WEBPACK_IMPORTED_MODULE_5__.browserHistory.push(`/${organization.slug}/${project.slug}/`);
        }
      });
      this.trackIssueAction('deleted');
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "onUpdate", data => {
      const {
        group,
        project,
        organization,
        api
      } = this.props;
      (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_7__.addLoadingMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_20__.t)('Saving changes\u2026'));
      (0,sentry_actionCreators_group__WEBPACK_IMPORTED_MODULE_6__.bulkUpdate)(api, {
        orgId: organization.slug,
        projectId: project.slug,
        itemIds: [group.id],
        data
      }, {
        complete: sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_7__.clearIndicators
      });

      if (data.status) {
        this.trackIssueAction(data.status);
      }

      if (data.inbox !== undefined) {
        this.trackIssueAction('mark_reviewed');
      }
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "onReprocessEvent", () => {
      const {
        group,
        organization
      } = this.props;
      (0,sentry_actionCreators_modal__WEBPACK_IMPORTED_MODULE_8__.openReprocessEventModal)({
        organization,
        groupId: group.id
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "onToggleShare", () => {
      const newIsPublic = !this.props.group.isPublic;

      if (newIsPublic) {
        (0,sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_24__["default"])('issue.shared_publicly', {
          organization: this.props.organization
        });
      }

      this.onShare(newIsPublic);
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "onToggleBookmark", () => {
      this.onUpdate({
        isBookmarked: !this.props.group.isBookmarked
      });
      this.trackIssueAction('bookmarked');
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "onToggleSubscribe", () => {
      this.onUpdate({
        isSubscribed: !this.props.group.isSubscribed
      });
      this.trackIssueAction('subscribed');
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "onRedirectDiscover", () => {
      const {
        organization
      } = this.props;
      (0,sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_24__["default"])('growth.issue_open_in_discover_btn_clicked', {
        organization
      });
      react_router__WEBPACK_IMPORTED_MODULE_5__.browserHistory.push(this.getDiscoverUrl());
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "onDiscard", () => {
      const {
        group,
        project,
        organization,
        api
      } = this.props;
      const id = (0,sentry_utils_guid__WEBPACK_IMPORTED_MODULE_28__.uniqueId)();
      (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_7__.addLoadingMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_20__.t)('Discarding event\u2026'));
      sentry_stores_groupStore__WEBPACK_IMPORTED_MODULE_21__["default"].onDiscard(id, group.id);
      api.request(`/issues/${group.id}/`, {
        method: 'PUT',
        data: {
          discard: true
        },
        success: response => {
          sentry_stores_groupStore__WEBPACK_IMPORTED_MODULE_21__["default"].onDiscardSuccess(id, group.id, response);
          react_router__WEBPACK_IMPORTED_MODULE_5__.browserHistory.push(`/${organization.slug}/${project.slug}/`);
        },
        error: error => {
          sentry_stores_groupStore__WEBPACK_IMPORTED_MODULE_21__["default"].onDiscardError(id, group.id, error);
        },
        complete: sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_7__.clearIndicators
      });
      this.trackIssueAction('discarded');
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "renderDiscardModal", _ref => {
      let {
        Body,
        Footer,
        closeModal
      } = _ref;
      const {
        organization,
        project
      } = this.props;

      function renderDiscardDisabled(_ref2) {
        let {
          children,
          ...props
        } = _ref2;
        return children({ ...props,
          renderDisabled: _ref3 => {
            let {
              features
            } = _ref3;
            return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_34__.jsx)(sentry_components_acl_featureDisabled__WEBPACK_IMPORTED_MODULE_11__["default"], {
              alert: true,
              featureName: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_20__.t)('Discard and Delete'),
              features: features
            });
          }
        });
      }

      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_34__.jsx)(sentry_components_acl_feature__WEBPACK_IMPORTED_MODULE_10__["default"], {
        features: ['projects:discard-groups'],
        hookName: "feature-disabled:discard-groups",
        organization: organization,
        project: project,
        renderDisabled: renderDiscardDisabled,
        children: _ref4 => {
          let {
            hasFeature,
            renderDisabled,
            ...props
          } = _ref4;
          return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_34__.jsxs)(react__WEBPACK_IMPORTED_MODULE_4__.Fragment, {
            children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_34__.jsxs)(Body, {
              children: [!hasFeature && typeof renderDisabled === 'function' && renderDisabled({ ...props,
                hasFeature,
                children: null
              }), (0,sentry_locale__WEBPACK_IMPORTED_MODULE_20__.t)(`Discarding this event will result in the deletion of most data associated with this issue and future events being discarded before reaching your stream. Are you sure you wish to continue?`)]
            }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_34__.jsxs)(Footer, {
              children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_34__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_16__["default"], {
                onClick: closeModal,
                children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_20__.t)('Cancel')
              }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_34__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_16__["default"], {
                style: {
                  marginLeft: (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_22__["default"])(1)
                },
                priority: "primary",
                onClick: this.onDiscard,
                disabled: !hasFeature,
                children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_20__.t)('Discard Future Events')
              })]
            })]
          });
        }
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "openDiscardModal", () => {
      const {
        organization
      } = this.props;
      (0,sentry_actionCreators_modal__WEBPACK_IMPORTED_MODULE_8__.openModal)(this.renderDiscardModal);
      (0,sentry_utils_analytics__WEBPACK_IMPORTED_MODULE_23__.analytics)('feature.discard_group.modal_opened', {
        org_id: parseInt(organization.id, 10)
      });
    });
  }

  componentWillReceiveProps(nextProps) {
    if (this.state.shareBusy && nextProps.group.shareId !== this.props.group.shareId) {
      this.setState({
        shareBusy: false
      });
    }
  }

  getShareUrl(shareId) {
    if (!shareId) {
      return '';
    }

    const path = `/share/issue/${shareId}/`;
    const {
      host,
      protocol
    } = window.location;
    return `${protocol}//${host}${path}`;
  }

  getDiscoverUrl() {
    const {
      group,
      project,
      organization
    } = this.props;
    const {
      title,
      id,
      type
    } = group;
    const discoverQuery = {
      id: undefined,
      name: title || type,
      fields: ['title', 'release', 'environment', 'user.display', 'timestamp'],
      orderby: '-timestamp',
      query: `issue.id:${id}`,
      projects: [Number(project.id)],
      version: 2,
      range: '90d'
    };
    const discoverView = sentry_utils_discover_eventView__WEBPACK_IMPORTED_MODULE_26__["default"].fromSavedQuery(discoverQuery);
    return discoverView.getResultsViewUrlTarget(organization.slug);
  }

  trackIssueAction(action) {
    const {
      group,
      project,
      organization,
      query = {}
    } = this.props;
    const {
      alert_date,
      alert_rule_id,
      alert_type
    } = query;
    (0,sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_24__["default"])('issue_details.action_clicked', {
      organization,
      project_id: parseInt(project.id, 10),
      group_id: parseInt(group.id, 10),
      action_type: action,
      // Alert properties track if the user came from email/slack alerts
      alert_date: typeof alert_date === 'string' ? (0,sentry_utils_dates__WEBPACK_IMPORTED_MODULE_25__.getUtcDateString)(Number(alert_date)) : undefined,
      alert_rule_id: typeof alert_rule_id === 'string' ? alert_rule_id : undefined,
      alert_type: typeof alert_type === 'string' ? alert_type : undefined
    });
  }

  onShare(shared) {
    const {
      group,
      project,
      organization,
      api
    } = this.props;
    this.setState({
      shareBusy: true
    }); // not sure why this is a bulkUpdate

    (0,sentry_actionCreators_group__WEBPACK_IMPORTED_MODULE_6__.bulkUpdate)(api, {
      orgId: organization.slug,
      projectId: project.slug,
      itemIds: [group.id],
      data: {
        isPublic: shared
      }
    }, {
      error: () => {
        (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_7__.addErrorMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_20__.t)('Error sharing'));
      },
      complete: () => {// shareBusy marked false in componentWillReceiveProps to sync
        // busy state update with shareId update
      }
    });
    this.trackIssueAction('shared');
  }

  handleClick(disabled, onClick) {
    return function (event) {
      if (disabled) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      onClick(event);
    };
  }

  render() {
    var _project$features;

    const {
      group,
      project,
      organization,
      disabled,
      event
    } = this.props;
    const {
      status,
      isBookmarked
    } = group;
    const orgFeatures = new Set(organization.features);
    const bookmarkKey = isBookmarked ? 'unbookmark' : 'bookmark';
    const bookmarkTitle = isBookmarked ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_20__.t)('Remove bookmark') : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_20__.t)('Bookmark');
    const hasRelease = !!((_project$features = project.features) !== null && _project$features !== void 0 && _project$features.includes('releases'));
    const isResolved = status === 'resolved';
    const isIgnored = status === 'ignored';
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_34__.jsxs)(Wrapper, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_34__.jsx)(sentry_components_assistant_guideAnchor__WEBPACK_IMPORTED_MODULE_15__["default"], {
        target: "resolve",
        position: "bottom",
        offset: 20,
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_34__.jsx)(sentry_components_actions_resolve__WEBPACK_IMPORTED_MODULE_14__["default"], {
          disabled: disabled,
          disableDropdown: disabled,
          hasRelease: hasRelease,
          latestRelease: project.latestRelease,
          onUpdate: this.onUpdate,
          orgSlug: organization.slug,
          projectSlug: project.slug,
          isResolved: isResolved,
          isAutoResolved: group.status === 'resolved' ? group.statusDetails.autoResolved : undefined
        })
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_34__.jsx)(sentry_components_assistant_guideAnchor__WEBPACK_IMPORTED_MODULE_15__["default"], {
        target: "ignore_delete_discard",
        position: "bottom",
        offset: 20,
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_34__.jsx)(sentry_components_actions_ignore__WEBPACK_IMPORTED_MODULE_13__["default"], {
          isIgnored: isIgnored,
          onUpdate: this.onUpdate,
          disabled: disabled
        })
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_34__.jsx)(sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_18__["default"], {
        disabled: !!group.inbox || disabled,
        title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_20__.t)('Issue has been reviewed'),
        delay: 300,
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_34__.jsx)(sentry_views_issueList_actions_reviewAction__WEBPACK_IMPORTED_MODULE_31__["default"], {
          onUpdate: this.onUpdate,
          disabled: !group.inbox || disabled
        })
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_34__.jsx)(sentry_components_acl_feature__WEBPACK_IMPORTED_MODULE_10__["default"], {
        hookName: "feature-disabled:open-in-discover",
        features: ['discover-basic'],
        organization: organization,
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_34__.jsx)(sentry_components_actions_button__WEBPACK_IMPORTED_MODULE_12__["default"], {
          disabled: disabled,
          to: disabled ? '' : this.getDiscoverUrl(),
          onClick: () => {
            this.trackIssueAction('open_in_discover');
            (0,sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_24__["default"])('growth.issue_open_in_discover_btn_clicked', {
              organization
            });
          },
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_34__.jsx)(sentry_components_assistant_guideAnchor__WEBPACK_IMPORTED_MODULE_15__["default"], {
            target: "open_in_discover",
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_20__.t)('Open in Discover')
          })
        })
      }), orgFeatures.has('shared-issues') && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_34__.jsx)(sentry_views_organizationGroupDetails_actions_shareIssue__WEBPACK_IMPORTED_MODULE_32__["default"], {
        disabled: disabled,
        loading: this.state.shareBusy,
        isShared: group.isPublic,
        shareUrl: this.getShareUrl(group.shareId),
        onToggle: this.onToggleShare,
        onReshare: () => this.onShare(true)
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_34__.jsx)(_subscribeAction__WEBPACK_IMPORTED_MODULE_33__["default"], {
        disabled: disabled,
        group: group,
        onClick: this.handleClick(disabled, this.onToggleSubscribe)
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_34__.jsx)(sentry_components_acl_access__WEBPACK_IMPORTED_MODULE_9__["default"], {
        organization: organization,
        access: ['event:admin'],
        children: _ref5 => {
          let {
            hasAccess
          } = _ref5;
          return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_34__.jsx)(sentry_components_dropdownMenuControl__WEBPACK_IMPORTED_MODULE_17__["default"], {
            triggerProps: {
              'aria-label': (0,sentry_locale__WEBPACK_IMPORTED_MODULE_20__.t)('More Actions'),
              icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_34__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_19__.IconEllipsis, {
                size: "xs"
              }),
              showChevron: false,
              size: 'xs'
            },
            items: [{
              key: bookmarkKey,
              label: bookmarkTitle,
              hidden: false,
              onAction: this.onToggleBookmark
            }, {
              key: 'reprocess',
              label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_20__.t)('Reprocess events'),
              hidden: !(0,sentry_utils_displayReprocessEventAction__WEBPACK_IMPORTED_MODULE_27__.displayReprocessEventAction)(organization.features, event),
              onAction: this.onReprocessEvent
            }, {
              key: 'delete-issue',
              priority: 'danger',
              label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_20__.t)('Delete'),
              hidden: !hasAccess,
              onAction: () => (0,sentry_actionCreators_modal__WEBPACK_IMPORTED_MODULE_8__.openModal)(_ref6 => {
                let {
                  Body,
                  Footer,
                  closeModal
                } = _ref6;
                return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_34__.jsxs)(react__WEBPACK_IMPORTED_MODULE_4__.Fragment, {
                  children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_34__.jsx)(Body, {
                    children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_20__.t)('Deleting this issue is permanent. Are you sure you wish to continue?')
                  }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_34__.jsxs)(Footer, {
                    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_34__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_16__["default"], {
                      onClick: closeModal,
                      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_20__.t)('Cancel')
                    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_34__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_16__["default"], {
                      style: {
                        marginLeft: (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_22__["default"])(1)
                      },
                      priority: "primary",
                      onClick: this.onDelete,
                      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_20__.t)('Delete')
                    })]
                  })]
                });
              })
            }, {
              key: 'delete-and-discard',
              priority: 'danger',
              label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_20__.t)('Delete and discard future events'),
              hidden: !hasAccess,
              onAction: () => this.openDiscardModal()
            }]
          });
        }
      })]
    });
  }

}

Actions.displayName = "Actions";

const Wrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e1sp93pk0"
} : 0)("display:grid;justify-content:flex-start;align-items:center;grid-auto-flow:column;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_22__["default"])(0.5), ";margin-top:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_22__["default"])(2), ";white-space:nowrap;" + ( true ? "" : 0));


/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_29__["default"])((0,sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_30__["default"])(Actions)));

/***/ }),

/***/ "./app/views/organizationGroupDetails/actions/shareIssue.tsx":
/*!*******************************************************************!*\
  !*** ./app/views/organizationGroupDetails/actions/shareIssue.tsx ***!
  \*******************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_actions_button__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/actions/button */ "./app/components/actions/button.tsx");
/* harmony import */ var sentry_components_autoSelectText__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/autoSelectText */ "./app/components/autoSelectText.tsx");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_clipboard__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/clipboard */ "./app/components/clipboard.tsx");
/* harmony import */ var sentry_components_confirm__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/confirm */ "./app/components/confirm.tsx");
/* harmony import */ var sentry_components_dropdownLink__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/dropdownLink */ "./app/components/dropdownLink.tsx");
/* harmony import */ var sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/loadingIndicator */ "./app/components/loadingIndicator.tsx");
/* harmony import */ var sentry_components_switchButton__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/switchButton */ "./app/components/switchButton.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");



function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }
















function ShareIssue(_ref) {
  let {
    loading,
    onReshare,
    onToggle,
    disabled,
    isShared,
    shareUrl
  } = _ref;
  const [hasConfirmModal, setHasConfirmModal] = (0,react__WEBPACK_IMPORTED_MODULE_2__.useState)(false); // State of confirm modal so we can keep dropdown menu opn

  const handleConfirmCancel = () => {
    setHasConfirmModal(false);
  };

  const handleConfirmReshare = () => {
    setHasConfirmModal(true);
  };

  const handleToggleShare = e => {
    e.preventDefault();
    onToggle();
  };

  const handleOpen = () => {
    // Starts sharing as soon as dropdown is opened
    if (!loading && !isShared) {
      onToggle();
    }
  };

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_components_dropdownLink__WEBPACK_IMPORTED_MODULE_8__["default"], {
    shouldIgnoreClickOutside: () => hasConfirmModal,
    customTitle: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsxs)(sentry_components_actions_button__WEBPACK_IMPORTED_MODULE_3__["default"], {
      disabled: disabled,
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsxs)(DropdownTitleContent, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(IndicatorDot, {
          isShared: isShared
        }), (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Share')]
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_11__.IconChevron, {
        direction: "down",
        size: "xs"
      })]
    }),
    onOpen: handleOpen,
    disabled: disabled,
    keepMenuOpen: true,
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsxs)(DropdownContent, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsxs)(Header, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(Title, {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Enable public share link')
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_components_switchButton__WEBPACK_IMPORTED_MODULE_10__["default"], {
          isActive: isShared,
          size: "sm",
          toggle: handleToggleShare
        })]
      }), loading && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(LoadingContainer, {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_9__["default"], {
          mini: true
        })
      }), !loading && isShared && shareUrl && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(ShareUrlContainer, {
        shareUrl: shareUrl,
        onCancel: handleConfirmCancel,
        onConfirming: handleConfirmReshare,
        onConfirm: onReshare
      })]
    })
  });
}

ShareIssue.displayName = "ShareIssue";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (ShareIssue);

function ShareUrlContainer(_ref2) {
  let {
    shareUrl,
    onConfirming,
    onCancel,
    onConfirm
  } = _ref2;
  const urlRef = (0,react__WEBPACK_IMPORTED_MODULE_2__.useRef)(null);
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsxs)(UrlContainer, {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(TextContainer, {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(StyledAutoSelectText, {
        ref: urlRef,
        children: shareUrl
      })
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_components_clipboard__WEBPACK_IMPORTED_MODULE_6__["default"], {
      hideUnsupported: true,
      value: shareUrl,
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(ClipboardButton, {
        title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Copy to clipboard'),
        borderless: true,
        size: "xs",
        onClick: () => {
          var _urlRef$current;

          return (_urlRef$current = urlRef.current) === null || _urlRef$current === void 0 ? void 0 : _urlRef$current.selectText();
        },
        icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_11__.IconCopy, {}),
        "aria-label": (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Copy to clipboard')
      })
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_components_confirm__WEBPACK_IMPORTED_MODULE_7__["default"], {
      message: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('You are about to regenerate a new shared URL. Your previously shared URL will no longer work. Do you want to continue?'),
      onCancel: onCancel,
      onConfirming: onConfirming,
      onConfirm: onConfirm,
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(ReshareButton, {
        title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Generate new URL'),
        "aria-label": (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Generate new URL'),
        borderless: true,
        size: "xs",
        icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_14__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_11__.IconRefresh, {})
      })
    })]
  });
}

ShareUrlContainer.displayName = "ShareUrlContainer";

const UrlContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1td2f0610"
} : 0)("display:flex;align-items:stretch;border:1px solid ", p => p.theme.border, ";border-radius:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_13__["default"])(0.5), ";" + ( true ? "" : 0));

const LoadingContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1td2f069"
} : 0)( true ? {
  name: "zl1inp",
  styles: "display:flex;justify-content:center"
} : 0);

const DropdownTitleContent = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1td2f068"
} : 0)("display:flex;align-items:center;margin-right:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_13__["default"])(0.5), ";" + ( true ? "" : 0));

const DropdownContent = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('li',  true ? {
  target: "e1td2f067"
} : 0)("padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_13__["default"])(1.5), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_13__["default"])(2), ";>div:not(:last-of-type){margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_13__["default"])(1.5), ";}" + ( true ? "" : 0));

const Header = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1td2f066"
} : 0)( true ? {
  name: "1066lcq",
  styles: "display:flex;justify-content:space-between;align-items:center"
} : 0);

const Title = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1td2f065"
} : 0)("padding-right:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_13__["default"])(4), ";white-space:nowrap;font-size:", p => p.theme.fontSizeMedium, ";font-weight:600;" + ( true ? "" : 0));

const IndicatorDot = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('span',  true ? {
  target: "e1td2f064"
} : 0)("display:inline-block;margin-right:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_13__["default"])(0.5), ";border-radius:50%;width:10px;height:10px;background:", p => p.isShared ? p.theme.active : p.theme.border, ";" + ( true ? "" : 0));

const StyledAutoSelectText = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_autoSelectText__WEBPACK_IMPORTED_MODULE_4__["default"],  true ? {
  target: "e1td2f063"
} : 0)("flex:1;padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_13__["default"])(0.5), " 0 ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_13__["default"])(0.5), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_13__["default"])(0.75), ";", p => p.theme.overflowEllipsis, ";" + ( true ? "" : 0));

const TextContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1td2f062"
} : 0)("position:relative;display:flex;flex:1;background-color:transparent;border-right:1px solid ", p => p.theme.border, ";max-width:288px;" + ( true ? "" : 0));

const ClipboardButton = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_button__WEBPACK_IMPORTED_MODULE_5__["default"],  true ? {
  target: "e1td2f061"
} : 0)("border-radius:0;border-right:1px solid ", p => p.theme.border, ";height:100%;&:hover{border-right:1px solid ", p => p.theme.border, ";}" + ( true ? "" : 0));

const ReshareButton = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_button__WEBPACK_IMPORTED_MODULE_5__["default"],  true ? {
  target: "e1td2f060"
} : 0)( true ? {
  name: "13udsys",
  styles: "height:100%"
} : 0);

/***/ }),

/***/ "./app/views/organizationGroupDetails/actions/subscribeAction.tsx":
/*!************************************************************************!*\
  !*** ./app/views/organizationGroupDetails/actions/subscribeAction.tsx ***!
  \************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var sentry_components_actions_button__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/components/actions/button */ "./app/components/actions/button.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ../utils */ "./app/views/organizationGroupDetails/utils.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");






function SubscribeAction(_ref) {
  var _group$subscriptionDe, _group$subscriptionDe2;

  let {
    disabled,
    group,
    onClick
  } = _ref;
  const disabledNotifications = (_group$subscriptionDe = (_group$subscriptionDe2 = group.subscriptionDetails) === null || _group$subscriptionDe2 === void 0 ? void 0 : _group$subscriptionDe2.disabled) !== null && _group$subscriptionDe !== void 0 ? _group$subscriptionDe : false;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(sentry_components_actions_button__WEBPACK_IMPORTED_MODULE_0__["default"], {
    disabled: disabled || disabledNotifications,
    title: (0,_utils__WEBPACK_IMPORTED_MODULE_3__.getSubscriptionReason)(group, true),
    tooltipProps: {
      delay: 300
    },
    priority: group.isSubscribed ? 'primary' : 'default',
    size: "xs",
    "aria-label": (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Subscribe'),
    onClick: onClick,
    icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_1__.IconBell, {
      size: "xs"
    })
  });
}

SubscribeAction.displayName = "SubscribeAction";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (SubscribeAction);

/***/ }),

/***/ "./app/views/organizationGroupDetails/constants.tsx":
/*!**********************************************************!*\
  !*** ./app/views/organizationGroupDetails/constants.tsx ***!
  \**********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "ERROR_TYPES": () => (/* binding */ ERROR_TYPES)
/* harmony export */ });
const ERROR_TYPES = {
  GROUP_NOT_FOUND: 'GROUP_NOT_FOUND',
  MISSING_MEMBERSHIP: 'MISSING_MEMBERSHIP'
};

/***/ }),

/***/ "./app/views/organizationGroupDetails/groupDetails.tsx":
/*!*************************************************************!*\
  !*** ./app/views/organizationGroupDetails/groupDetails.tsx ***!
  \*************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
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
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! core-js/modules/es.error.cause.js */ "../node_modules/core-js/modules/es.error.cause.js");
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_4___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_4__);
/* harmony import */ var core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! core-js/modules/es.string.replace.js */ "../node_modules/core-js/modules/es.string.replace.js");
/* harmony import */ var core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_5___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_5__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var react_router__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! react-router */ "../node_modules/react-router/es/index.js");
/* harmony import */ var _sentry_react__WEBPACK_IMPORTED_MODULE_32__ = __webpack_require__(/*! @sentry/react */ "../node_modules/@sentry/hub/esm/exports.js");
/* harmony import */ var _sentry_react__WEBPACK_IMPORTED_MODULE_35__ = __webpack_require__(/*! @sentry/react */ "../node_modules/@sentry/react/esm/profiler.js");
/* harmony import */ var prop_types__WEBPACK_IMPORTED_MODULE_34__ = __webpack_require__(/*! prop-types */ "../node_modules/prop-types/index.js");
/* harmony import */ var prop_types__WEBPACK_IMPORTED_MODULE_34___default = /*#__PURE__*/__webpack_require__.n(prop_types__WEBPACK_IMPORTED_MODULE_34__);
/* harmony import */ var sentry_components_loadingError__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/loadingError */ "./app/components/loadingError.tsx");
/* harmony import */ var sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/loadingIndicator */ "./app/components/loadingIndicator.tsx");
/* harmony import */ var sentry_components_organizations_pageFilters_container__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/organizations/pageFilters/container */ "./app/components/organizations/pageFilters/container.tsx");
/* harmony import */ var sentry_components_projects_missingProjectMembership__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/components/projects/missingProjectMembership */ "./app/components/projects/missingProjectMembership.tsx");
/* harmony import */ var sentry_components_sentryDocumentTitle__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/components/sentryDocumentTitle */ "./app/components/sentryDocumentTitle.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_sentryTypes__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/sentryTypes */ "./app/sentryTypes.tsx");
/* harmony import */ var sentry_stores_groupStore__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/stores/groupStore */ "./app/stores/groupStore.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_types_event__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! sentry/types/event */ "./app/types/event.tsx");
/* harmony import */ var sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! sentry/utils/analytics/trackAdvancedAnalyticsEvent */ "./app/utils/analytics/trackAdvancedAnalyticsEvent.tsx");
/* harmony import */ var sentry_utils_callIfFunction__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! sentry/utils/callIfFunction */ "./app/utils/callIfFunction.tsx");
/* harmony import */ var sentry_utils_dates__WEBPACK_IMPORTED_MODULE_20__ = __webpack_require__(/*! sentry/utils/dates */ "./app/utils/dates.tsx");
/* harmony import */ var sentry_utils_discover_eventView__WEBPACK_IMPORTED_MODULE_21__ = __webpack_require__(/*! sentry/utils/discover/eventView */ "./app/utils/discover/eventView.tsx");
/* harmony import */ var sentry_utils_discover_genericDiscoverQuery__WEBPACK_IMPORTED_MODULE_22__ = __webpack_require__(/*! sentry/utils/discover/genericDiscoverQuery */ "./app/utils/discover/genericDiscoverQuery.tsx");
/* harmony import */ var sentry_utils_events__WEBPACK_IMPORTED_MODULE_23__ = __webpack_require__(/*! sentry/utils/events */ "./app/utils/events.tsx");
/* harmony import */ var sentry_utils_projects__WEBPACK_IMPORTED_MODULE_24__ = __webpack_require__(/*! sentry/utils/projects */ "./app/utils/projects.tsx");
/* harmony import */ var sentry_utils_recreateRoute__WEBPACK_IMPORTED_MODULE_25__ = __webpack_require__(/*! sentry/utils/recreateRoute */ "./app/utils/recreateRoute.tsx");
/* harmony import */ var sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_26__ = __webpack_require__(/*! sentry/utils/withApi */ "./app/utils/withApi.tsx");
/* harmony import */ var _constants__WEBPACK_IMPORTED_MODULE_27__ = __webpack_require__(/*! ./constants */ "./app/views/organizationGroupDetails/constants.tsx");
/* harmony import */ var _header__WEBPACK_IMPORTED_MODULE_28__ = __webpack_require__(/*! ./header */ "./app/views/organizationGroupDetails/header.tsx");
/* harmony import */ var _sampleEventAlert__WEBPACK_IMPORTED_MODULE_29__ = __webpack_require__(/*! ./sampleEventAlert */ "./app/views/organizationGroupDetails/sampleEventAlert.tsx");
/* harmony import */ var _types__WEBPACK_IMPORTED_MODULE_30__ = __webpack_require__(/*! ./types */ "./app/views/organizationGroupDetails/types.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_31__ = __webpack_require__(/*! ./utils */ "./app/views/organizationGroupDetails/utils.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_33__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");





































class GroupDetails extends react__WEBPACK_IMPORTED_MODULE_6__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", this.initialState);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "refetchInterval", null);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "remountComponent", () => {
      this.setState(this.initialState);
      this.fetchData();
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "refetchGroup", async () => {
      const {
        loadingGroup,
        loading,
        loadingEvent,
        group
      } = this.state;

      if ((group === null || group === void 0 ? void 0 : group.status) !== _utils__WEBPACK_IMPORTED_MODULE_31__.ReprocessingStatus.REPROCESSING || loadingGroup || loading || loadingEvent) {
        return;
      }

      const {
        api
      } = this.props;
      this.setState({
        loadingGroup: true
      });

      try {
        const updatedGroup = await api.requestPromise(this.groupDetailsEndpoint, {
          query: this.getGroupQuery()
        });
        const reprocessingNewRoute = this.getReprocessingNewRoute(updatedGroup);

        if (reprocessingNewRoute) {
          react_router__WEBPACK_IMPORTED_MODULE_7__.browserHistory.push(reprocessingNewRoute);
          return;
        }

        this.setState({
          group: updatedGroup,
          loadingGroup: false
        });
      } catch (error) {
        this.handleRequestError(error);
      }
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "listener", sentry_stores_groupStore__WEBPACK_IMPORTED_MODULE_15__["default"].listen(itemIds => this.onGroupChange(itemIds), undefined));
  }

  getChildContext() {
    return {
      group: this.state.group,
      location: this.props.location
    };
  }

  componentDidMount() {
    this.fetchData(true);
    this.fetchReplaysCount();
    this.updateReprocessingProgress();
  }

  componentDidUpdate(prevProps, prevState) {
    var _prevProps$params, _this$props$params;

    const globalSelectionReadyChanged = prevProps.isGlobalSelectionReady !== this.props.isGlobalSelectionReady;

    if (globalSelectionReadyChanged || prevProps.location.pathname !== this.props.location.pathname) {
      // Skip tracking for other navigation events like switching events
      this.fetchData(globalSelectionReadyChanged);
    }

    if (!this.canLoadEventEarly(prevProps) && !(prevState !== null && prevState !== void 0 && prevState.group) && this.state.group || ((_prevProps$params = prevProps.params) === null || _prevProps$params === void 0 ? void 0 : _prevProps$params.eventId) !== ((_this$props$params = this.props.params) === null || _this$props$params === void 0 ? void 0 : _this$props$params.eventId) && this.state.group) {
      this.getEvent(this.state.group);
    }
  }

  componentWillUnmount() {
    sentry_stores_groupStore__WEBPACK_IMPORTED_MODULE_15__["default"].reset();
    (0,sentry_utils_callIfFunction__WEBPACK_IMPORTED_MODULE_19__.callIfFunction)(this.listener);

    if (this.refetchInterval) {
      window.clearInterval(this.refetchInterval);
    }
  }

  get initialState() {
    return {
      group: null,
      loading: true,
      loadingEvent: true,
      loadingGroup: true,
      loadingReplaysCount: true,
      error: false,
      eventError: false,
      errorType: null,
      project: null,
      replaysCount: null
    };
  }

  trackView(project) {
    const {
      organization,
      params,
      location
    } = this.props;
    const {
      alert_date,
      alert_rule_id,
      alert_type
    } = location.query;
    (0,sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_18__["default"])('issue_details.viewed', {
      organization,
      project_id: parseInt(project.id, 10),
      group_id: parseInt(params.groupId, 10),
      // Alert properties track if the user came from email/slack alerts
      alert_date: typeof alert_date === 'string' ? (0,sentry_utils_dates__WEBPACK_IMPORTED_MODULE_20__.getUtcDateString)(Number(alert_date)) : undefined,
      alert_rule_id: typeof alert_rule_id === 'string' ? alert_rule_id : undefined,
      alert_type: typeof alert_type === 'string' ? alert_type : undefined
    });
  }

  canLoadEventEarly(props) {
    return !props.params.eventId || ['oldest', 'latest'].includes(props.params.eventId);
  }

  get groupDetailsEndpoint() {
    return `/issues/${this.props.params.groupId}/`;
  }

  get groupReleaseEndpoint() {
    return `/issues/${this.props.params.groupId}/first-last-release/`;
  }

  addPerformanceSpecificEntries(event) {
    const performanceData = event.contexts.performance_issue;
    const spanTreeEntry = {
      data: {
        focusedSpanIds: performanceData.spans
      },
      type: sentry_types_event__WEBPACK_IMPORTED_MODULE_17__.EntryType.SPANTREE
    };
    const performanceEntry = {
      data: {},
      type: sentry_types_event__WEBPACK_IMPORTED_MODULE_17__.EntryType.PERFORMANCE
    };
    const updatedEvent = { ...event,
      entries: [performanceEntry, spanTreeEntry, ...event.entries]
    };
    return updatedEvent;
  }

  async getEvent(group) {
    var _group$project;

    if (group) {
      this.setState({
        loadingEvent: true,
        eventError: false
      });
    }

    const {
      params,
      environments,
      api,
      organization
    } = this.props;
    const orgSlug = params.orgId;
    const groupId = params.groupId;
    const eventId = (params === null || params === void 0 ? void 0 : params.eventId) || 'latest';
    const projectId = group === null || group === void 0 ? void 0 : (_group$project = group.project) === null || _group$project === void 0 ? void 0 : _group$project.slug;

    try {
      let event = await (0,_utils__WEBPACK_IMPORTED_MODULE_31__.fetchGroupEvent)(api, orgSlug, groupId, eventId, environments, projectId); // add extra perf issue specific entries like span tree and duration and span count charts

      if (organization.features.includes('performance-extraneous-spans-poc') && event.contexts.performance_issue) {
        const updatedEvent = this.addPerformanceSpecificEntries(event);
        event = updatedEvent;
      }

      this.setState({
        event,
        loading: false,
        eventError: false,
        loadingEvent: false
      });
    } catch (err) {
      // This is an expected error, capture to Sentry so that it is not considered as an unhandled error
      _sentry_react__WEBPACK_IMPORTED_MODULE_32__.captureException(err);
      this.setState({
        eventError: true,
        loading: false,
        loadingEvent: false
      });
    }
  }

  getCurrentRouteInfo(group) {
    const {
      routes,
      organization
    } = this.props;
    const {
      event
    } = this.state; // All the routes under /organizations/:orgId/issues/:groupId have a defined props

    const {
      currentTab,
      isEventRoute
    } = routes[routes.length - 1].props;
    const baseUrl = isEventRoute && event ? `/organizations/${organization.slug}/issues/${group.id}/events/${event.id}/` : `/organizations/${organization.slug}/issues/${group.id}/`;
    return {
      currentTab,
      baseUrl
    };
  }

  updateReprocessingProgress() {
    const hasReprocessingV2Feature = this.hasReprocessingV2Feature();

    if (!hasReprocessingV2Feature) {
      return;
    }

    if (this.refetchInterval) {
      window.clearInterval(this.refetchInterval);
    }

    this.refetchInterval = window.setInterval(this.refetchGroup, 30000);
  }

  hasReprocessingV2Feature() {
    var _organization$feature;

    const {
      organization
    } = this.props;
    return (_organization$feature = organization.features) === null || _organization$feature === void 0 ? void 0 : _organization$feature.includes('reprocessing-v2');
  }

  getReprocessingNewRoute(data) {
    const {
      routes,
      location,
      params
    } = this.props;
    const {
      groupId
    } = params;
    const {
      id: nextGroupId
    } = data;
    const hasReprocessingV2Feature = this.hasReprocessingV2Feature();
    const reprocessingStatus = (0,_utils__WEBPACK_IMPORTED_MODULE_31__.getGroupReprocessingStatus)(data);
    const {
      currentTab,
      baseUrl
    } = this.getCurrentRouteInfo(data);

    if (groupId !== nextGroupId) {
      if (hasReprocessingV2Feature) {
        // Redirects to the Activities tab
        if (reprocessingStatus === _utils__WEBPACK_IMPORTED_MODULE_31__.ReprocessingStatus.REPROCESSED_AND_HASNT_EVENT && currentTab !== _types__WEBPACK_IMPORTED_MODULE_30__.Tab.ACTIVITY) {
          return {
            pathname: `${baseUrl}${_types__WEBPACK_IMPORTED_MODULE_30__.Tab.ACTIVITY}/`,
            query: { ...params,
              groupId: nextGroupId
            }
          };
        }
      }

      return (0,sentry_utils_recreateRoute__WEBPACK_IMPORTED_MODULE_25__["default"])('', {
        routes,
        location,
        params: { ...params,
          groupId: nextGroupId
        }
      });
    }

    if (hasReprocessingV2Feature) {
      if (reprocessingStatus === _utils__WEBPACK_IMPORTED_MODULE_31__.ReprocessingStatus.REPROCESSING && currentTab !== _types__WEBPACK_IMPORTED_MODULE_30__.Tab.DETAILS) {
        return {
          pathname: baseUrl,
          query: params
        };
      }

      if (reprocessingStatus === _utils__WEBPACK_IMPORTED_MODULE_31__.ReprocessingStatus.REPROCESSED_AND_HASNT_EVENT && currentTab !== _types__WEBPACK_IMPORTED_MODULE_30__.Tab.ACTIVITY && currentTab !== _types__WEBPACK_IMPORTED_MODULE_30__.Tab.USER_FEEDBACK) {
        return {
          pathname: `${baseUrl}${_types__WEBPACK_IMPORTED_MODULE_30__.Tab.ACTIVITY}/`,
          query: params
        };
      }
    }

    return undefined;
  }

  getGroupQuery() {
    const {
      environments
    } = this.props; // Note, we do not want to include the environment key at all if there are no environments

    const query = { ...(environments ? {
        environment: environments
      } : {}),
      expand: 'inbox',
      collapse: 'release'
    };
    return query;
  }

  getFetchDataRequestErrorType(status) {
    if (!status) {
      return null;
    }

    if (status === 404) {
      return _constants__WEBPACK_IMPORTED_MODULE_27__.ERROR_TYPES.GROUP_NOT_FOUND;
    }

    if (status === 403) {
      return _constants__WEBPACK_IMPORTED_MODULE_27__.ERROR_TYPES.MISSING_MEMBERSHIP;
    }

    return null;
  }

  handleRequestError(error) {
    _sentry_react__WEBPACK_IMPORTED_MODULE_32__.captureException(error);
    const errorType = this.getFetchDataRequestErrorType(error === null || error === void 0 ? void 0 : error.status);
    this.setState({
      loadingGroup: false,
      loading: false,
      error: true,
      errorType
    });
  }

  async fetchGroupReleases() {
    const {
      api
    } = this.props;
    const releases = await api.requestPromise(this.groupReleaseEndpoint);
    sentry_stores_groupStore__WEBPACK_IMPORTED_MODULE_15__["default"].onPopulateReleases(this.props.params.groupId, releases);
  }

  async fetchReplaysCount() {
    const {
      api,
      location,
      organization,
      params
    } = this.props;
    const {
      groupId
    } = params;
    this.setState({
      loadingReplaysCount: true
    });
    const eventView = sentry_utils_discover_eventView__WEBPACK_IMPORTED_MODULE_21__["default"].fromSavedQuery({
      id: '',
      name: `Replays in issue ${groupId}`,
      version: 2,
      fields: ['count()'],
      query: `issue.id:${groupId}`,
      projects: []
    });

    try {
      const [data] = await (0,sentry_utils_discover_genericDiscoverQuery__WEBPACK_IMPORTED_MODULE_22__.doDiscoverQuery)(api, `/organizations/${organization.slug}/events/`, eventView.getEventsAPIPayload(location));
      const replaysCount = data.data[0]['count()'].toString();
      this.setState({
        replaysCount: parseInt(replaysCount, 10),
        loadingReplaysCount: false
      });
    } catch (err) {
      this.setState({
        loadingReplaysCount: false
      });
    }
  }

  async fetchData() {
    let trackView = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : false;
    const {
      api,
      isGlobalSelectionReady,
      params
    } = this.props; // Need to wait for global selection store to be ready before making request

    if (!isGlobalSelectionReady) {
      return;
    }

    try {
      const eventPromise = this.canLoadEventEarly(this.props) ? this.getEvent() : undefined;
      const groupPromise = await api.requestPromise(this.groupDetailsEndpoint, {
        query: this.getGroupQuery()
      });
      const [data] = await Promise.all([groupPromise, eventPromise]);
      this.fetchGroupReleases();
      const reprocessingNewRoute = this.getReprocessingNewRoute(data);

      if (reprocessingNewRoute) {
        react_router__WEBPACK_IMPORTED_MODULE_7__.browserHistory.push(reprocessingNewRoute);
        return;
      }

      const project = data.project;
      (0,_utils__WEBPACK_IMPORTED_MODULE_31__.markEventSeen)(api, params.orgId, project.slug, params.groupId);

      if (!project) {
        _sentry_react__WEBPACK_IMPORTED_MODULE_32__.withScope(() => {
          _sentry_react__WEBPACK_IMPORTED_MODULE_32__.captureException(new Error('Project not found'));
        });
      } else {
        const locationWithProject = { ...this.props.location
        };

        if (locationWithProject.query.project === undefined && locationWithProject.query._allp === undefined) {
          // We use _allp as a temporary measure to know they came from the
          // issue list page with no project selected (all projects included in
          // filter).
          //
          // If it is not defined, we add the locked project id to the URL
          // (this is because if someone navigates directly to an issue on
          // single-project priveleges, then goes back - they were getting
          // assigned to the first project).
          //
          // If it is defined, we do not so that our back button will bring us
          // to the issue list page with no project selected instead of the
          // locked project.
          locationWithProject.query = { ...locationWithProject.query,
            project: project.id
          };
        } // We delete _allp from the URL to keep the hack a bit cleaner, but
        // this is not an ideal solution and will ultimately be replaced with
        // something smarter.


        delete locationWithProject.query._allp;
        react_router__WEBPACK_IMPORTED_MODULE_7__.browserHistory.replace(locationWithProject);
      }

      this.setState({
        project,
        loadingGroup: false
      });
      sentry_stores_groupStore__WEBPACK_IMPORTED_MODULE_15__["default"].loadInitialData([data]);

      if (trackView) {
        this.trackView(project);
      }
    } catch (error) {
      this.handleRequestError(error);
    }
  }

  onGroupChange(itemIds) {
    const id = this.props.params.groupId;

    if (itemIds.has(id)) {
      const group = sentry_stores_groupStore__WEBPACK_IMPORTED_MODULE_15__["default"].get(id);

      if (group) {
        // TODO(ts) This needs a better approach. issueActions is splicing attributes onto
        // group objects to cheat here.
        if (group.stale) {
          this.fetchData();
          return;
        }

        this.setState({
          group
        });
      }
    }
  }

  getTitle() {
    const {
      organization
    } = this.props;
    const {
      group
    } = this.state;
    const defaultTitle = 'Sentry';

    if (!group) {
      return defaultTitle;
    }

    const {
      title
    } = (0,sentry_utils_events__WEBPACK_IMPORTED_MODULE_23__.getTitle)(group, organization === null || organization === void 0 ? void 0 : organization.features);
    const message = (0,sentry_utils_events__WEBPACK_IMPORTED_MODULE_23__.getMessage)(group);
    const {
      project
    } = group;
    const eventDetails = `${organization.slug} - ${project.slug}`;

    if (title && message) {
      return `${title}: ${message} - ${eventDetails}`;
    }

    return `${title || message || defaultTitle} - ${eventDetails}`;
  }

  renderError() {
    const {
      projects,
      location
    } = this.props;
    const projectId = location.query.project;
    const project = projects.find(proj => proj.id === projectId);

    switch (this.state.errorType) {
      case _constants__WEBPACK_IMPORTED_MODULE_27__.ERROR_TYPES.GROUP_NOT_FOUND:
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_33__.jsx)(StyledLoadingError, {
          message: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('The issue you were looking for was not found.')
        });

      case _constants__WEBPACK_IMPORTED_MODULE_27__.ERROR_TYPES.MISSING_MEMBERSHIP:
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_33__.jsx)(sentry_components_projects_missingProjectMembership__WEBPACK_IMPORTED_MODULE_11__["default"], {
          organization: this.props.organization,
          project: project
        });

      default:
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_33__.jsx)(StyledLoadingError, {
          onRetry: this.remountComponent
        });
    }
  }

  renderContent(project, group) {
    const {
      children,
      environments,
      organization
    } = this.props;
    const {
      loadingEvent,
      eventError,
      event,
      replaysCount
    } = this.state;
    const {
      currentTab,
      baseUrl
    } = this.getCurrentRouteInfo(group);
    const groupReprocessingStatus = (0,_utils__WEBPACK_IMPORTED_MODULE_31__.getGroupReprocessingStatus)(group);
    let childProps = {
      environments,
      group,
      project
    };

    if (currentTab === _types__WEBPACK_IMPORTED_MODULE_30__.Tab.DETAILS) {
      if (group.id !== (event === null || event === void 0 ? void 0 : event.groupID) && !eventError) {
        // if user pastes only the event id into the url, but it's from another group, redirect to correct group/event
        const redirectUrl = `/organizations/${organization.slug}/issues/${event === null || event === void 0 ? void 0 : event.groupID}/events/${event === null || event === void 0 ? void 0 : event.id}/`;
        this.props.router.push(redirectUrl);
      } else {
        childProps = { ...childProps,
          event,
          loadingEvent,
          eventError,
          groupReprocessingStatus,
          onRetry: () => this.remountComponent()
        };
      }
    }

    if (currentTab === _types__WEBPACK_IMPORTED_MODULE_30__.Tab.TAGS) {
      childProps = { ...childProps,
        event,
        baseUrl
      };
    }

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_33__.jsxs)(react__WEBPACK_IMPORTED_MODULE_6__.Fragment, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_33__.jsx)(_header__WEBPACK_IMPORTED_MODULE_28__["default"], {
        groupReprocessingStatus: groupReprocessingStatus,
        project: project,
        event: event,
        group: group,
        replaysCount: replaysCount,
        currentTab: currentTab,
        baseUrl: baseUrl
      }), /*#__PURE__*/(0,react__WEBPACK_IMPORTED_MODULE_6__.isValidElement)(children) ? /*#__PURE__*/(0,react__WEBPACK_IMPORTED_MODULE_6__.cloneElement)(children, childProps) : children]
    });
  }

  renderPageContent() {
    var _project$slug;

    const {
      error: isError,
      group,
      project,
      loading
    } = this.state;
    const isLoading = loading || !group && !isError;

    if (isLoading) {
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_33__.jsx)(sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_9__["default"], {});
    }

    if (isError) {
      return this.renderError();
    }

    const {
      organization
    } = this.props;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_33__.jsx)(sentry_utils_projects__WEBPACK_IMPORTED_MODULE_24__["default"], {
      orgId: organization.slug,
      slugs: [(_project$slug = project === null || project === void 0 ? void 0 : project.slug) !== null && _project$slug !== void 0 ? _project$slug : ''],
      "data-test-id": "group-projects-container",
      children: _ref => {
        let {
          projects,
          initiallyLoaded,
          fetchError
        } = _ref;
        return initiallyLoaded ? fetchError ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_33__.jsx)(StyledLoadingError, {
          message: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('Error loading the specified project')
        }) : // TODO(ts): Update renderContent function to deal with empty group
        this.renderContent(projects[0], group) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_33__.jsx)(sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_9__["default"], {});
      }
    });
  }

  render() {
    var _group$tags;

    const {
      project,
      group
    } = this.state;
    const {
      organization
    } = this.props;
    const isSampleError = group === null || group === void 0 ? void 0 : (_group$tags = group.tags) === null || _group$tags === void 0 ? void 0 : _group$tags.some(tag => tag.key === 'sample_event');
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_33__.jsxs)(react__WEBPACK_IMPORTED_MODULE_6__.Fragment, {
      children: [isSampleError && project && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_33__.jsx)(_sampleEventAlert__WEBPACK_IMPORTED_MODULE_29__["default"], {
        project: project,
        organization: organization
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_33__.jsx)(sentry_components_sentryDocumentTitle__WEBPACK_IMPORTED_MODULE_12__["default"], {
        noSuffix: true,
        title: this.getTitle(),
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_33__.jsx)(sentry_components_organizations_pageFilters_container__WEBPACK_IMPORTED_MODULE_10__["default"], {
          skipLoadLastUsed: true,
          forceProject: project,
          shouldForceProject: true,
          children: this.renderPageContent()
        })
      })]
    });
  }

}

GroupDetails.displayName = "GroupDetails";

(0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(GroupDetails, "childContextTypes", {
  group: sentry_sentryTypes__WEBPACK_IMPORTED_MODULE_14__["default"].Group,
  location: prop_types__WEBPACK_IMPORTED_MODULE_34__.object
});

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_26__["default"])(_sentry_react__WEBPACK_IMPORTED_MODULE_35__.withProfiler(GroupDetails)));

const StyledLoadingError = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_loadingError__WEBPACK_IMPORTED_MODULE_8__["default"],  true ? {
  target: "eyu73lm0"
} : 0)("margin:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_16__["default"])(2), ";" + ( true ? "" : 0));

/***/ }),

/***/ "./app/views/organizationGroupDetails/header.tsx":
/*!*******************************************************!*\
  !*** ./app/views/organizationGroupDetails/header.tsx ***!
  \*******************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
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
/* harmony import */ var lodash_omit__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! lodash/omit */ "../node_modules/lodash/omit.js");
/* harmony import */ var lodash_omit__WEBPACK_IMPORTED_MODULE_6___default = /*#__PURE__*/__webpack_require__.n(lodash_omit__WEBPACK_IMPORTED_MODULE_6__);
/* harmony import */ var sentry_actionCreators_members__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/actionCreators/members */ "./app/actionCreators/members.tsx");
/* harmony import */ var sentry_components_acl_feature__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/acl/feature */ "./app/components/acl/feature.tsx");
/* harmony import */ var sentry_components_assigneeSelector__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/assigneeSelector */ "./app/components/assigneeSelector.tsx");
/* harmony import */ var sentry_components_assistant_guideAnchor__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/assistant/guideAnchor */ "./app/components/assistant/guideAnchor.tsx");
/* harmony import */ var sentry_components_badge__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/components/badge */ "./app/components/badge.tsx");
/* harmony import */ var sentry_components_breadcrumbs__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/components/breadcrumbs */ "./app/components/breadcrumbs.tsx");
/* harmony import */ var sentry_components_count__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/components/count */ "./app/components/count.tsx");
/* harmony import */ var sentry_components_eventOrGroupTitle__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/components/eventOrGroupTitle */ "./app/components/eventOrGroupTitle.tsx");
/* harmony import */ var sentry_components_events_errorLevel__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/components/events/errorLevel */ "./app/components/events/errorLevel.tsx");
/* harmony import */ var sentry_components_events_eventAnnotation__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/components/events/eventAnnotation */ "./app/components/events/eventAnnotation.tsx");
/* harmony import */ var sentry_components_events_eventMessage__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! sentry/components/events/eventMessage */ "./app/components/events/eventMessage.tsx");
/* harmony import */ var sentry_components_group_inboxBadges_inboxReason__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! sentry/components/group/inboxBadges/inboxReason */ "./app/components/group/inboxBadges/inboxReason.tsx");
/* harmony import */ var sentry_components_group_inboxBadges_unhandledTag__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! sentry/components/group/inboxBadges/unhandledTag */ "./app/components/group/inboxBadges/unhandledTag.tsx");
/* harmony import */ var sentry_components_idBadge_projectBadge__WEBPACK_IMPORTED_MODULE_20__ = __webpack_require__(/*! sentry/components/idBadge/projectBadge */ "./app/components/idBadge/projectBadge.tsx");
/* harmony import */ var sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_21__ = __webpack_require__(/*! sentry/components/layouts/thirds */ "./app/components/layouts/thirds.tsx");
/* harmony import */ var sentry_components_links_link__WEBPACK_IMPORTED_MODULE_22__ = __webpack_require__(/*! sentry/components/links/link */ "./app/components/links/link.tsx");
/* harmony import */ var sentry_components_links_listLink__WEBPACK_IMPORTED_MODULE_23__ = __webpack_require__(/*! sentry/components/links/listLink */ "./app/components/links/listLink.tsx");
/* harmony import */ var sentry_components_navTabs__WEBPACK_IMPORTED_MODULE_24__ = __webpack_require__(/*! sentry/components/navTabs */ "./app/components/navTabs.tsx");
/* harmony import */ var sentry_components_replays_replaysFeatureBadge__WEBPACK_IMPORTED_MODULE_25__ = __webpack_require__(/*! sentry/components/replays/replaysFeatureBadge */ "./app/components/replays/replaysFeatureBadge.tsx");
/* harmony import */ var sentry_components_seenByList__WEBPACK_IMPORTED_MODULE_26__ = __webpack_require__(/*! sentry/components/seenByList */ "./app/components/seenByList.tsx");
/* harmony import */ var sentry_components_shortId__WEBPACK_IMPORTED_MODULE_27__ = __webpack_require__(/*! sentry/components/shortId */ "./app/components/shortId.tsx");
/* harmony import */ var sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_28__ = __webpack_require__(/*! sentry/components/tooltip */ "./app/components/tooltip.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_29__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_30__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_31__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_32__ = __webpack_require__(/*! sentry/utils/analytics/trackAdvancedAnalyticsEvent */ "./app/utils/analytics/trackAdvancedAnalyticsEvent.tsx");
/* harmony import */ var sentry_utils_dates__WEBPACK_IMPORTED_MODULE_33__ = __webpack_require__(/*! sentry/utils/dates */ "./app/utils/dates.tsx");
/* harmony import */ var sentry_utils_events__WEBPACK_IMPORTED_MODULE_34__ = __webpack_require__(/*! sentry/utils/events */ "./app/utils/events.tsx");
/* harmony import */ var sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_35__ = __webpack_require__(/*! sentry/utils/withApi */ "./app/utils/withApi.tsx");
/* harmony import */ var sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_36__ = __webpack_require__(/*! sentry/utils/withOrganization */ "./app/utils/withOrganization.tsx");
/* harmony import */ var _actions__WEBPACK_IMPORTED_MODULE_37__ = __webpack_require__(/*! ./actions */ "./app/views/organizationGroupDetails/actions/index.tsx");
/* harmony import */ var _types__WEBPACK_IMPORTED_MODULE_38__ = __webpack_require__(/*! ./types */ "./app/views/organizationGroupDetails/types.tsx");
/* harmony import */ var _unhandledTag__WEBPACK_IMPORTED_MODULE_39__ = __webpack_require__(/*! ./unhandledTag */ "./app/views/organizationGroupDetails/unhandledTag.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_40__ = __webpack_require__(/*! ./utils */ "./app/views/organizationGroupDetails/utils.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_41__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");





function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }

 // eslint-disable-next-line no-restricted-imports








































class GroupHeader extends react__WEBPACK_IMPORTED_MODULE_4__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", {});

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "trackAssign", () => {
      const {
        group,
        project,
        organization,
        location
      } = this.props;
      const {
        alert_date,
        alert_rule_id,
        alert_type
      } = location.query;
      (0,sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_32__["default"])('issue_details.action_clicked', {
        organization,
        project_id: parseInt(project.id, 10),
        group_id: parseInt(group.id, 10),
        action_type: 'assign',
        // Alert properties track if the user came from email/slack alerts
        alert_date: typeof alert_date === 'string' ? (0,sentry_utils_dates__WEBPACK_IMPORTED_MODULE_33__.getUtcDateString)(Number(alert_date)) : undefined,
        alert_rule_id: typeof alert_rule_id === 'string' ? alert_rule_id : undefined,
        alert_type: typeof alert_type === 'string' ? alert_type : undefined
      });
    });
  }

  componentDidMount() {
    const {
      group,
      api,
      organization
    } = this.props;
    const {
      project
    } = group;
    (0,sentry_actionCreators_members__WEBPACK_IMPORTED_MODULE_7__.fetchOrgMembers)(api, organization.slug, [project.id]).then(memberList => {
      const users = memberList.map(member => member.user);
      this.setState({
        memberList: users
      });
    });
  }

  getDisabledTabs() {
    const {
      organization
    } = this.props;
    const hasReprocessingV2Feature = organization.features.includes('reprocessing-v2');

    if (!hasReprocessingV2Feature) {
      return [];
    }

    const {
      groupReprocessingStatus
    } = this.props;

    if (groupReprocessingStatus === _utils__WEBPACK_IMPORTED_MODULE_40__.ReprocessingStatus.REPROCESSING) {
      return [_types__WEBPACK_IMPORTED_MODULE_38__.Tab.ACTIVITY, _types__WEBPACK_IMPORTED_MODULE_38__.Tab.USER_FEEDBACK, _types__WEBPACK_IMPORTED_MODULE_38__.Tab.ATTACHMENTS, _types__WEBPACK_IMPORTED_MODULE_38__.Tab.EVENTS, _types__WEBPACK_IMPORTED_MODULE_38__.Tab.MERGED, _types__WEBPACK_IMPORTED_MODULE_38__.Tab.GROUPING, _types__WEBPACK_IMPORTED_MODULE_38__.Tab.SIMILAR_ISSUES, _types__WEBPACK_IMPORTED_MODULE_38__.Tab.TAGS];
    }

    if (groupReprocessingStatus === _utils__WEBPACK_IMPORTED_MODULE_40__.ReprocessingStatus.REPROCESSED_AND_HASNT_EVENT) {
      return [_types__WEBPACK_IMPORTED_MODULE_38__.Tab.DETAILS, _types__WEBPACK_IMPORTED_MODULE_38__.Tab.ATTACHMENTS, _types__WEBPACK_IMPORTED_MODULE_38__.Tab.EVENTS, _types__WEBPACK_IMPORTED_MODULE_38__.Tab.MERGED, _types__WEBPACK_IMPORTED_MODULE_38__.Tab.GROUPING, _types__WEBPACK_IMPORTED_MODULE_38__.Tab.SIMILAR_ISSUES, _types__WEBPACK_IMPORTED_MODULE_38__.Tab.TAGS, _types__WEBPACK_IMPORTED_MODULE_38__.Tab.USER_FEEDBACK];
    }

    return [];
  }

  render() {
    const {
      project,
      group,
      currentTab,
      baseUrl,
      event,
      organization,
      location,
      replaysCount
    } = this.props;
    const projectFeatures = new Set(project ? project.features : []);
    const organizationFeatures = new Set(organization ? organization.features : []);
    const userCount = group.userCount;
    const hasGroupingTreeUI = organizationFeatures.has('grouping-tree-ui');
    const hasSimilarView = projectFeatures.has('similarity-view');
    const hasEventAttachments = organizationFeatures.has('event-attachments');
    let className = 'group-detail';

    if (group.hasSeen) {
      className += ' hasSeen';
    }

    if (group.status === 'resolved') {
      className += ' isResolved';
    }

    const {
      memberList
    } = this.state;
    const message = (0,sentry_utils_events__WEBPACK_IMPORTED_MODULE_34__.getMessage)(group);
    const searchTermWithoutQuery = lodash_omit__WEBPACK_IMPORTED_MODULE_6___default()(location.query, 'query');
    const eventRouteToObject = {
      pathname: `${baseUrl}events/`,
      query: searchTermWithoutQuery
    };
    const disabledTabs = this.getDisabledTabs();
    const disableActions = !!disabledTabs.length;

    const shortIdBreadCrumb = group.shortId && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_41__.jsx)(sentry_components_assistant_guideAnchor__WEBPACK_IMPORTED_MODULE_10__["default"], {
      target: "issue_number",
      position: "bottom",
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_41__.jsxs)(IssueBreadcrumbWrapper, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_41__.jsx)(BreadcrumbProjectBadge, {
          project: project,
          avatarSize: 16,
          hideName: true,
          avatarProps: {
            hasTooltip: true,
            tooltip: project.slug
          }
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_41__.jsx)(StyledTooltip, {
          className: "help-link",
          title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_30__.t)('This identifier is unique across your organization, and can be used to reference an issue in various places, like commit messages.'),
          position: "bottom",
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_41__.jsx)(StyledShortId, {
            shortId: group.shortId
          })
        })]
      })
    });

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_41__.jsx)(sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_21__.Header, {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_41__.jsxs)("div", {
        className: className,
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_41__.jsx)(StyledBreadcrumbs, {
          crumbs: [{
            label: 'Issues',
            to: `/organizations/${organization.slug}/issues/${location.search}`
          }, {
            label: shortIdBreadCrumb
          }]
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_41__.jsxs)("div", {
          className: "row",
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_41__.jsxs)("div", {
            className: "col-sm-7",
            children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_41__.jsxs)(TitleWrapper, {
              children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_41__.jsx)("h3", {
                children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_41__.jsx)(sentry_components_eventOrGroupTitle__WEBPACK_IMPORTED_MODULE_14__["default"], {
                  hasGuideAnchor: true,
                  data: group
                })
              }), group.inbox && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_41__.jsx)(InboxReasonWrapper, {
                children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_41__.jsx)(sentry_components_group_inboxBadges_inboxReason__WEBPACK_IMPORTED_MODULE_18__["default"], {
                  inbox: group.inbox,
                  fontSize: "md"
                })
              })]
            }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_41__.jsxs)(StyledTagAndMessageWrapper, {
              children: [group.level && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_41__.jsx)(sentry_components_events_errorLevel__WEBPACK_IMPORTED_MODULE_15__["default"], {
                level: group.level,
                size: "11px"
              }), group.isUnhandled && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_41__.jsx)(sentry_components_group_inboxBadges_unhandledTag__WEBPACK_IMPORTED_MODULE_19__["default"], {}), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_41__.jsx)(sentry_components_events_eventMessage__WEBPACK_IMPORTED_MODULE_17__["default"], {
                message: message,
                annotations: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_41__.jsx)(react__WEBPACK_IMPORTED_MODULE_4__.Fragment, {
                  children: group.logger && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_41__.jsx)(EventAnnotationWithSpace, {
                    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_41__.jsx)(sentry_components_links_link__WEBPACK_IMPORTED_MODULE_22__["default"], {
                      to: {
                        pathname: `/organizations/${organization.slug}/issues/`,
                        query: {
                          query: 'logger:' + group.logger
                        }
                      },
                      children: group.logger
                    })
                  })
                })
              })]
            })]
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_41__.jsxs)(StatsWrapper, {
            children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_41__.jsxs)("div", {
              className: "count align-right m-l-1",
              children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_41__.jsx)("h6", {
                className: "nav-header",
                children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_30__.t)('Events')
              }), disableActions ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_41__.jsx)(sentry_components_count__WEBPACK_IMPORTED_MODULE_13__["default"], {
                className: "count",
                value: group.count
              }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_41__.jsx)(sentry_components_links_link__WEBPACK_IMPORTED_MODULE_22__["default"], {
                to: eventRouteToObject,
                children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_41__.jsx)(sentry_components_count__WEBPACK_IMPORTED_MODULE_13__["default"], {
                  className: "count",
                  value: group.count
                })
              })]
            }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_41__.jsxs)("div", {
              className: "count align-right m-l-1",
              children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_41__.jsx)("h6", {
                className: "nav-header",
                children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_30__.t)('Users')
              }), userCount !== 0 ? disableActions ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_41__.jsx)(sentry_components_count__WEBPACK_IMPORTED_MODULE_13__["default"], {
                className: "count",
                value: userCount
              }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_41__.jsx)(sentry_components_links_link__WEBPACK_IMPORTED_MODULE_22__["default"], {
                to: `${baseUrl}tags/user/${location.search}`,
                children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_41__.jsx)(sentry_components_count__WEBPACK_IMPORTED_MODULE_13__["default"], {
                  className: "count",
                  value: userCount
                })
              }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_41__.jsx)("span", {
                children: "0"
              })]
            }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_41__.jsxs)("div", {
              className: "assigned-to m-l-1",
              children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_41__.jsx)("h6", {
                className: "nav-header",
                children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_30__.t)('Assignee')
              }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_41__.jsx)(sentry_components_assigneeSelector__WEBPACK_IMPORTED_MODULE_9__["default"], {
                id: group.id,
                memberList: memberList,
                disabled: disableActions,
                onAssign: this.trackAssign
              })]
            })]
          })]
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_41__.jsx)(sentry_components_seenByList__WEBPACK_IMPORTED_MODULE_26__["default"], {
          seenBy: group.seenBy,
          iconTooltip: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_30__.t)('People who have viewed this issue')
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_41__.jsx)(_actions__WEBPACK_IMPORTED_MODULE_37__["default"], {
          group: group,
          project: project,
          disabled: disableActions,
          event: event,
          query: location.query
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_41__.jsxs)(sentry_components_navTabs__WEBPACK_IMPORTED_MODULE_24__["default"], {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_41__.jsx)(sentry_components_links_listLink__WEBPACK_IMPORTED_MODULE_23__["default"], {
            to: `${baseUrl}${location.search}`,
            isActive: () => currentTab === _types__WEBPACK_IMPORTED_MODULE_38__.Tab.DETAILS,
            disabled: disabledTabs.includes(_types__WEBPACK_IMPORTED_MODULE_38__.Tab.DETAILS),
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_30__.t)('Details')
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_41__.jsxs)(StyledListLink, {
            to: `${baseUrl}activity/${location.search}`,
            isActive: () => currentTab === _types__WEBPACK_IMPORTED_MODULE_38__.Tab.ACTIVITY,
            disabled: disabledTabs.includes(_types__WEBPACK_IMPORTED_MODULE_38__.Tab.ACTIVITY),
            children: [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_30__.t)('Activity'), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_41__.jsxs)(sentry_components_badge__WEBPACK_IMPORTED_MODULE_11__["default"], {
              children: [group.numComments, (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_41__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_29__.IconChat, {
                size: "xs"
              })]
            })]
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_41__.jsxs)(StyledListLink, {
            to: `${baseUrl}feedback/${location.search}`,
            isActive: () => currentTab === _types__WEBPACK_IMPORTED_MODULE_38__.Tab.USER_FEEDBACK,
            disabled: disabledTabs.includes(_types__WEBPACK_IMPORTED_MODULE_38__.Tab.USER_FEEDBACK),
            children: [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_30__.t)('User Feedback'), " ", (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_41__.jsx)(sentry_components_badge__WEBPACK_IMPORTED_MODULE_11__["default"], {
              text: group.userReportCount
            })]
          }), hasEventAttachments && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_41__.jsx)(sentry_components_links_listLink__WEBPACK_IMPORTED_MODULE_23__["default"], {
            to: `${baseUrl}attachments/${location.search}`,
            isActive: () => currentTab === _types__WEBPACK_IMPORTED_MODULE_38__.Tab.ATTACHMENTS,
            disabled: disabledTabs.includes(_types__WEBPACK_IMPORTED_MODULE_38__.Tab.ATTACHMENTS),
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_30__.t)('Attachments')
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_41__.jsx)(sentry_components_links_listLink__WEBPACK_IMPORTED_MODULE_23__["default"], {
            to: `${baseUrl}tags/${location.search}`,
            isActive: () => currentTab === _types__WEBPACK_IMPORTED_MODULE_38__.Tab.TAGS,
            disabled: disabledTabs.includes(_types__WEBPACK_IMPORTED_MODULE_38__.Tab.TAGS),
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_30__.t)('Tags')
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_41__.jsx)(sentry_components_links_listLink__WEBPACK_IMPORTED_MODULE_23__["default"], {
            to: eventRouteToObject,
            isActive: () => currentTab === _types__WEBPACK_IMPORTED_MODULE_38__.Tab.EVENTS,
            disabled: disabledTabs.includes(_types__WEBPACK_IMPORTED_MODULE_38__.Tab.EVENTS),
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_30__.t)('Events')
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_41__.jsx)(sentry_components_links_listLink__WEBPACK_IMPORTED_MODULE_23__["default"], {
            to: `${baseUrl}merged/${location.search}`,
            isActive: () => currentTab === _types__WEBPACK_IMPORTED_MODULE_38__.Tab.MERGED,
            disabled: disabledTabs.includes(_types__WEBPACK_IMPORTED_MODULE_38__.Tab.MERGED),
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_30__.t)('Merged Issues')
          }), hasGroupingTreeUI && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_41__.jsx)(sentry_components_links_listLink__WEBPACK_IMPORTED_MODULE_23__["default"], {
            to: `${baseUrl}grouping/${location.search}`,
            isActive: () => currentTab === _types__WEBPACK_IMPORTED_MODULE_38__.Tab.GROUPING,
            disabled: disabledTabs.includes(_types__WEBPACK_IMPORTED_MODULE_38__.Tab.GROUPING),
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_30__.t)('Grouping')
          }), hasSimilarView && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_41__.jsx)(sentry_components_links_listLink__WEBPACK_IMPORTED_MODULE_23__["default"], {
            to: `${baseUrl}similar/${location.search}`,
            isActive: () => currentTab === _types__WEBPACK_IMPORTED_MODULE_38__.Tab.SIMILAR_ISSUES,
            disabled: disabledTabs.includes(_types__WEBPACK_IMPORTED_MODULE_38__.Tab.SIMILAR_ISSUES),
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_30__.t)('Similar Issues')
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_41__.jsx)(sentry_components_acl_feature__WEBPACK_IMPORTED_MODULE_8__["default"], {
            features: ['session-replay-ui'],
            organization: organization,
            children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_41__.jsxs)(sentry_components_links_listLink__WEBPACK_IMPORTED_MODULE_23__["default"], {
              to: `${baseUrl}replays/${location.search}`,
              isActive: () => currentTab === _types__WEBPACK_IMPORTED_MODULE_38__.Tab.REPLAYS,
              children: [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_30__.t)('Replays'), " ", (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_41__.jsx)(sentry_components_badge__WEBPACK_IMPORTED_MODULE_11__["default"], {
                text: replaysCount !== null && replaysCount !== void 0 ? replaysCount : ''
              }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_41__.jsx)(sentry_components_replays_replaysFeatureBadge__WEBPACK_IMPORTED_MODULE_25__["default"], {
                noTooltip: true
              })]
            })
          })]
        })]
      })
    });
  }

}

GroupHeader.displayName = "GroupHeader";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_35__["default"])((0,react_router__WEBPACK_IMPORTED_MODULE_5__.withRouter)((0,sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_36__["default"])(GroupHeader))));

const TitleWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e1ptdvq011"
} : 0)( true ? {
  name: "1npn4lq",
  styles: "display:flex;line-height:24px"
} : 0);

const StyledBreadcrumbs = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_breadcrumbs__WEBPACK_IMPORTED_MODULE_12__["default"],  true ? {
  target: "e1ptdvq010"
} : 0)("margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_31__["default"])(2), ";" + ( true ? "" : 0));

const IssueBreadcrumbWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e1ptdvq09"
} : 0)( true ? {
  name: "s5xdrg",
  styles: "display:flex;align-items:center"
} : 0);

const StyledTooltip = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_28__["default"],  true ? {
  target: "e1ptdvq08"
} : 0)( true ? {
  name: "zjik7",
  styles: "display:flex"
} : 0);

const StyledShortId = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_shortId__WEBPACK_IMPORTED_MODULE_27__["default"],  true ? {
  target: "e1ptdvq07"
} : 0)("font-family:", p => p.theme.text.family, ";font-size:", p => p.theme.fontSizeMedium, ";" + ( true ? "" : 0));

const StatsWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e1ptdvq06"
} : 0)("display:grid;justify-content:flex-end;grid-template-columns:repeat(3, min-content);gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_31__["default"])(3), ";margin-right:15px;" + ( true ? "" : 0));

const InboxReasonWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e1ptdvq05"
} : 0)("margin-left:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_31__["default"])(1), ";" + ( true ? "" : 0));

const StyledTagAndMessageWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(_unhandledTag__WEBPACK_IMPORTED_MODULE_39__.TagAndMessageWrapper,  true ? {
  target: "e1ptdvq04"
} : 0)("display:grid;grid-auto-flow:column;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_31__["default"])(1), ";justify-content:flex-start;line-height:1.2;@media (max-width: ", p => p.theme.breakpoints.small, "){margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_31__["default"])(2), ";}" + ( true ? "" : 0));

const StyledListLink = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_links_listLink__WEBPACK_IMPORTED_MODULE_23__["default"],  true ? {
  target: "e1ptdvq03"
} : 0)("svg{margin-left:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_31__["default"])(0.5), ";margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_31__["default"])(0.25), ";vertical-align:middle;}" + ( true ? "" : 0));

const StyledProjectBadge = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_idBadge_projectBadge__WEBPACK_IMPORTED_MODULE_20__["default"],  true ? {
  target: "e1ptdvq02"
} : 0)( true ? {
  name: "ozd7xs",
  styles: "flex-shrink:0"
} : 0);

const BreadcrumbProjectBadge = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(StyledProjectBadge,  true ? {
  target: "e1ptdvq01"
} : 0)("margin-right:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_31__["default"])(0.75), ";" + ( true ? "" : 0));

const EventAnnotationWithSpace = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_events_eventAnnotation__WEBPACK_IMPORTED_MODULE_16__["default"],  true ? {
  target: "e1ptdvq00"
} : 0)("margin-left:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_31__["default"])(1), ";" + ( true ? "" : 0));

/***/ }),

/***/ "./app/views/organizationGroupDetails/index.tsx":
/*!******************************************************!*\
  !*** ./app/views/organizationGroupDetails/index.tsx ***!
  \******************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_utils_analytics__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/utils/analytics */ "./app/utils/analytics.tsx");
/* harmony import */ var sentry_utils_useOrganization__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/utils/useOrganization */ "./app/utils/useOrganization.tsx");
/* harmony import */ var sentry_utils_useProjects__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/utils/useProjects */ "./app/utils/useProjects.tsx");
/* harmony import */ var sentry_utils_withPageFilters__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/utils/withPageFilters */ "./app/utils/withPageFilters.tsx");
/* harmony import */ var _groupDetails__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ./groupDetails */ "./app/views/organizationGroupDetails/groupDetails.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");








function OrganizationGroupDetails(_ref) {
  let {
    selection,
    ...props
  } = _ref;
  const organization = (0,sentry_utils_useOrganization__WEBPACK_IMPORTED_MODULE_2__["default"])();
  const {
    projects
  } = (0,sentry_utils_useProjects__WEBPACK_IMPORTED_MODULE_3__["default"])();
  const {
    params
  } = props;
  (0,react__WEBPACK_IMPORTED_MODULE_0__.useEffect)(() => {
    (0,sentry_utils_analytics__WEBPACK_IMPORTED_MODULE_1__.analytics)('issue_page.viewed', {
      group_id: parseInt(params.groupId, 10),
      org_id: parseInt(organization.id, 10)
    });
  }, [organization, params.groupId]);
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(_groupDetails__WEBPACK_IMPORTED_MODULE_5__["default"], {
    environments: selection.environments,
    organization: organization,
    projects: projects,
    ...props
  }, `${params.groupId}-envs:${selection.environments.join(',')}`);
}

OrganizationGroupDetails.displayName = "OrganizationGroupDetails";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withPageFilters__WEBPACK_IMPORTED_MODULE_4__["default"])(OrganizationGroupDetails));

/***/ }),

/***/ "./app/views/organizationGroupDetails/sampleEventAlert.tsx":
/*!*****************************************************************!*\
  !*** ./app/views/organizationGroupDetails/sampleEventAlert.tsx ***!
  \*****************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_pageAlertBar__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/pageAlertBar */ "./app/components/pageAlertBar.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/utils/analytics/trackAdvancedAnalyticsEvent */ "./app/utils/analytics/trackAdvancedAnalyticsEvent.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");










function SampleEventAlert(_ref) {
  let {
    organization,
    project
  } = _ref;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsxs)(sentry_components_pageAlertBar__WEBPACK_IMPORTED_MODULE_2__["default"], {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_3__.IconLightning, {}), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(TextWrapper, {
      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('You are viewing a sample error. Configure Sentry to start viewing real errors.')
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_1__["default"], {
      size: "xs",
      priority: "primary",
      to: `/${organization.slug}/${project.slug}/getting-started/${project.platform || ''}`,
      onClick: () => {
        var _project$id;

        return (0,sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_6__["default"])('growth.sample_error_onboarding_link_clicked', {
          project_id: (_project$id = project.id) === null || _project$id === void 0 ? void 0 : _project$id.toString(),
          organization,
          platform: project.platform
        });
      },
      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Get Started')
    })]
  });
}

SampleEventAlert.displayName = "SampleEventAlert";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (SampleEventAlert);

const TextWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('span',  true ? {
  target: "e1k8ur580"
} : 0)("margin:0 ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_5__["default"])(1), ";" + ( true ? "" : 0));

/***/ }),

/***/ "./app/views/organizationGroupDetails/utils.tsx":
/*!******************************************************!*\
  !*** ./app/views/organizationGroupDetails/utils.tsx ***!
  \******************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "ReprocessingStatus": () => (/* binding */ ReprocessingStatus),
/* harmony export */   "fetchGroupEvent": () => (/* binding */ fetchGroupEvent),
/* harmony export */   "fetchGroupUserReports": () => (/* binding */ fetchGroupUserReports),
/* harmony export */   "getEventEnvironment": () => (/* binding */ getEventEnvironment),
/* harmony export */   "getGroupMostRecentActivity": () => (/* binding */ getGroupMostRecentActivity),
/* harmony export */   "getGroupReprocessingStatus": () => (/* binding */ getGroupReprocessingStatus),
/* harmony export */   "getSubscriptionReason": () => (/* binding */ getSubscriptionReason),
/* harmony export */   "markEventSeen": () => (/* binding */ markEventSeen)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var lodash_orderBy__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! lodash/orderBy */ "../node_modules/lodash/orderBy.js");
/* harmony import */ var lodash_orderBy__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(lodash_orderBy__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var sentry_actionCreators_group__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/actionCreators/group */ "./app/actionCreators/group.tsx");
/* harmony import */ var sentry_api__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/api */ "./app/api.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");







/**
 * Fetches group data and mark as seen
 *
 * @param orgId organization slug
 * @param groupId groupId
 * @param eventId eventId or "latest" or "oldest"
 * @param envNames
 * @param projectId project slug required for eventId that is not latest or oldest
 */
async function fetchGroupEvent(api, orgId, groupId, eventId, envNames, projectId) {
  const url = eventId === 'latest' || eventId === 'oldest' ? `/issues/${groupId}/events/${eventId}/` : `/projects/${orgId}/${projectId}/events/${eventId}/`;
  const query = {};

  if (envNames.length !== 0) {
    query.environment = envNames;
  }

  const data = await api.requestPromise(url, {
    query
  });
  return data;
}
function markEventSeen(api, orgId, projectId, groupId) {
  (0,sentry_actionCreators_group__WEBPACK_IMPORTED_MODULE_2__.bulkUpdate)(api, {
    orgId,
    projectId,
    itemIds: [groupId],
    failSilently: true,
    data: {
      hasSeen: true
    }
  }, {});
}
function fetchGroupUserReports(groupId, query) {
  const api = new sentry_api__WEBPACK_IMPORTED_MODULE_3__.Client();
  return api.requestPromise(`/issues/${groupId}/user-reports/`, {
    includeAllArgs: true,
    query
  });
}
/**
 * Returns the environment name for an event or null
 *
 * @param event
 */

function getEventEnvironment(event) {
  const tag = event.tags.find(_ref => {
    let {
      key
    } = _ref;
    return key === 'environment';
  });
  return tag ? tag.value : null;
}
const SUBSCRIPTION_REASONS = {
  commented: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)("You're receiving workflow notifications because you have commented on this issue."),
  assigned: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)("You're receiving workflow notifications because you were assigned to this issue."),
  bookmarked: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)("You're receiving workflow notifications because you have bookmarked this issue."),
  changed_status: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)("You're receiving workflow notifications because you have changed the status of this issue."),
  mentioned: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)("You're receiving workflow notifications because you have been mentioned in this issue.")
};
/**
 * @param group
 * @param removeLinks add/remove links to subscription reasons text (default: false)
 * @returns Reason for subscription
 */

function getSubscriptionReason(group) {
  let removeLinks = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;

  if (group.subscriptionDetails && group.subscriptionDetails.disabled) {
    return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.tct)('You have [link:disabled workflow notifications] for this project.', {
      link: removeLinks ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)("span", {}) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)("a", {
        href: "/account/settings/notifications/"
      })
    });
  }

  if (!group.isSubscribed) {
    return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Subscribe to workflow notifications for this issue');
  }

  if (group.subscriptionDetails) {
    const {
      reason
    } = group.subscriptionDetails;

    if (reason === 'unknown') {
      return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)("You're receiving workflow notifications because you are subscribed to this issue.");
    }

    if (reason && SUBSCRIPTION_REASONS.hasOwnProperty(reason)) {
      return SUBSCRIPTION_REASONS[reason];
    }
  }

  return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.tct)("You're receiving updates because you are [link:subscribed to workflow notifications] for this project.", {
    link: removeLinks ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)("span", {}) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)("a", {
      href: "/account/settings/notifications/"
    })
  });
}
function getGroupMostRecentActivity(activities) {
  // Most recent activity
  return lodash_orderBy__WEBPACK_IMPORTED_MODULE_1___default()([...activities], _ref2 => {
    let {
      dateCreated
    } = _ref2;
    return new Date(dateCreated);
  }, ['desc'])[0];
}
let ReprocessingStatus; // Reprocessing Checks

(function (ReprocessingStatus) {
  ReprocessingStatus["REPROCESSED_AND_HASNT_EVENT"] = "reprocessed_and_hasnt_event";
  ReprocessingStatus["REPROCESSED_AND_HAS_EVENT"] = "reprocessed_and_has_event";
  ReprocessingStatus["REPROCESSING"] = "reprocessing";
  ReprocessingStatus["NO_STATUS"] = "no_status";
})(ReprocessingStatus || (ReprocessingStatus = {}));

function getGroupReprocessingStatus(group, mostRecentActivity) {
  const {
    status,
    count,
    activity: activities
  } = group;
  const groupCount = Number(count);

  switch (status) {
    case 'reprocessing':
      return ReprocessingStatus.REPROCESSING;

    case 'unresolved':
      {
        const groupMostRecentActivity = mostRecentActivity !== null && mostRecentActivity !== void 0 ? mostRecentActivity : getGroupMostRecentActivity(activities);

        if ((groupMostRecentActivity === null || groupMostRecentActivity === void 0 ? void 0 : groupMostRecentActivity.type) === 'reprocess') {
          if (groupCount === 0) {
            return ReprocessingStatus.REPROCESSED_AND_HASNT_EVENT;
          }

          return ReprocessingStatus.REPROCESSED_AND_HAS_EVENT;
        }

        return ReprocessingStatus.NO_STATUS;
      }

    default:
      return ReprocessingStatus.NO_STATUS;
  }
}

/***/ }),

/***/ "../node_modules/lodash/orderBy.js":
/*!*****************************************!*\
  !*** ../node_modules/lodash/orderBy.js ***!
  \*****************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

var baseOrderBy = __webpack_require__(/*! ./_baseOrderBy */ "../node_modules/lodash/_baseOrderBy.js"),
    isArray = __webpack_require__(/*! ./isArray */ "../node_modules/lodash/isArray.js");

/**
 * This method is like `_.sortBy` except that it allows specifying the sort
 * orders of the iteratees to sort by. If `orders` is unspecified, all values
 * are sorted in ascending order. Otherwise, specify an order of "desc" for
 * descending or "asc" for ascending sort order of corresponding values.
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Collection
 * @param {Array|Object} collection The collection to iterate over.
 * @param {Array[]|Function[]|Object[]|string[]} [iteratees=[_.identity]]
 *  The iteratees to sort by.
 * @param {string[]} [orders] The sort orders of `iteratees`.
 * @param- {Object} [guard] Enables use as an iteratee for methods like `_.reduce`.
 * @returns {Array} Returns the new sorted array.
 * @example
 *
 * var users = [
 *   { 'user': 'fred',   'age': 48 },
 *   { 'user': 'barney', 'age': 34 },
 *   { 'user': 'fred',   'age': 40 },
 *   { 'user': 'barney', 'age': 36 }
 * ];
 *
 * // Sort by `user` in ascending order and by `age` in descending order.
 * _.orderBy(users, ['user', 'age'], ['asc', 'desc']);
 * // => objects for [['barney', 36], ['barney', 34], ['fred', 48], ['fred', 40]]
 */
function orderBy(collection, iteratees, orders, guard) {
  if (collection == null) {
    return [];
  }
  if (!isArray(iteratees)) {
    iteratees = iteratees == null ? [] : [iteratees];
  }
  orders = guard ? undefined : orders;
  if (!isArray(orders)) {
    orders = orders == null ? [] : [orders];
  }
  return baseOrderBy(collection, iteratees, orders);
}

module.exports = orderBy;


/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_views_organizationGroupDetails_index_tsx.129854810411d18228047cf337729707.js.map