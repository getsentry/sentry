"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_components_events_groupingInfo_groupingConfigSelect_tsx-app_components_events_groupingInf-3948ee"],{

/***/ "./app/components/events/groupingInfo/groupingComponent.tsx":
/*!******************************************************************!*\
  !*** ./app/components/events/groupingInfo/groupingComponent.tsx ***!
  \******************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "GroupingComponentListItem": () => (/* binding */ GroupingComponentListItem),
/* harmony export */   "GroupingValue": () => (/* binding */ GroupingValue),
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var _groupingComponentChildren__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./groupingComponentChildren */ "./app/components/events/groupingInfo/groupingComponentChildren.tsx");
/* harmony import */ var _groupingComponentStacktrace__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./groupingComponentStacktrace */ "./app/components/events/groupingInfo/groupingComponentStacktrace.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ./utils */ "./app/components/events/groupingInfo/utils.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }








const GroupingComponent = _ref => {
  let {
    component,
    showNonContributing
  } = _ref;
  const shouldInlineValue = (0,_utils__WEBPACK_IMPORTED_MODULE_4__.shouldInlineComponentValue)(component);
  const GroupingComponentListItems = component.id === 'stacktrace' ? _groupingComponentStacktrace__WEBPACK_IMPORTED_MODULE_3__["default"] : _groupingComponentChildren__WEBPACK_IMPORTED_MODULE_2__["default"];
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsxs)(GroupingComponentWrapper, {
    isContributing: component.contributes,
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsxs)("span", {
      children: [component.name || component.id, component.hint && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(GroupingHint, {
        children: ` (${component.hint})`
      })]
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(GroupingComponentList, {
      isInline: shouldInlineValue,
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(GroupingComponentListItems, {
        component: component,
        showNonContributing: showNonContributing
      })
    })]
  });
};

GroupingComponent.displayName = "GroupingComponent";

const GroupingComponentList = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('ul',  true ? {
  target: "e1rb8ztm4"
} : 0)("padding:0;margin:0;list-style:none;&,&>li{display:", p => p.isInline ? 'inline' : 'block', ";}" + ( true ? "" : 0));

const GroupingComponentListItem = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('li',  true ? {
  target: "e1rb8ztm3"
} : 0)("padding:0;margin:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_1__["default"])(0.25), " 0 ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_1__["default"])(0.25), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_1__["default"])(1.5), ";", p => p.isCollapsible && `
    border-left: 1px solid ${p.theme.innerBorder};
    margin: 0 0 -${(0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_1__["default"])(0.25)} ${(0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_1__["default"])(1)};
    padding-left: ${(0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_1__["default"])(0.5)};
  `, ";" + ( true ? "" : 0));
const GroupingValue = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('code',  true ? {
  target: "e1rb8ztm2"
} : 0)("display:inline-block;margin:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_1__["default"])(0.25), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_1__["default"])(0.5), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_1__["default"])(0.25), " 0;font-size:", p => p.theme.fontSizeSmall, ";padding:0 ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_1__["default"])(0.25), ";background:rgba(112, 163, 214, 0.1);color:", p => p.theme.textColor, ";", _ref2 => {
  let {
    valueType
  } = _ref2;
  return (valueType === 'function' || valueType === 'symbol') && `
    font-weight: bold;
    color: ${p => p.theme.textColor};
  `;
}, ";" + ( true ? "" : 0));

const GroupingComponentWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1rb8ztm1"
} : 0)("color:", p => p.isContributing ? null : p.theme.textColor, ";", GroupingValue, ",button{opacity:1;}" + ( true ? "" : 0));

const GroupingHint = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('small',  true ? {
  target: "e1rb8ztm0"
} : 0)( true ? {
  name: "1rawn5e",
  styles: "font-size:0.8em"
} : 0);

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (GroupingComponent);

/***/ }),

