"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_components_activity_author_tsx-app_components_activity_item_index_tsx"],{

/***/ "./app/components/activity/author.tsx":
/*!********************************************!*\
  !*** ./app/components/activity/author.tsx ***!
  \********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");


const ActivityAuthor = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('span',  true ? {
  target: "e12e8tfj0"
} : 0)("font-weight:600;font-size:", p => p.theme.fontSizeMedium, ";" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (ActivityAuthor);

/***/ }),

/***/ "./app/components/activity/item/avatar.tsx":
/*!*************************************************!*\
  !*** ./app/components/activity/item/avatar.tsx ***!
  \*************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var sentry_components_avatar_userAvatar__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/avatar/userAvatar */ "./app/components/avatar/userAvatar.tsx");
/* harmony import */ var sentry_components_placeholder__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/placeholder */ "./app/components/placeholder.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }






function ActivityAvatar(_ref) {
  let {
    className,
    type,
    user,
    size = 38
  } = _ref;

  if (user) {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(sentry_components_avatar_userAvatar__WEBPACK_IMPORTED_MODULE_1__["default"], {
      user: user,
      size: size,
      className: className
    });
  }

  if (type === 'system') {
    // Return Sentry avatar
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(SystemAvatar, {
      className: className,
      size: size,
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(StyledIconSentry, {
        size: "md"
      })
    });
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(sentry_components_placeholder__WEBPACK_IMPORTED_MODULE_2__["default"], {
    className: className,
    width: `${size}px`,
    height: `${size}px`,
    shape: "circle"
  });
}

ActivityAvatar.displayName = "ActivityAvatar";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (ActivityAvatar);

const SystemAvatar = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('span',  true ? {
  target: "ety7k0b1"
} : 0)("display:flex;justify-content:center;align-items:center;width:", p => p.size, "px;height:", p => p.size, "px;background-color:", p => p.theme.textColor, ";color:", p => p.theme.background, ";border-radius:50%;" + ( true ? "" : 0));

const StyledIconSentry = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_icons__WEBPACK_IMPORTED_MODULE_3__.IconSentry,  true ? {
  target: "ety7k0b0"
} : 0)( true ? {
  name: "1p2ly5v",
  styles: "padding-bottom:3px"
} : 0);

/***/ }),

/***/ "./app/components/activity/item/bubble.tsx":
/*!*************************************************!*\
  !*** ./app/components/activity/item/bubble.tsx ***!
  \*************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");


/**
 * This creates a bordered box that has a left pointing arrow
 * on the left-side at the top.
 */
const ActivityBubble = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "ec97ved0"
} : 0)("display:flex;justify-content:center;flex-direction:column;align-items:stretch;flex:1;background-color:", p => p.backgroundColor || p.theme.background, ";border:1px solid ", p => p.borderColor || p.theme.border, ";border-radius:", p => p.theme.borderRadius, ";position:relative;width:100%;&:before{display:block;content:'';width:0;height:0;border-top:7px solid transparent;border-bottom:7px solid transparent;border-right:7px solid ", p => p.borderColor || p.theme.border, ";position:absolute;left:-7px;top:12px;}&:after{display:block;content:'';width:0;height:0;border-top:6px solid transparent;border-bottom:6px solid transparent;border-right:6px solid ", p => p.backgroundColor || p.theme.background, ";position:absolute;left:-6px;top:13px;}" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (ActivityBubble);

/***/ }),

/***/ "./app/components/activity/item/index.tsx":
/*!************************************************!*\
  !*** ./app/components/activity/item/index.tsx ***!
  \************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var moment_timezone__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! moment-timezone */ "../node_modules/moment-timezone/index.js");
/* harmony import */ var moment_timezone__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(moment_timezone__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var sentry_components_dateTime__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/dateTime */ "./app/components/dateTime.tsx");
/* harmony import */ var sentry_components_timeSince__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/timeSince */ "./app/components/timeSince.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_styles_text__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/styles/text */ "./app/styles/text.tsx");
/* harmony import */ var sentry_utils_isRenderFunc__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/utils/isRenderFunc */ "./app/utils/isRenderFunc.tsx");
/* harmony import */ var _avatar__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! ./avatar */ "./app/components/activity/item/avatar.tsx");
/* harmony import */ var _bubble__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! ./bubble */ "./app/components/activity/item/bubble.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }












function ActivityItem(_ref) {
  let {
    author,
    avatarSize,
    bubbleProps,
    className,
    children,
    date,
    interval,
    footer,
    id,
    header,
    hideDate = false,
    showTime = false
  } = _ref;
  const showDate = !hideDate && date && !interval;
  const showRange = !hideDate && date && interval;
  const dateEnded = showRange ? moment_timezone__WEBPACK_IMPORTED_MODULE_1___default()(date).add(interval, 'minutes').utc().format() : undefined;
  const timeOnly = Boolean(date && dateEnded && moment_timezone__WEBPACK_IMPORTED_MODULE_1___default()(date).date() === moment_timezone__WEBPACK_IMPORTED_MODULE_1___default()(dateEnded).date());
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsxs)(ActivityItemWrapper, {
    "data-test-id": "activity-item",
    className: className,
    children: [id && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)("a", {
      id: id
    }), author && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(StyledActivityAvatar, {
      type: author.type,
      user: author.user,
      size: avatarSize
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsxs)(StyledActivityBubble, { ...bubbleProps,
      children: [header && (0,sentry_utils_isRenderFunc__WEBPACK_IMPORTED_MODULE_6__.isRenderFunc)(header) && header(), header && !(0,sentry_utils_isRenderFunc__WEBPACK_IMPORTED_MODULE_6__.isRenderFunc)(header) && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsxs)(ActivityHeader, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(ActivityHeaderContent, {
          children: header
        }), date && showDate && !showTime && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(StyledTimeSince, {
          date: date
        }), date && showDate && showTime && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(StyledDateTime, {
          timeOnly: true,
          date: date
        }), showRange && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsxs)(StyledDateTimeWindow, {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(StyledDateTime, {
            timeOnly: timeOnly,
            date: date
          }), ' — ', (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(StyledDateTime, {
            timeOnly: timeOnly,
            date: dateEnded
          })]
        })]
      }), children && (0,sentry_utils_isRenderFunc__WEBPACK_IMPORTED_MODULE_6__.isRenderFunc)(children) && children(), children && !(0,sentry_utils_isRenderFunc__WEBPACK_IMPORTED_MODULE_6__.isRenderFunc)(children) && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(ActivityBody, {
        children: children
      }), footer && (0,sentry_utils_isRenderFunc__WEBPACK_IMPORTED_MODULE_6__.isRenderFunc)(footer) && footer(), footer && !(0,sentry_utils_isRenderFunc__WEBPACK_IMPORTED_MODULE_6__.isRenderFunc)(footer) && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(ActivityFooter, {
        children: footer
      })]
    })]
  });
}

ActivityItem.displayName = "ActivityItem";

const ActivityItemWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "efzwtto10"
} : 0)("display:flex;margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_4__["default"])(2), ";" + ( true ? "" : 0));

const HeaderAndFooter = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "efzwtto9"
} : 0)("padding:6px ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_4__["default"])(2), ";" + ( true ? "" : 0));

const ActivityHeader = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(HeaderAndFooter,  true ? {
  target: "efzwtto8"
} : 0)("display:flex;border-bottom:1px solid ", p => p.theme.border, ";font-size:", p => p.theme.fontSizeMedium, ";&:last-child{border-bottom:none;}" + ( true ? "" : 0));

const ActivityHeaderContent = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "efzwtto7"
} : 0)( true ? {
  name: "82a6rk",
  styles: "flex:1"
} : 0);

const ActivityFooter = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(HeaderAndFooter,  true ? {
  target: "efzwtto6"
} : 0)("display:flex;border-top:1px solid ", p => p.theme.border, ";font-size:", p => p.theme.fontSizeMedium, ";" + ( true ? "" : 0));

const ActivityBody = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "efzwtto5"
} : 0)("padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_4__["default"])(2), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_4__["default"])(2), ";", sentry_styles_text__WEBPACK_IMPORTED_MODULE_5__["default"], ";" + ( true ? "" : 0));

const StyledActivityAvatar = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(_avatar__WEBPACK_IMPORTED_MODULE_7__["default"],  true ? {
  target: "efzwtto4"
} : 0)("margin-right:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_4__["default"])(1), ";" + ( true ? "" : 0));

const StyledTimeSince = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_timeSince__WEBPACK_IMPORTED_MODULE_3__["default"],  true ? {
  target: "efzwtto3"
} : 0)("color:", p => p.theme.gray300, ";" + ( true ? "" : 0));

const StyledDateTime = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_dateTime__WEBPACK_IMPORTED_MODULE_2__["default"],  true ? {
  target: "efzwtto2"
} : 0)("color:", p => p.theme.gray300, ";" + ( true ? "" : 0));

const StyledDateTimeWindow = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "efzwtto1"
} : 0)("color:", p => p.theme.gray300, ";" + ( true ? "" : 0));

const StyledActivityBubble = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(_bubble__WEBPACK_IMPORTED_MODULE_8__["default"],  true ? {
  target: "efzwtto0"
} : 0)( true ? {
  name: "17ly0ks",
  styles: "width:75%;overflow-wrap:break-word"
} : 0);

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (ActivityItem);

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_components_activity_author_tsx-app_components_activity_item_index_tsx.8567d247874bbb88e12e46c57a206d20.js.map