/***/ "./app/components/events/groupingInfo/groupingComponentChildren.tsx":
/*!**************************************************************************!*\
  !*** ./app/components/events/groupingInfo/groupingComponentChildren.tsx ***!
  \**************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var lodash_isObject__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! lodash/isObject */ "../node_modules/lodash/isObject.js");
/* harmony import */ var lodash_isObject__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(lodash_isObject__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var _groupingComponent__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./groupingComponent */ "./app/components/events/groupingInfo/groupingComponent.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ./utils */ "./app/components/events/groupingInfo/utils.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");







const GroupingComponentChildren = _ref => {
  let {
    component,
    showNonContributing
  } = _ref;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(react__WEBPACK_IMPORTED_MODULE_1__.Fragment, {
    children: component.values.filter(value => (0,_utils__WEBPACK_IMPORTED_MODULE_4__.groupingComponentFilter)(value, showNonContributing)).map((value, idx) => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(_groupingComponent__WEBPACK_IMPORTED_MODULE_3__.GroupingComponentListItem, {
      children: lodash_isObject__WEBPACK_IMPORTED_MODULE_2___default()(value) ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(_groupingComponent__WEBPACK_IMPORTED_MODULE_3__["default"], {
        component: value,
        showNonContributing: showNonContributing
      }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(_groupingComponent__WEBPACK_IMPORTED_MODULE_3__.GroupingValue, {
        valueType: component.name || component.id,
        children: typeof value === 'string' || typeof value === 'number' ? value : JSON.stringify(value, null, 2)
      })
    }, idx))
  });
};

GroupingComponentChildren.displayName = "GroupingComponentChildren";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (GroupingComponentChildren);

/***/ }),

/***/ "./app/components/events/groupingInfo/groupingComponentFrames.tsx":
/*!************************************************************************!*\
  !*** ./app/components/events/groupingInfo/groupingComponentFrames.tsx ***!
  \************************************************************************/
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
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var _groupingComponent__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! ./groupingComponent */ "./app/components/events/groupingInfo/groupingComponent.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");












class GroupingComponentFrames extends react__WEBPACK_IMPORTED_MODULE_3__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", {
      collapsed: true
    });
  }

  render() {
    const {
      items,
      maxVisibleItems
    } = this.props;
    const {
      collapsed
    } = this.state;
    const isCollapsible = items.length > maxVisibleItems;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsxs)(react__WEBPACK_IMPORTED_MODULE_3__.Fragment, {
      children: [items.map((item, index) => {
        if (!collapsed || index < maxVisibleItems) {
          return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(_groupingComponent__WEBPACK_IMPORTED_MODULE_8__.GroupingComponentListItem, {
            isCollapsible: isCollapsible,
            children: item
          }, index);
        }

        if (index === maxVisibleItems) {
          return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(_groupingComponent__WEBPACK_IMPORTED_MODULE_8__.GroupingComponentListItem, {
            children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(ToggleCollapse, {
              size: "sm",
              priority: "link",
              icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_5__.IconAdd, {
                size: "8px"
              }),
              onClick: () => this.setState({
                collapsed: false
              }),
              children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.tct)('show [numberOfFrames] similar', {
                numberOfFrames: items.length - maxVisibleItems
              })
            })
          }, index);
        }

        return null;
      }), !collapsed && items.length > maxVisibleItems && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(_groupingComponent__WEBPACK_IMPORTED_MODULE_8__.GroupingComponentListItem, {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(ToggleCollapse, {
          size: "sm",
          priority: "link",
          icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_5__.IconSubtract, {
            size: "8px"
          }),
          onClick: () => this.setState({
            collapsed: true
          }),
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.tct)('collapse [numberOfFrames] similar', {
            numberOfFrames: items.length - maxVisibleItems
          })
        })
      })]
    });
  }

}

GroupingComponentFrames.displayName = "GroupingComponentFrames";

(0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(GroupingComponentFrames, "defaultProps", {
  maxVisibleItems: 2
});

const ToggleCollapse = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_button__WEBPACK_IMPORTED_MODULE_4__["default"],  true ? {
  target: "enrkrz0"
} : 0)("margin:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_7__["default"])(0.5), " 0;color:", p => p.theme.linkColor, ";" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (GroupingComponentFrames);

/***/ }),

/***/ "./app/components/events/groupingInfo/groupingComponentStacktrace.tsx":
/*!****************************************************************************!*\
  !*** ./app/components/events/groupingInfo/groupingComponentStacktrace.tsx ***!
  \****************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var _groupingComponent__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./groupingComponent */ "./app/components/events/groupingInfo/groupingComponent.tsx");
/* harmony import */ var _groupingComponentFrames__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./groupingComponentFrames */ "./app/components/events/groupingInfo/groupingComponentFrames.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ./utils */ "./app/components/events/groupingInfo/utils.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");







const GroupingComponentStacktrace = _ref => {
  let {
    component,
    showNonContributing
  } = _ref;

  const getFrameGroups = () => {
    const frameGroups = [];
    component.values.filter(value => (0,_utils__WEBPACK_IMPORTED_MODULE_4__.groupingComponentFilter)(value, showNonContributing)).forEach(value => {
      const key = value.values.filter(v => (0,_utils__WEBPACK_IMPORTED_MODULE_4__.groupingComponentFilter)(v, showNonContributing)).map(v => v.id).sort((a, b) => a.localeCompare(b)).join('');
      const lastGroup = frameGroups[frameGroups.length - 1];

      if ((lastGroup === null || lastGroup === void 0 ? void 0 : lastGroup.key) === key) {
        lastGroup.data.push(value);
      } else {
        frameGroups.push({
          key,
          data: [value]
        });
      }
    });
    return frameGroups;
  };

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(react__WEBPACK_IMPORTED_MODULE_1__.Fragment, {
    children: getFrameGroups().map((group, index) => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(_groupingComponentFrames__WEBPACK_IMPORTED_MODULE_3__["default"], {
      items: group.data.map((v, idx) => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(_groupingComponent__WEBPACK_IMPORTED_MODULE_2__["default"], {
        component: v,
        showNonContributing: showNonContributing
      }, idx))
    }, index))
  });
};

GroupingComponentStacktrace.displayName = "GroupingComponentStacktrace";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (GroupingComponentStacktrace);

/***/ }),

/***/ "./app/components/events/groupingInfo/groupingConfigSelect.tsx":
/*!*********************************************************************!*\
  !*** ./app/components/events/groupingInfo/groupingConfigSelect.tsx ***!
  \*********************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var sentry_components_asyncComponent__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/asyncComponent */ "./app/components/asyncComponent.tsx");
/* harmony import */ var sentry_components_dropdownAutoComplete__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/dropdownAutoComplete */ "./app/components/dropdownAutoComplete/index.tsx");
/* harmony import */ var sentry_components_dropdownButton__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/dropdownButton */ "./app/components/dropdownButton.tsx");
/* harmony import */ var sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/tooltip */ "./app/components/tooltip.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var ___WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! . */ "./app/components/events/groupingInfo/index.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }









class GroupingConfigSelect extends sentry_components_asyncComponent__WEBPACK_IMPORTED_MODULE_1__["default"] {
  getDefaultState() {
    return { ...super.getDefaultState(),
      configs: []
    };
  }

  getEndpoints() {
    return [['configs', '/grouping-configs/']];
  }

  renderLoading() {
    return this.renderBody();
  }

  renderBody() {
    const {
      configId,
      eventConfigId,
      onSelect
    } = this.props;
    const {
      configs
    } = this.state;
    const options = configs.map(_ref => {
      let {
        id,
        hidden
      } = _ref;
      return {
        value: id,
        label: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(___WEBPACK_IMPORTED_MODULE_6__.GroupingConfigItem, {
          isHidden: hidden,
          isActive: id === eventConfigId,
          children: id
        })
      };
    });
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(sentry_components_dropdownAutoComplete__WEBPACK_IMPORTED_MODULE_2__["default"], {
      onSelect: onSelect,
      items: options,
      children: _ref2 => {
        let {
          isOpen
        } = _ref2;
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_4__["default"], {
          title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_5__.t)('Click here to experiment with other grouping configs'),
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(StyledDropdownButton, {
            isOpen: isOpen,
            size: "sm",
            children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(___WEBPACK_IMPORTED_MODULE_6__.GroupingConfigItem, {
              isActive: eventConfigId === configId,
              children: configId
            })
          })
        });
      }
    });
  }

}

const StyledDropdownButton = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_dropdownButton__WEBPACK_IMPORTED_MODULE_3__["default"],  true ? {
  target: "e4u5um40"
} : 0)( true ? {
  name: "18zed2t",
  styles: "font-weight:inherit"
} : 0);

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (GroupingConfigSelect);

/***/ }),

/***/ "./app/components/events/groupingInfo/groupingVariant.tsx":
/*!****************************************************************!*\
  !*** ./app/components/events/groupingInfo/groupingVariant.tsx ***!
  \****************************************************************/
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
/* harmony import */ var lodash_capitalize__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! lodash/capitalize */ "../node_modules/lodash/capitalize.js");
/* harmony import */ var lodash_capitalize__WEBPACK_IMPORTED_MODULE_4___default = /*#__PURE__*/__webpack_require__.n(lodash_capitalize__WEBPACK_IMPORTED_MODULE_4__);
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_buttonBar__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/buttonBar */ "./app/components/buttonBar.tsx");
/* harmony import */ var sentry_components_events_interfaces_keyValueList__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/events/interfaces/keyValueList */ "./app/components/events/interfaces/keyValueList/index.tsx");
/* harmony import */ var sentry_components_questionTooltip__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/questionTooltip */ "./app/components/questionTooltip.tsx");
/* harmony import */ var sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/tooltip */ "./app/components/tooltip.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_types__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/types */ "./app/types/index.tsx");
/* harmony import */ var _groupingComponent__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! ./groupingComponent */ "./app/components/events/groupingInfo/groupingComponent.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! ./utils */ "./app/components/events/groupingInfo/utils.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");



















function addFingerprintInfo(data, variant) {
  if (variant.matched_rule) {
    data.push([(0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Fingerprint rule'), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsxs)(TextWithQuestionTooltip, {
      children: [variant.matched_rule, (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_components_questionTooltip__WEBPACK_IMPORTED_MODULE_8__["default"], {
        size: "xs",
        position: "top",
        title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('The server-side fingerprinting rule that produced the fingerprint.')
      })]
    }, "type")]);
  }

  if (variant.values) {
    data.push([(0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Fingerprint values'), variant.values]);
  }

  if (variant.client_values) {
    data.push([(0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Client fingerprint values'), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsxs)(TextWithQuestionTooltip, {
      children: [variant.client_values, (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_components_questionTooltip__WEBPACK_IMPORTED_MODULE_8__["default"], {
        size: "xs",
        position: "top",
        title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('The client sent a fingerprint that was overridden by a server-side fingerprinting rule.')
      })]
    }, "type")]);
  }
}

class GroupVariant extends react__WEBPACK_IMPORTED_MODULE_3__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", {
      showNonContributing: false
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleShowNonContributing", () => {
      this.setState({
        showNonContributing: true
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleHideNonContributing", () => {
      this.setState({
        showNonContributing: false
      });
    });
  }

  getVariantData() {
    var _variant$config, _variant$config2;

    const {
      variant,
      showGroupingConfig
    } = this.props;
    const data = [];
    let component;

    if (!this.state.showNonContributing && variant.hash === null) {
      return [data, component];
    }

    if (variant.hash !== null) {
      data.push([(0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Hash'), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsxs)(TextWithQuestionTooltip, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(Hash, {
          children: variant.hash
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_components_questionTooltip__WEBPACK_IMPORTED_MODULE_8__["default"], {
          size: "xs",
          position: "top",
          title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Events with the same hash are grouped together')
        })]
      }, "hash")]);
    }

    if (variant.hashMismatch) {
      data.push([(0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Hash mismatch'), (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('hashing algorithm produced a hash that does not match the event')]);
    }

    switch (variant.type) {
      case sentry_types__WEBPACK_IMPORTED_MODULE_13__.EventGroupVariantType.COMPONENT:
        component = variant.component;
        data.push([(0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Type'), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsxs)(TextWithQuestionTooltip, {
          children: [variant.type, (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_components_questionTooltip__WEBPACK_IMPORTED_MODULE_8__["default"], {
            size: "xs",
            position: "top",
            title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Uses a complex grouping algorithm taking event data into account')
          })]
        }, "type")]);

        if (showGroupingConfig && (_variant$config = variant.config) !== null && _variant$config !== void 0 && _variant$config.id) {
          data.push([(0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Grouping Config'), variant.config.id]);
        }

        break;

      case sentry_types__WEBPACK_IMPORTED_MODULE_13__.EventGroupVariantType.CUSTOM_FINGERPRINT:
        data.push([(0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Type'), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsxs)(TextWithQuestionTooltip, {
          children: [variant.type, (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_components_questionTooltip__WEBPACK_IMPORTED_MODULE_8__["default"], {
            size: "xs",
            position: "top",
            title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Overrides the default grouping by a custom fingerprinting rule')
          })]
        }, "type")]);
        addFingerprintInfo(data, variant);
        break;

      case sentry_types__WEBPACK_IMPORTED_MODULE_13__.EventGroupVariantType.SALTED_COMPONENT:
        component = variant.component;
        data.push([(0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Type'), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsxs)(TextWithQuestionTooltip, {
          children: [variant.type, (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_components_questionTooltip__WEBPACK_IMPORTED_MODULE_8__["default"], {
            size: "xs",
            position: "top",
            title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Uses a complex grouping algorithm taking event data and a fingerprint into account')
          })]
        }, "type")]);
        addFingerprintInfo(data, variant);

        if (showGroupingConfig && (_variant$config2 = variant.config) !== null && _variant$config2 !== void 0 && _variant$config2.id) {
          data.push([(0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Grouping Config'), variant.config.id]);
        }

        break;

      default:
        break;
    }

    if (component) {
      data.push([(0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Grouping'), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(GroupingTree, {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(_groupingComponent__WEBPACK_IMPORTED_MODULE_14__["default"], {
          component: component,
          showNonContributing: this.state.showNonContributing
        })
      }, component.id)]);
    }

    return [data, component];
  }

  renderTitle() {
    var _variant$description$, _variant$description;

    const {
      variant
    } = this.props;
    const isContributing = variant.hash !== null;
    let title;

    if (isContributing) {
      title = (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Contributing variant');
    } else {
      var _variant$component;

      const hint = (_variant$component = variant.component) === null || _variant$component === void 0 ? void 0 : _variant$component.hint;

      if (hint) {
        title = (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Non-contributing variant: %s', hint);
      } else {
        title = (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Non-contributing variant');
      }
    }

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_9__["default"], {
      title: title,
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsxs)(VariantTitle, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(ContributionIcon, {
          isContributing: isContributing
        }), (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('By'), ' ', (_variant$description$ = (_variant$description = variant.description) === null || _variant$description === void 0 ? void 0 : _variant$description.split(' ').map(i => lodash_capitalize__WEBPACK_IMPORTED_MODULE_4___default()(i)).join(' ')) !== null && _variant$description$ !== void 0 ? _variant$description$ : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Nothing')]
      })
    });
  }

  renderContributionToggle() {
    const {
      showNonContributing
    } = this.state;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsxs)(ContributingToggle, {
      merged: true,
      active: showNonContributing ? 'all' : 'relevant',
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_5__["default"], {
        barId: "relevant",
        size: "xs",
        onClick: this.handleHideNonContributing,
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Contributing values')
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_5__["default"], {
        barId: "all",
        size: "xs",
        onClick: this.handleShowNonContributing,
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('All values')
      })]
    });
  }

  render() {
    const [data, component] = this.getVariantData();
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsxs)(VariantWrapper, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsxs)(Header, {
        children: [this.renderTitle(), (0,_utils__WEBPACK_IMPORTED_MODULE_15__.hasNonContributingComponent)(component) && this.renderContributionToggle()]
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_components_events_interfaces_keyValueList__WEBPACK_IMPORTED_MODULE_7__["default"], {
        data: data.map(d => ({
          key: d[0],
          subject: d[0],
          value: d[1]
        })),
        isContextData: true,
        isSorted: false
      })]
    });
  }

}

GroupVariant.displayName = "GroupVariant";

const VariantWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "ekctgc27"
} : 0)("margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_12__["default"])(4), ";" + ( true ? "" : 0));

const Header = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "ekctgc26"
} : 0)("display:flex;align-items:center;justify-content:space-between;margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_12__["default"])(2), ";@media (max-width: ", p => p.theme.breakpoints.small, "){display:block;}" + ( true ? "" : 0));

const VariantTitle = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('h5',  true ? {
  target: "ekctgc25"
} : 0)("font-size:", p => p.theme.fontSizeMedium, ";margin:0;display:flex;align-items:center;" + ( true ? "" : 0));

const ContributionIcon = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(_ref => {
  let {
    isContributing,
    ...p
  } = _ref;
  return isContributing ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_10__.IconCheckmark, {
    size: "sm",
    isCircled: true,
    color: "green300",
    ...p
  }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_10__.IconClose, {
    size: "sm",
    isCircled: true,
    color: "red300",
    ...p
  });
},  true ? {
  target: "ekctgc24"
} : 0)("margin-right:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_12__["default"])(1), ";" + ( true ? "" : 0));

const ContributingToggle = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_buttonBar__WEBPACK_IMPORTED_MODULE_6__["default"],  true ? {
  target: "ekctgc23"
} : 0)("justify-content:flex-end;@media (max-width: ", p => p.theme.breakpoints.small, "){margin-top:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_12__["default"])(0.5), ";}" + ( true ? "" : 0));

const GroupingTree = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "ekctgc22"
} : 0)("color:", p => p.theme.textColor, ";" + ( true ? "" : 0));

const TextWithQuestionTooltip = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "ekctgc21"
} : 0)("display:grid;align-items:center;grid-template-columns:max-content min-content;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_12__["default"])(0.5), ";" + ( true ? "" : 0));

const Hash = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('span',  true ? {
  target: "ekctgc20"
} : 0)("@media (max-width: ", p => p.theme.breakpoints.small, "){", p => p.theme.overflowEllipsis, ";width:210px;}" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (GroupVariant);

/***/ }),

/***/ "./app/components/events/groupingInfo/index.tsx":
/*!******************************************************!*\
  !*** ./app/components/events/groupingInfo/index.tsx ***!
  \******************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "GroupingConfigItem": () => (/* binding */ GroupingConfigItem),
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_asyncComponent__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/asyncComponent */ "./app/components/asyncComponent.tsx");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_events_eventDataSection__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/events/eventDataSection */ "./app/components/events/eventDataSection.tsx");
/* harmony import */ var sentry_components_featureFeedback__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/featureFeedback */ "./app/components/featureFeedback/index.tsx");
/* harmony import */ var sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/loadingIndicator */ "./app/components/loadingIndicator.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/utils/withOrganization */ "./app/utils/withOrganization.tsx");
/* harmony import */ var sentry_views_organizationGroupDetails_grouping_grouping__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/views/organizationGroupDetails/grouping/grouping */ "./app/views/organizationGroupDetails/grouping/grouping.tsx");
/* harmony import */ var _groupingConfigSelect__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! ./groupingConfigSelect */ "./app/components/events/groupingInfo/groupingConfigSelect.tsx");
/* harmony import */ var _groupingVariant__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! ./groupingVariant */ "./app/components/events/groupingInfo/groupingVariant.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


















class EventGroupingInfo extends sentry_components_asyncComponent__WEBPACK_IMPORTED_MODULE_4__["default"] {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "toggle", () => {
      this.setState(state => ({
        isOpen: !state.isOpen,
        configOverride: state.isOpen ? null : state.configOverride
      }));
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleConfigSelect", selection => {
      this.setState({
        configOverride: selection.value
      }, () => this.reloadData());
    });
  }

  getEndpoints() {
    var _this$state;

    const {
      organization,
      event,
      projectId
    } = this.props;
    let path = `/projects/${organization.slug}/${projectId}/events/${event.id}/grouping-info/`;

    if ((_this$state = this.state) !== null && _this$state !== void 0 && _this$state.configOverride) {
      path = `${path}?config=${this.state.configOverride}`;
    }

    return [['groupInfo', path]];
  }

  getDefaultState() {
    return { ...super.getDefaultState(),
      isOpen: false,
      configOverride: null
    };
  }

  renderGroupInfoSummary() {
    const {
      groupInfo
    } = this.state;

    if (!groupInfo) {
      return null;
    }

    const groupedBy = Object.values(groupInfo).filter(variant => variant.hash !== null && variant.description !== null).map(variant => variant.description).sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase())).join(', ');
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(SummaryGroupedBy, {
      "data-test-id": "loaded-grouping-info",
      children: `(${(0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('grouped by')} ${groupedBy || (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('nothing')})`
    });
  }

  renderGroupConfigSelect() {
    const {
      configOverride
    } = this.state;
    const {
      event
    } = this.props;
    const configId = configOverride !== null && configOverride !== void 0 ? configOverride : event.groupingConfig.id;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(_groupingConfigSelect__WEBPACK_IMPORTED_MODULE_13__["default"], {
      eventConfigId: event.groupingConfig.id,
      configId: configId,
      onSelect: this.handleConfigSelect
    });
  }

  renderGroupInfo() {
    const {
      groupInfo,
      loading
    } = this.state;
    const {
      showGroupingConfig
    } = this.props;
    const variants = groupInfo ? Object.values(groupInfo).sort((a, b) => {
      var _a$description$toLowe, _a$description, _b$description$toLowe, _b$description;

      return a.hash && !b.hash ? -1 : (_a$description$toLowe = (_a$description = a.description) === null || _a$description === void 0 ? void 0 : _a$description.toLowerCase().localeCompare((_b$description$toLowe = (_b$description = b.description) === null || _b$description === void 0 ? void 0 : _b$description.toLowerCase()) !== null && _b$description$toLowe !== void 0 ? _b$description$toLowe : '')) !== null && _a$description$toLowe !== void 0 ? _a$description$toLowe : 1;
    }) : [];
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsxs)(react__WEBPACK_IMPORTED_MODULE_3__.Fragment, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsxs)(ConfigHeader, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)("div", {
          children: showGroupingConfig && this.renderGroupConfigSelect()
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_components_featureFeedback__WEBPACK_IMPORTED_MODULE_7__.FeatureFeedback, {
          featureName: "grouping",
          feedbackTypes: sentry_views_organizationGroupDetails_grouping_grouping__WEBPACK_IMPORTED_MODULE_12__.groupingFeedbackTypes,
          buttonProps: {
            size: 'sm'
          }
        })]
      }), loading ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_8__["default"], {}) : variants.map((variant, index) => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsxs)(react__WEBPACK_IMPORTED_MODULE_3__.Fragment, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(_groupingVariant__WEBPACK_IMPORTED_MODULE_14__["default"], {
          variant: variant,
          showGroupingConfig: showGroupingConfig
        }), index < variants.length - 1 && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(VariantDivider, {})]
      }, variant.key))]
    });
  }

  renderLoading() {
    return this.renderBody();
  }

  renderBody() {
    const {
      isOpen
    } = this.state;

    const title = (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsxs)(react__WEBPACK_IMPORTED_MODULE_3__.Fragment, {
      children: [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Event Grouping Information'), !isOpen && this.renderGroupInfoSummary()]
    });

    const actions = (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(ToggleButton, {
      onClick: this.toggle,
      priority: "link",
      children: isOpen ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Hide Details') : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Show Details')
    });

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_components_events_eventDataSection__WEBPACK_IMPORTED_MODULE_6__["default"], {
      type: "grouping-info",
      title: title,
      actions: actions,
      children: isOpen && this.renderGroupInfo()
    });
  }

}

const SummaryGroupedBy = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('small',  true ? {
  target: "eno4hz94"
} : 0)("@media (max-width: ", p => p.theme.breakpoints.small, "){display:block;margin:0!important;}" + ( true ? "" : 0));

const ConfigHeader = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "eno4hz93"
} : 0)("display:flex;align-items:center;justify-content:space-between;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_10__["default"])(1), ";margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_10__["default"])(2), ";" + ( true ? "" : 0));

const ToggleButton = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_button__WEBPACK_IMPORTED_MODULE_5__["default"],  true ? {
  target: "eno4hz92"
} : 0)("font-weight:700;color:", p => p.theme.subText, ";&:hover,&:focus{color:", p => p.theme.textColor, ";}" + ( true ? "" : 0));

const GroupingConfigItem = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('span',  true ? {
  target: "eno4hz91"
} : 0)("font-family:", p => p.theme.text.familyMono, ";opacity:", p => p.isHidden ? 0.5 : null, ";font-weight:", p => p.isActive ? 'bold' : null, ";font-size:", p => p.theme.fontSizeSmall, ";" + ( true ? "" : 0));

const VariantDivider = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('hr',  true ? {
  target: "eno4hz90"
} : 0)("padding-top:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_10__["default"])(1), ";border-top:1px solid ", p => p.theme.border, ";" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_11__["default"])(EventGroupingInfo));

/***/ }),

/***/ "./app/components/events/groupingInfo/utils.tsx":
/*!******************************************************!*\
  !*** ./app/components/events/groupingInfo/utils.tsx ***!
  \******************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "groupingComponentFilter": () => (/* binding */ groupingComponentFilter),
/* harmony export */   "hasNonContributingComponent": () => (/* binding */ hasNonContributingComponent),
/* harmony export */   "shouldInlineComponentValue": () => (/* binding */ shouldInlineComponentValue)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var lodash_isObject__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! lodash/isObject */ "../node_modules/lodash/isObject.js");
/* harmony import */ var lodash_isObject__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(lodash_isObject__WEBPACK_IMPORTED_MODULE_1__);


function hasNonContributingComponent(component) {
  if (!(component !== null && component !== void 0 && component.contributes)) {
    return true;
  }

  for (const value of component.values) {
    if (lodash_isObject__WEBPACK_IMPORTED_MODULE_1___default()(value) && hasNonContributingComponent(value)) {
      return true;
    }
  }

  return false;
}
function shouldInlineComponentValue(component) {
  return component.values.every(value => !lodash_isObject__WEBPACK_IMPORTED_MODULE_1___default()(value));
}
function groupingComponentFilter(value, showNonContributing) {
  if (lodash_isObject__WEBPACK_IMPORTED_MODULE_1___default()(value)) {
    // no point rendering such nodes at all, we never show them
    if (!value.contributes && !value.hint && value.values.length === 0) {
      return false;
    } // non contributing values are otherwise optional


    if (!showNonContributing && !value.contributes) {
      return false;
    }
  }

  return true;
}

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_components_events_groupingInfo_groupingConfigSelect_tsx-app_components_events_groupingInf-3948ee.704d0f4ddeb8ae88451f5878759aa529.js.map