"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_views_profiling_profileFlamechart_tsx"],{

/***/ "./app/components/profiling/FlamegraphWarnings.tsx":
/*!*********************************************************!*\
  !*** ./app/components/profiling/FlamegraphWarnings.tsx ***!
  \*********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "FlamegraphWarnings": () => (/* binding */ FlamegraphWarnings)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var sentry_components_profiling_exportProfileButton__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/profiling/exportProfileButton */ "./app/components/profiling/exportProfileButton.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_useParams__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/utils/useParams */ "./app/utils/useParams.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");






function FlamegraphWarnings(props) {
  const params = (0,sentry_utils_useParams__WEBPACK_IMPORTED_MODULE_3__.useParams)();

  if (props.flamegraph.profile.samples.length === 0) {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)(Overlay, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)("p", {
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('This profile either has no samples or the total duration of frames in the profile is 0.')
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)("div", {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(sentry_components_profiling_exportProfileButton__WEBPACK_IMPORTED_MODULE_1__.ExportProfileButton, {
          variant: "default",
          eventId: params.eventId,
          orgId: params.orgId,
          size: "sm",
          projectId: params.projectId,
          title: undefined,
          disabled: params.eventId === undefined || params.orgId === undefined || params.projectId === undefined,
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Export Raw Profile')
        })
      })]
    });
  }

  return null;
}

const Overlay = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "eyf8brq0"
} : 0)("position:absolute;left:0;top:0;width:100%;height:100%;display:grid;grid:auto/50%;place-content:center;z-index:", p => p.theme.zIndex.modal, ";text-align:center;" + ( true ? "" : 0));

/***/ }),

/***/ "./app/components/profiling/FrameStack/frameStack.tsx":
/*!************************************************************!*\
  !*** ./app/components/profiling/FrameStack/frameStack.tsx ***!
  \************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "FrameCallersTableCell": () => (/* binding */ FrameCallersTableCell),
/* harmony export */   "FrameStack": () => (/* binding */ FrameStack)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_profiling_exportProfileButton__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/profiling/exportProfileButton */ "./app/components/profiling/exportProfileButton.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_profiling_filterFlamegraphTree__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/utils/profiling/filterFlamegraphTree */ "./app/utils/profiling/filterFlamegraphTree.tsx");
/* harmony import */ var sentry_utils_profiling_flamegraph_useFlamegraphPreferences__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/utils/profiling/flamegraph/useFlamegraphPreferences */ "./app/utils/profiling/flamegraph/useFlamegraphPreferences.ts");
/* harmony import */ var sentry_utils_profiling_profile_utils__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/utils/profiling/profile/utils */ "./app/utils/profiling/profile/utils.tsx");
/* harmony import */ var sentry_utils_useParams__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/utils/useParams */ "./app/utils/useParams.tsx");
/* harmony import */ var _frameStackTable__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! ./frameStackTable */ "./app/components/profiling/FrameStack/frameStackTable.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");



function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }














const FrameStack = /*#__PURE__*/(0,react__WEBPACK_IMPORTED_MODULE_2__.memo)(function FrameStack(props) {
  const params = (0,sentry_utils_useParams__WEBPACK_IMPORTED_MODULE_11__.useParams)();
  const [flamegraphPreferences, dispatchFlamegraphPreferences] = (0,sentry_utils_profiling_flamegraph_useFlamegraphPreferences__WEBPACK_IMPORTED_MODULE_9__.useFlamegraphPreferences)();
  const [tab, setTab] = (0,react__WEBPACK_IMPORTED_MODULE_2__.useState)('call order');
  const [treeType, setTreeType] = (0,react__WEBPACK_IMPORTED_MODULE_2__.useState)('all');
  const [recursion, setRecursion] = (0,react__WEBPACK_IMPORTED_MODULE_2__.useState)(null);
  const maybeFilteredOrInvertedTree = (0,react__WEBPACK_IMPORTED_MODULE_2__.useMemo)(() => {
    const skipFunction = treeType === 'application' ? f => !f.frame.is_application : treeType === 'system' ? f => f.frame.is_application : () => false;
    const maybeFilteredRoots = treeType !== 'all' ? (0,sentry_utils_profiling_filterFlamegraphTree__WEBPACK_IMPORTED_MODULE_8__.filterFlamegraphTree)(props.rootNodes, skipFunction) : props.rootNodes;

    if (tab === 'call order') {
      return maybeFilteredRoots;
    }

    return (0,sentry_utils_profiling_profile_utils__WEBPACK_IMPORTED_MODULE_10__.invertCallTree)(maybeFilteredRoots);
  }, [tab, treeType, props.rootNodes]);
  const handleRecursionChange = (0,react__WEBPACK_IMPORTED_MODULE_2__.useCallback)(evt => {
    setRecursion(evt.currentTarget.checked ? 'collapsed' : null);
  }, []);
  const onBottomUpClick = (0,react__WEBPACK_IMPORTED_MODULE_2__.useCallback)(() => {
    setTab('bottom up');
  }, []);
  const onCallOrderClick = (0,react__WEBPACK_IMPORTED_MODULE_2__.useCallback)(() => {
    setTab('call order');
  }, []);
  const onAllApplicationsClick = (0,react__WEBPACK_IMPORTED_MODULE_2__.useCallback)(() => {
    setTreeType('all');
  }, []);
  const onApplicationsClick = (0,react__WEBPACK_IMPORTED_MODULE_2__.useCallback)(() => {
    setTreeType('application');
  }, []);
  const onSystemsClick = (0,react__WEBPACK_IMPORTED_MODULE_2__.useCallback)(() => {
    setTreeType('system');
  }, []);
  const onTableLeftClick = (0,react__WEBPACK_IMPORTED_MODULE_2__.useCallback)(() => {
    dispatchFlamegraphPreferences({
      type: 'set layout',
      payload: 'table left'
    });
  }, [dispatchFlamegraphPreferences]);
  const onTableBottomClick = (0,react__WEBPACK_IMPORTED_MODULE_2__.useCallback)(() => {
    dispatchFlamegraphPreferences({
      type: 'set layout',
      payload: 'table bottom'
    });
  }, [dispatchFlamegraphPreferences]);
  const onTableRightClick = (0,react__WEBPACK_IMPORTED_MODULE_2__.useCallback)(() => {
    dispatchFlamegraphPreferences({
      type: 'set layout',
      payload: 'table right'
    });
  }, [dispatchFlamegraphPreferences]);
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsxs)(FrameDrawer, {
    layout: flamegraphPreferences.layout,
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsxs)(FrameTabs, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(ListItem, {
        className: tab === 'bottom up' ? 'active' : undefined,
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_3__["default"], {
          "data-title": (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Bottom Up'),
          priority: "link",
          size: "zero",
          onClick: onBottomUpClick,
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Bottom Up')
        })
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(ListItem, {
        margin: "none",
        className: tab === 'call order' ? 'active' : undefined,
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_3__["default"], {
          "data-title": (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Call Order'),
          priority: "link",
          size: "zero",
          onClick: onCallOrderClick,
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Call Order')
        })
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(Separator, {}), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(ListItem, {
        className: treeType === 'all' ? 'active' : undefined,
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_3__["default"], {
          "data-title": (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('All Frames'),
          priority: "link",
          size: "zero",
          onClick: onAllApplicationsClick,
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('All Frames')
        })
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(ListItem, {
        className: treeType === 'application' ? 'active' : undefined,
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_3__["default"], {
          "data-title": (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Application Frames'),
          priority: "link",
          size: "zero",
          onClick: onApplicationsClick,
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Application Frames')
        })
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(ListItem, {
        margin: "none",
        className: treeType === 'system' ? 'active' : undefined,
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_3__["default"], {
          "data-title": (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('System Frames'),
          priority: "link",
          size: "zero",
          onClick: onSystemsClick,
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('System Frames')
        })
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(Separator, {}), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(ListItem, {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsxs)(FrameDrawerLabel, {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)("input", {
            type: "checkbox",
            checked: recursion === 'collapsed',
            onChange: handleRecursionChange
          }), (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Collapse recursion')]
        })
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(ListItem, {
        style: {
          flex: '1 1 100%',
          cursor: flamegraphPreferences.layout === 'table bottom' ? 'ns-resize' : undefined
        },
        onMouseDown: flamegraphPreferences.layout === 'table bottom' ? props.onResize : undefined
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(ListItem, {
        margin: "none",
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_components_profiling_exportProfileButton__WEBPACK_IMPORTED_MODULE_4__.ExportProfileButton, {
          variant: "xs",
          eventId: params.eventId,
          orgId: params.orgId,
          projectId: params.projectId,
          disabled: params.eventId === undefined || params.orgId === undefined || params.projectId === undefined
        })
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(Separator, {}), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(ListItem, {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsxs)(LayoutSelectionContainer, {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(StyledButton, {
            active: flamegraphPreferences.layout === 'table left',
            onClick: onTableLeftClick,
            size: "xs",
            title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Table left'),
            children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_5__.IconPanel, {
              size: "xs",
              direction: "right"
            })
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(StyledButton, {
            active: flamegraphPreferences.layout === 'table bottom',
            onClick: onTableBottomClick,
            size: "xs",
            title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Table bottom'),
            children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_5__.IconPanel, {
              size: "xs",
              direction: "down"
            })
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(StyledButton, {
            active: flamegraphPreferences.layout === 'table right',
            onClick: onTableRightClick,
            size: "xs",
            title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Table right'),
            children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_5__.IconPanel, {
              size: "xs",
              direction: "left"
            })
          })]
        })
      })]
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(_frameStackTable__WEBPACK_IMPORTED_MODULE_12__.FrameStackTable, { ...props,
      recursion: recursion,
      referenceNode: props.referenceNode,
      tree: maybeFilteredOrInvertedTree !== null && maybeFilteredOrInvertedTree !== void 0 ? maybeFilteredOrInvertedTree : [],
      canvasPoolManager: props.canvasPoolManager
    }), flamegraphPreferences.layout === 'table left' || flamegraphPreferences.layout === 'table right' ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(ResizableVerticalDrawer, {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(InvisibleHandler, {
        onMouseDown: props.onResize
      })
    }) : null]
  });
});

const ResizableVerticalDrawer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "egqij2z9"
} : 0)("width:1px;grid-area:drawer;background-color:", p => p.theme.border, ";position:relative;" + ( true ? "" : 0));

const InvisibleHandler = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "egqij2z8"
} : 0)("opacity:0;width:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_7__["default"])(1), ";position:absolute;inset:0;cursor:ew-resize;transform:translateX(-50%);background-color:transparent;" + ( true ? "" : 0));

const FrameDrawerLabel = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('label',  true ? {
  target: "egqij2z7"
} : 0)("display:flex;align-items:center;white-space:nowrap;margin-bottom:0;height:100%;font-weight:normal;>input{margin:0 ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_7__["default"])(0.5), " 0 0;}" + ( true ? "" : 0)); // Linter produces a false positive for the grid layout. I did not manage to find out
// how to "fix it" or why it is not working, I imagine it could be due to the ternary?


const FrameDrawer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "egqij2z6"
} : 0)("display:grid;grid-template-rows:auto 1fr;grid-template-columns:", _ref => {
  let {
    layout
  } = _ref;
  return layout === 'table left' ? '1fr auto' : layout === 'table right' ? 'auto 1fr' : '1fr';
}, ";grid-template-areas:", _ref2 => {
  let {
    layout
  } = _ref2;
  return layout === 'table bottom' ? `
    'tabs'
    'table'
    'drawer'
    ` : layout === 'table left' ? `
      'tabs drawer'
      'table drawer'
      ` : `
      'drawer tabs'
      'drawer table'
      `;
}, ";" + ( true ? "" : 0));

const Separator = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('li',  true ? {
  target: "egqij2z5"
} : 0)("width:1px;height:66%;margin:0 ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_7__["default"])(1), ";background:", p => p.theme.border, ";transform:translateY(29%);" + ( true ? "" : 0));

const FrameTabs = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('ul',  true ? {
  target: "egqij2z4"
} : 0)("display:flex;list-style-type:none;padding:0 ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_7__["default"])(1), ";margin:0;border-top:1px solid ", prop => prop.theme.border, ";background-color:", props => props.theme.surface100, ";user-select:none;grid-area:tabs;" + ( true ? "" : 0));

const ListItem = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('li',  true ? {
  target: "egqij2z3"
} : 0)("font-size:", p => p.theme.fontSizeSmall, ";margin-right:", p => p.margin === 'none' ? 0 : (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_7__["default"])(1), ";button{border:none;border-top:2px solid transparent;border-bottom:2px solid transparent;border-radius:0;margin:0;padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_7__["default"])(0.5), " 0;color:", p => p.theme.textColor, ";&::after{display:block;content:attr(data-title);font-weight:bold;height:1px;color:transparent;overflow:hidden;visibility:hidden;white-space:nowrap;}&:hover{color:", p => p.theme.textColor, ";}}&.active button{font-weight:bold;border-bottom:2px solid ", prop => prop.theme.active, ";}" + ( true ? "" : 0));

const StyledButton = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_button__WEBPACK_IMPORTED_MODULE_3__["default"],  true ? {
  target: "egqij2z2"
} : 0)("border:none;background-color:transparent;box-shadow:none;transition:none!important;opacity:", p => p.active ? 0.7 : 0.5, ";&:not(:last-child){margin-right:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_7__["default"])(1), ";}&:hover{border:none;background-color:transparent;box-shadow:none;opacity:", p => p.active ? 0.6 : 0.5, ";}" + ( true ? "" : 0));

const LayoutSelectionContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "egqij2z1"
} : 0)( true ? {
  name: "s5xdrg",
  styles: "display:flex;align-items:center"
} : 0);

const FRAME_WEIGHT_CELL_WIDTH_PX = 164;
const FrameCallersTableCell = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "egqij2z0"
} : 0)("width:", FRAME_WEIGHT_CELL_WIDTH_PX, "px;position:relative;white-space:nowrap;flex-shrink:0;padding:0 ", p => p.noPadding ? 0 : (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_7__["default"])(1), " 0 0;text-align:", p => {
  var _p$textAlign;

  return (_p$textAlign = p.textAlign) !== null && _p$textAlign !== void 0 ? _p$textAlign : 'initial';
}, ";&:first-child,&:nth-child(2){position:sticky;z-index:1;background-color:", p => p.isSelected ? p.theme.blue300 : p.theme.background, ";}&:first-child{left:0;}&:nth-child(2){left:", FRAME_WEIGHT_CELL_WIDTH_PX, "px;}&:not(:last-child){border-right:1px solid ", p => p.theme.border, ";}" + ( true ? "" : 0));


/***/ }),

/***/ "./app/components/profiling/FrameStack/frameStackContextMenu.tsx":
/*!***********************************************************************!*\
  !*** ./app/components/profiling/FrameStack/frameStackContextMenu.tsx ***!
  \***********************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "FrameStackContextMenu": () => (/* binding */ FrameStackContextMenu)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_profiling_ProfilingContextMenu_profilingContextMenu__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/profiling/ProfilingContextMenu/profilingContextMenu */ "./app/components/profiling/ProfilingContextMenu/profilingContextMenu.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");





function FrameStackContextMenu(props) {
  var _props$contextMenu$po, _props$contextMenu$po2, _props$contextMenu$po3, _props$contextMenu$po4, _props$contextMenu$co, _props$contextMenu$co2;

  return props.contextMenu.open ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsxs)(react__WEBPACK_IMPORTED_MODULE_0__.Fragment, {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(sentry_components_profiling_ProfilingContextMenu_profilingContextMenu__WEBPACK_IMPORTED_MODULE_1__.ProfilingContextMenuLayer, {
      onClick: () => props.contextMenu.setOpen(false)
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(sentry_components_profiling_ProfilingContextMenu_profilingContextMenu__WEBPACK_IMPORTED_MODULE_1__.ProfilingContextMenu, { ...props.contextMenu.getMenuProps(),
      style: {
        position: 'absolute',
        left: (_props$contextMenu$po = (_props$contextMenu$po2 = props.contextMenu.position) === null || _props$contextMenu$po2 === void 0 ? void 0 : _props$contextMenu$po2.left) !== null && _props$contextMenu$po !== void 0 ? _props$contextMenu$po : -9999,
        top: (_props$contextMenu$po3 = (_props$contextMenu$po4 = props.contextMenu.position) === null || _props$contextMenu$po4 === void 0 ? void 0 : _props$contextMenu$po4.top) !== null && _props$contextMenu$po3 !== void 0 ? _props$contextMenu$po3 : -9999,
        maxHeight: (_props$contextMenu$co = (_props$contextMenu$co2 = props.contextMenu.containerCoordinates) === null || _props$contextMenu$co2 === void 0 ? void 0 : _props$contextMenu$co2.height) !== null && _props$contextMenu$co !== void 0 ? _props$contextMenu$co : 'auto'
      },
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsxs)(sentry_components_profiling_ProfilingContextMenu_profilingContextMenu__WEBPACK_IMPORTED_MODULE_1__.ProfilingContextMenuGroup, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(sentry_components_profiling_ProfilingContextMenu_profilingContextMenu__WEBPACK_IMPORTED_MODULE_1__.ProfilingContextMenuHeading, {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Actions')
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(sentry_components_profiling_ProfilingContextMenu_profilingContextMenu__WEBPACK_IMPORTED_MODULE_1__.ProfilingContextMenuItem, { ...props.contextMenu.getMenuItemProps(),
          onClick: props.onZoomIntoFrameClick,
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Show in flamegraph')
        })]
      })
    })]
  }) : null;
}

/***/ }),

/***/ "./app/components/profiling/FrameStack/frameStackTable.tsx":
/*!*****************************************************************!*\
  !*** ./app/components/profiling/FrameStack/frameStackTable.tsx ***!
  \*****************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "FrameStackTable": () => (/* binding */ FrameStackTable)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/es.error.cause.js */ "../node_modules/core-js/modules/es.error.cause.js");
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_profiling_hooks_useContextMenu__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/utils/profiling/hooks/useContextMenu */ "./app/utils/profiling/hooks/useContextMenu.tsx");
/* harmony import */ var sentry_utils_profiling_hooks_useVirtualizedTree_useVirtualizedTree__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/utils/profiling/hooks/useVirtualizedTree/useVirtualizedTree */ "./app/utils/profiling/hooks/useVirtualizedTree/useVirtualizedTree.tsx");
/* harmony import */ var _frameStack__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! ./frameStack */ "./app/components/profiling/FrameStack/frameStack.tsx");
/* harmony import */ var _frameStackContextMenu__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! ./frameStackContextMenu */ "./app/components/profiling/FrameStack/frameStackContextMenu.tsx");
/* harmony import */ var _frameStackTableRow__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! ./frameStackTableRow */ "./app/components/profiling/FrameStack/frameStackTableRow.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }













function makeSortFunction(property, direction) {
  if (property === 'total weight') {
    return direction === 'desc' ? (a, b) => {
      return b.node.node.totalWeight - a.node.node.totalWeight;
    } : (a, b) => {
      return a.node.node.totalWeight - b.node.node.totalWeight;
    };
  }

  if (property === 'self weight') {
    return direction === 'desc' ? (a, b) => {
      return b.node.node.selfWeight - a.node.node.selfWeight;
    } : (a, b) => {
      return a.node.node.selfWeight - b.node.node.selfWeight;
    };
  }

  if (property === 'name') {
    return direction === 'desc' ? (a, b) => {
      return a.node.frame.name.localeCompare(b.node.frame.name);
    } : (a, b) => {
      return b.node.frame.name.localeCompare(a.node.frame.name);
    };
  }

  throw new Error(`Unknown sort property ${property}`);
}

function skipRecursiveNodes(n) {
  return n.node.node.isDirectRecursive();
}

function FrameStackTable(_ref) {
  let {
    tree,
    referenceNode,
    canvasPoolManager,
    getFrameColor,
    formatDuration,
    recursion
  } = _ref;
  const [scrollContainerRef, setScrollContainerRef] = (0,react__WEBPACK_IMPORTED_MODULE_3__.useState)(null);
  const [sort, setSort] = (0,react__WEBPACK_IMPORTED_MODULE_3__.useState)('total weight');
  const [direction, setDirection] = (0,react__WEBPACK_IMPORTED_MODULE_3__.useState)('desc');
  const sortFunction = (0,react__WEBPACK_IMPORTED_MODULE_3__.useMemo)(() => {
    return makeSortFunction(sort, direction);
  }, [sort, direction]);
  const [clickedContextMenuNode, setClickedContextMenuClose] = (0,react__WEBPACK_IMPORTED_MODULE_3__.useState)(null);
  const contextMenu = (0,sentry_utils_profiling_hooks_useContextMenu__WEBPACK_IMPORTED_MODULE_7__.useContextMenu)({
    container: scrollContainerRef
  });
  const handleZoomIntoFrameClick = (0,react__WEBPACK_IMPORTED_MODULE_3__.useCallback)(() => {
    if (!clickedContextMenuNode) {
      return;
    }

    canvasPoolManager.dispatch('zoom at frame', [clickedContextMenuNode.node, 'exact']);
    canvasPoolManager.dispatch('highlight frame', [clickedContextMenuNode.node, 'selected']);
  }, [canvasPoolManager, clickedContextMenuNode]);
  const renderRow = (0,react__WEBPACK_IMPORTED_MODULE_3__.useCallback)((r, _ref2) => {
    let {
      handleRowClick,
      handleRowMouseEnter,
      handleExpandTreeNode,
      handleRowKeyDown,
      tabIndexKey
    } = _ref2;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(_frameStackTableRow__WEBPACK_IMPORTED_MODULE_11__.FrameStackTableRow, {
      ref: n => {
        r.ref = n;
      },
      node: r.item,
      style: r.styles,
      referenceNode: referenceNode,
      frameColor: getFrameColor(r.item.node),
      formatDuration: formatDuration,
      tabIndex: tabIndexKey === r.key ? 0 : 1,
      onClick: handleRowClick,
      onExpandClick: handleExpandTreeNode,
      onKeyDown: handleRowKeyDown,
      onMouseEnter: handleRowMouseEnter,
      onContextMenu: evt => {
        setClickedContextMenuClose(r.item);
        contextMenu.handleContextMenu(evt);
      }
    });
  }, [contextMenu, formatDuration, referenceNode, getFrameColor]);
  const {
    renderedItems,
    scrollContainerStyles,
    containerStyles,
    handleSortingChange,
    clickedGhostRowRef,
    hoveredGhostRowRef
  } = (0,sentry_utils_profiling_hooks_useVirtualizedTree_useVirtualizedTree__WEBPACK_IMPORTED_MODULE_8__.useVirtualizedTree)({
    skipFunction: recursion === 'collapsed' ? skipRecursiveNodes : undefined,
    sortFunction,
    renderRow,
    scrollContainer: scrollContainerRef,
    rowHeight: 24,
    tree
  });
  const onSortChange = (0,react__WEBPACK_IMPORTED_MODULE_3__.useCallback)(newSort => {
    const newDirection = newSort === sort ? direction === 'asc' ? 'desc' : 'asc' : 'desc';
    setDirection(newDirection);
    setSort(newSort);
    const sortFn = makeSortFunction(newSort, newDirection);
    handleSortingChange(sortFn);
  }, [sort, direction, handleSortingChange]);
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(FrameBar, {
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsxs)(FrameCallersTable, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsxs)(FrameCallersTableHeader, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(FrameWeightCell, {
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsxs)(TableHeaderButton, {
            onClick: () => onSortChange('self weight'),
            children: [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_5__.t)('Self Time '), sort === 'self weight' ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_4__.IconArrow, {
              direction: direction === 'desc' ? 'down' : 'up'
            }) : null]
          })
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(FrameWeightCell, {
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsxs)(TableHeaderButton, {
            onClick: () => onSortChange('total weight'),
            children: [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_5__.t)('Total Time'), ' ', sort === 'total weight' ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_4__.IconArrow, {
              direction: direction === 'desc' ? 'down' : 'up'
            }) : null]
          })
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(FrameNameCell, {
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsxs)(TableHeaderButton, {
            onClick: () => onSortChange('name'),
            children: [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_5__.t)('Frame'), ' ', sort === 'name' ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_4__.IconArrow, {
              direction: direction === 'desc' ? 'down' : 'up'
            }) : null]
          })
        })]
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(_frameStackContextMenu__WEBPACK_IMPORTED_MODULE_10__.FrameStackContextMenu, {
        onZoomIntoFrameClick: handleZoomIntoFrameClick,
        contextMenu: contextMenu
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsxs)(TableItemsContainer, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)("div", {
          ref: hoveredGhostRowRef
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)("div", {
          ref: clickedGhostRowRef
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)("div", {
          ref: ref => setScrollContainerRef(ref),
          style: scrollContainerStyles,
          onContextMenu: contextMenu.handleContextMenu,
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsxs)("div", {
            style: containerStyles,
            children: [renderedItems, (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsxs)(GhostRowContainer, {
              children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(_frameStack__WEBPACK_IMPORTED_MODULE_9__.FrameCallersTableCell, {}), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(_frameStack__WEBPACK_IMPORTED_MODULE_9__.FrameCallersTableCell, {}), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(_frameStack__WEBPACK_IMPORTED_MODULE_9__.FrameCallersTableCell, {
                style: {
                  width: '100%'
                }
              })]
            })]
          })
        })]
      })]
    })
  });
}
FrameStackTable.displayName = "FrameStackTable";

const TableItemsContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "ewf50xr7"
} : 0)("position:relative;height:100%;overflow:hidden;background:", p => p.theme.background, ";" + ( true ? "" : 0));

const GhostRowContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "ewf50xr6"
} : 0)( true ? {
  name: "5zl1kz",
  styles: "display:flex;width:100%;pointer-events:none;position:absolute;height:100%;z-index:-1"
} : 0);

const TableHeaderButton = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('button',  true ? {
  target: "ewf50xr5"
} : 0)("display:flex;width:100%;align-items:center;justify-content:space-between;padding:0 ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_6__["default"])(1), ";border:none;background-color:", props => props.theme.surface100, ";transition:background-color 100ms ease-in-out;line-height:24px;&:hover{background-color:", props => props.theme.surface400, ";}svg{width:10px;height:10px;}" + ( true ? "" : 0));

const FrameBar = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "ewf50xr4"
} : 0)("overflow:auto;width:100%;position:relative;background-color:", p => p.theme.surface100, ";border-top:1px solid ", p => p.theme.border, ";flex:1 1 100%;grid-area:table;" + ( true ? "" : 0));

const FrameCallersTable = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "ewf50xr3"
} : 0)("font-size:", p => p.theme.fontSizeSmall, ";margin:0;overflow:auto;max-height:100%;height:100%;width:100%;display:flex;flex-direction:column;" + ( true ? "" : 0));

const FRAME_WEIGHT_CELL_WIDTH_PX = 164;

const FrameWeightCell = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "ewf50xr2"
} : 0)("width:", FRAME_WEIGHT_CELL_WIDTH_PX, "px;" + ( true ? "" : 0));

const FrameNameCell = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "ewf50xr1"
} : 0)( true ? {
  name: "10h7o7i",
  styles: "flex:1 1 100%"
} : 0);

const FrameCallersTableHeader = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "ewf50xr0"
} : 0)("top:0;position:sticky;z-index:1;display:flex;flex:1;>div{position:relative;border-bottom:1px solid ", p => p.theme.border, ";background-color:", p => p.theme.background, ";white-space:nowrap;&:last-child{flex:1;}&:not(:last-child){border-right:1px solid ", p => p.theme.border, ";}}" + ( true ? "" : 0));

/***/ }),

/***/ "./app/components/profiling/FrameStack/frameStackTableRow.tsx":
/*!********************************************************************!*\
  !*** ./app/components/profiling/FrameStack/frameStackTableRow.tsx ***!
  \********************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "FrameStackTableRow": () => (/* binding */ FrameStackTableRow)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var _frameStack__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ./frameStack */ "./app/components/profiling/FrameStack/frameStack.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }








function computeRelativeWeight(base, value) {
  // Make sure we dont divide by zero
  if (!base || !value) {
    return 0;
  }

  return value / base * 100;
}

const FrameStackTableRow = /*#__PURE__*/(0,react__WEBPACK_IMPORTED_MODULE_1__.forwardRef)((_ref, ref) => {
  let {
    node,
    referenceNode,
    onExpandClick,
    onContextMenu,
    formatDuration,
    frameColor,
    tabIndex,
    onKeyDown,
    onClick,
    onMouseEnter,
    style
  } = _ref;
  const isSelected = tabIndex === 0;
  const handleExpanding = (0,react__WEBPACK_IMPORTED_MODULE_1__.useCallback)(evt => {
    evt.stopPropagation();
    onExpandClick(node, {
      expandChildren: evt.metaKey
    });
  }, [node, onExpandClick]);
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsxs)(FrameCallersRow, {
    ref: ref,
    style: style,
    onContextMenu: onContextMenu,
    tabIndex: tabIndex,
    isSelected: isSelected,
    onKeyDown: onKeyDown,
    onClick: onClick,
    onMouseEnter: onMouseEnter,
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsxs)(_frameStack__WEBPACK_IMPORTED_MODULE_4__.FrameCallersTableCell, {
      isSelected: isSelected,
      textAlign: "right",
      children: [formatDuration(node.node.node.selfWeight), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(Weight, {
        isSelected: isSelected,
        weight: computeRelativeWeight(referenceNode.node.totalWeight, node.node.node.selfWeight)
      })]
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(_frameStack__WEBPACK_IMPORTED_MODULE_4__.FrameCallersTableCell, {
      isSelected: isSelected,
      noPadding: true,
      textAlign: "right",
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsxs)(FrameWeightTypeContainer, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsxs)(FrameWeightContainer, {
          children: [formatDuration(node.node.node.totalWeight), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(Weight, {
            padded: true,
            isSelected: isSelected,
            weight: computeRelativeWeight(referenceNode.node.totalWeight, node.node.node.totalWeight)
          })]
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(FrameTypeIndicator, {
          isSelected: isSelected,
          children: node.node.node.frame.is_application ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_2__.IconUser, {
            size: "xs"
          }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_2__.IconSettings, {
            size: "xs"
          })
        })]
      })
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(_frameStack__WEBPACK_IMPORTED_MODULE_4__.FrameCallersTableCell // We stretch this table to 100% width.
    , {
      style: {
        paddingLeft: node.depth * 14 + 8,
        width: '100%'
      },
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsxs)(FrameNameContainer, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(FrameColorIndicator, {
          style: {
            backgroundColor: frameColor
          }
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(FrameChildrenIndicator, {
          tabIndex: -1,
          onClick: handleExpanding,
          open: node.expanded,
          children: node.node.children.length > 0 ? '\u203A' : null
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(FrameName, {
          children: node.node.frame.name
        })]
      })
    })]
  });
});

const Weight = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(props => {
  const {
    weight,
    padded: __,
    isSelected: _,
    ...rest
  } = props;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsxs)("div", { ...rest,
    children: [weight.toFixed(1), "%", (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(BackgroundWeightBar, {
      style: {
        transform: `scaleX(${weight / 100})`
      }
    })]
  });
},  true ? {
  target: "e1h9r9vb9"
} : 0)("display:inline-block;min-width:7ch;padding-right:", p => p.padded ? (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_3__["default"])(0.5) : 0, ";color:", p => p.isSelected ? p.theme.white : p.theme.subText, ";opacity:", p => p.isSelected ? 0.8 : 1, ";" + ( true ? "" : 0));

const FrameWeightTypeContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1h9r9vb8"
} : 0)( true ? {
  name: "wvdp2q",
  styles: "display:flex;align-items:center;justify-content:flex-end;position:relative"
} : 0);

const FrameTypeIndicator = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1h9r9vb7"
} : 0)("flex-shrink:0;width:26px;height:12px;display:flex;align-items:center;justify-content:center;color:", p => p.isSelected ? p.theme.white : p.theme.subText, ";opacity:", p => p.isSelected ? 0.8 : 1, ";" + ( true ? "" : 0));

const FrameWeightContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1h9r9vb6"
} : 0)( true ? {
  name: "wxotm9",
  styles: "display:flex;align-items:center;position:relative;justify-content:flex-end;flex:1 1 100%"
} : 0);

const BackgroundWeightBar = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1h9r9vb5"
} : 0)("pointer-events:none;position:absolute;right:0;top:0;background-color:", props => props.theme.yellow100, ";border-bottom:1px solid ", props => props.theme.yellow200, ";transform-origin:center right;height:100%;width:100%;" + ( true ? "" : 0));

const FrameCallersRow = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1h9r9vb4"
} : 0)("display:flex;width:100%;color:", p => p.isSelected ? p.theme.white : 'inherit', ";scroll-margin-top:24px;font-size:", p => p.theme.fontSizeSmall, ";line-height:24px;&:focus{outline:none;}&[data-hovered='true']:not([tabindex='0']){>div:first-child,>div:nth-child(2){background-color:", p => p.theme.surface100, "!important;}}" + ( true ? "" : 0));

const FrameNameContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1h9r9vb3"
} : 0)( true ? {
  name: "s5xdrg",
  styles: "display:flex;align-items:center"
} : 0);

const FrameChildrenIndicator = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('button',  true ? {
  target: "e1h9r9vb2"
} : 0)("width:10px;height:10px;display:flex;padding:0;border:none;background-color:transparent;align-items:center;justify-content:center;user-select:none;transform:", p => p.open ? 'rotate(90deg)' : 'rotate(0deg)', ";" + ( true ? "" : 0));

const FrameName = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('span',  true ? {
  target: "e1h9r9vb1"
} : 0)("margin-left:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_3__["default"])(0.5), ";" + ( true ? "" : 0));

const FrameColorIndicator = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1h9r9vb0"
} : 0)("width:12px;height:12px;border-radius:2px;display:inline-block;flex-shrink:0;margin-right:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_3__["default"])(0.5), ";" + ( true ? "" : 0));

/***/ }),

/***/ "./app/components/profiling/ProfilingContextMenu/profilingContextMenu.tsx":
/*!********************************************************************************!*\
  !*** ./app/components/profiling/ProfilingContextMenu/profilingContextMenu.tsx ***!
  \********************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "ProfilingContextMenu": () => (/* binding */ Menu),
/* harmony export */   "ProfilingContextMenuGroup": () => (/* binding */ MenuGroup),
/* harmony export */   "ProfilingContextMenuHeading": () => (/* binding */ MenuHeading),
/* harmony export */   "ProfilingContextMenuItem": () => (/* binding */ MenuItem),
/* harmony export */   "ProfilingContextMenuItemCheckbox": () => (/* binding */ MenuItemCheckbox),
/* harmony export */   "ProfilingContextMenuLayer": () => (/* binding */ Layer)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }







const Menu = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])( /*#__PURE__*/(0,react__WEBPACK_IMPORTED_MODULE_1__.forwardRef)((props, ref) => {
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)("div", {
    ref: ref,
    role: "menu",
    ...props
  });
}),  true ? {
  target: "em97tx410"
} : 0)("position:absolute;font-size:", p => p.theme.fontSizeMedium, ";z-index:", p => p.theme.zIndex.dropdown, ";background:", p => p.theme.backgroundElevated, ";border:1px solid ", p => p.theme.border, ";border-radius:", p => p.theme.borderRadius, ";box-shadow:", p => p.theme.dropShadowHeavy, ";width:auto;min-width:164px;overflow:auto;padding-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_3__["default"])(0.5), ";" + ( true ? "" : 0));



const MenuContentContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "em97tx49"
} : 0)("cursor:pointer;display:flex;align-items:center;font-weight:normal;padding:0 ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_3__["default"])(1), ";border-radius:", p => p.theme.borderRadius, ";box-sizing:border-box;background:", p => p.tabIndex === 0 ? p.theme.hover : undefined, ";&:focus{color:", p => p.theme.textColor, ";background:", p => p.theme.hover, ";outline:none;}" + ( true ? "" : 0));

const MenuItemCheckboxLabel = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('label',  true ? {
  target: "em97tx48"
} : 0)( true ? {
  name: "1h5wbu2",
  styles: "display:flex;align-items:center;font-weight:normal;margin:0;cursor:pointer;flex:1 1 100%"
} : 0);

const MenuItemCheckbox = /*#__PURE__*/(0,react__WEBPACK_IMPORTED_MODULE_1__.forwardRef)((props, ref) => {
  const {
    children,
    checked,
    ...rest
  } = props;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(MenuContentOuterContainer, {
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(MenuContentContainer, {
      ref: ref,
      role: "menuitem",
      ...rest,
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)(MenuItemCheckboxLabel, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)(MenuLeadingItem, {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(Input, {
            type: "checkbox",
            checked: checked,
            onChange: () => void 0
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_2__.IconCheckmark, {})]
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(MenuContent, {
          children: children
        })]
      })
    })
  });
});


const MenuLeadingItem = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "em97tx47"
} : 0)("display:flex;align-items:center;height:1.4em;width:1em;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_3__["default"])(1), ";padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_3__["default"])(1), " 0;position:relative;" + ( true ? "" : 0));

const MenuContent = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "em97tx46"
} : 0)("position:relative;width:100%;display:flex;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_3__["default"])(0.5), ";justify-content:space-between;padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_3__["default"])(0.5), " 0;margin-left:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_3__["default"])(0.5), ";text-transform:capitalize;margin-bottom:0;line-height:1.4;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" + ( true ? "" : 0));

const Input = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('input',  true ? {
  target: "em97tx45"
} : 0)("position:absolute;opacity:0;cursor:pointer;height:0;padding-right:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_3__["default"])(1), ";&+svg{position:absolute;left:50%;top:50%;transform:translate(-50%, -50%);width:1em;height:1.4em;display:none;}&:checked+svg{display:block;}" + ( true ? "" : 0));

const MenuItem = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])( /*#__PURE__*/(0,react__WEBPACK_IMPORTED_MODULE_1__.forwardRef)((props, ref) => {
  const {
    children,
    ...rest
  } = props;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(MenuContentOuterContainer, {
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(MenuContentContainer, {
      ref: ref,
      role: "menuitem",
      ...rest,
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(MenuContent, {
        children: children
      })
    })
  });
}),  true ? {
  target: "em97tx44"
} : 0)("cursor:pointer;color:", p => p.theme.textColor, ";background:transparent;padding:0 ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_3__["default"])(0.5), ";&:focus{outline:none;}&:active:{background:transparent;}" + ( true ? "" : 0));



const MenuContentOuterContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "em97tx43"
} : 0)("padding:0 ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_3__["default"])(0.5), ";" + ( true ? "" : 0));

const MenuGroup = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "em97tx42"
} : 0)("padding-top:0;padding-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_3__["default"])(1), ";&:last-of-type{padding-bottom:0;}" + ( true ? "" : 0));



const MenuHeading = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(props => {
  const {
    children,
    ...rest
  } = props;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)("div", { ...rest,
    children: children
  });
},  true ? {
  target: "em97tx41"
} : 0)("text-transform:uppercase;line-height:1.5;font-weight:600;color:", p => p.theme.subText, ";margin-bottom:0;cursor:default;font-size:75%;padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_3__["default"])(0.5), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_3__["default"])(1.5), ";" + ( true ? "" : 0));



const Layer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "em97tx40"
} : 0)("width:100%;height:100%;position:absolute;left:0;top:0;z-index:", p => p.theme.zIndex.dropdown - 1, ";" + ( true ? "" : 0));



/***/ }),

/***/ "./app/components/profiling/boundTooltip.tsx":
/*!***************************************************!*\
  !*** ./app/components/profiling/boundTooltip.tsx ***!
  \***************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "BoundTooltip": () => (/* binding */ BoundTooltip)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var gl_matrix__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! gl-matrix */ "../node_modules/gl-matrix/esm/vec2.js");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_profiling_flamegraph_useFlamegraphTheme__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/utils/profiling/flamegraph/useFlamegraphTheme */ "./app/utils/profiling/flamegraph/useFlamegraphTheme.ts");
/* harmony import */ var sentry_utils_theme__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/utils/theme */ "./app/utils/theme.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");








function computeBestTooltipPlacement(cursor, container, tooltip) {
  // This is because the cursor's origin is in the top left corner of the arrow, so we want
  // to offset it just enough so that the tooltip does not overlap with the arrow's tail.
  // When the tooltip placed to the left of the cursor, we do not have that issue and hence
  // no offset is applied.
  const OFFSET_PX = 6;
  let left = cursor[0] + OFFSET_PX;
  const top = cursor[1] + OFFSET_PX;

  if (cursor[0] > container.width / 2) {
    left = cursor[0] - tooltip.width; // No offset is applied here as tooltip is placed to the left
  }

  return `translate(${left || 0}px, ${top || 0}px)`;
}

function BoundTooltip(_ref) {
  let {
    bounds,
    flamegraphCanvas,
    cursor,
    flamegraphView,
    children
  } = _ref;
  const flamegraphTheme = (0,sentry_utils_profiling_flamegraph_useFlamegraphTheme__WEBPACK_IMPORTED_MODULE_3__.useFlamegraphTheme)();
  const physicalSpaceCursor = gl_matrix__WEBPACK_IMPORTED_MODULE_5__.transformMat3(gl_matrix__WEBPACK_IMPORTED_MODULE_5__.create(), cursor, flamegraphView.fromConfigView(flamegraphCanvas.physicalSpace));
  const logicalSpaceCursor = gl_matrix__WEBPACK_IMPORTED_MODULE_5__.transformMat3(gl_matrix__WEBPACK_IMPORTED_MODULE_5__.create(), physicalSpaceCursor, flamegraphCanvas.physicalToLogicalSpace);
  const rafIdRef = (0,react__WEBPACK_IMPORTED_MODULE_1__.useRef)();
  const onRef = (0,react__WEBPACK_IMPORTED_MODULE_1__.useCallback)(node => {
    if (node === null) {
      return;
    }

    if (rafIdRef.current) {
      window.cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = undefined;
    }

    rafIdRef.current = window.requestAnimationFrame(() => {
      node.style.transform = computeBestTooltipPlacement(logicalSpaceCursor, bounds, node.getBoundingClientRect());
    });
  }, [bounds, logicalSpaceCursor]);
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(Tooltip, {
    ref: onRef,
    style: {
      willChange: 'transform',
      fontSize: flamegraphTheme.SIZES.TOOLTIP_FONT_SIZE,
      fontFamily: flamegraphTheme.FONTS.FONT,
      zIndex: sentry_utils_theme__WEBPACK_IMPORTED_MODULE_4__["default"].zIndex.tooltip,
      maxWidth: bounds.width
    },
    children: children
  });
}

BoundTooltip.displayName = "BoundTooltip";

const Tooltip = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "emr26rc0"
} : 0)("background:", p => p.theme.background, ";position:absolute;white-space:nowrap;text-overflow:ellipsis;overflow:hidden;pointer-events:none;user-select:none;border-radius:", p => p.theme.borderRadius, ";padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_2__["default"])(0.25), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_2__["default"])(1), ";border:1px solid ", p => p.theme.border, ";font-size:", p => p.theme.fontSizeSmall, ";line-height:24px;" + ( true ? "" : 0));



/***/ }),

/***/ "./app/components/profiling/exportProfileButton.tsx":
/*!**********************************************************!*\
  !*** ./app/components/profiling/exportProfileButton.tsx ***!
  \**********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "ExportProfileButton": () => (/* binding */ ExportProfileButton)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_useApi__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/utils/useApi */ "./app/utils/useApi.tsx");
/* harmony import */ var sentry_utils_useOrganization__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/utils/useOrganization */ "./app/utils/useOrganization.tsx");
/* harmony import */ var sentry_utils_useProjects__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/utils/useProjects */ "./app/utils/useProjects.tsx");
/* harmony import */ var _button__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! ../button */ "./app/components/button.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");










function ExportProfileButton(props) {
  var _ref, _project$slug;

  const api = (0,sentry_utils_useApi__WEBPACK_IMPORTED_MODULE_4__["default"])();
  const organization = (0,sentry_utils_useOrganization__WEBPACK_IMPORTED_MODULE_5__["default"])();
  const project = (0,sentry_utils_useProjects__WEBPACK_IMPORTED_MODULE_6__["default"])().projects.find(p => {
    return p.slug === props.projectId;
  });
  const href = `${api.baseUrl}/projects/${props.orgId}/${props.projectId}/profiling/raw_profiles/${props.eventId}/`;
  const download = `${organization.slug}_${(_ref = (_project$slug = project === null || project === void 0 ? void 0 : project.slug) !== null && _project$slug !== void 0 ? _project$slug : props.projectId) !== null && _ref !== void 0 ? _ref : 'unknown_project'}_${props.eventId}.profile.json`;
  const title = (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Export Profile');
  return props.variant === 'xs' ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsxs)(StyledButtonSmall, {
    size: "xs",
    title: title,
    href: href,
    download: download,
    ...props,
    children: [props.children, (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_1__.IconDownload, {
      size: "xs"
    })]
  }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(_button__WEBPACK_IMPORTED_MODULE_7__["default"], {
    icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_1__.IconDownload, {}),
    title: title,
    href: href,
    download: download,
    ...props,
    children: props.children
  });
}

const StyledButtonSmall = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(_button__WEBPACK_IMPORTED_MODULE_7__["default"],  true ? {
  target: "epggksl0"
} : 0)("border:none;background-color:transparent;box-shadow:none;transition:none!important;opacity:0.5;padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_3__["default"])(0.5), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_3__["default"])(0.5), ";&:hover{border:none;background-color:transparent;box-shadow:none;}" + ( true ? "" : 0));

/***/ }),

/***/ "./app/components/profiling/flamegraph.tsx":
/*!*************************************************!*\
  !*** ./app/components/profiling/flamegraph.tsx ***!
  \*************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "Flamegraph": () => (/* binding */ Flamegraph)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var gl_matrix__WEBPACK_IMPORTED_MODULE_24__ = __webpack_require__(/*! gl-matrix */ "../node_modules/gl-matrix/esm/vec2.js");
/* harmony import */ var sentry_components_profiling_flamegraphOptionsMenu__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/profiling/flamegraphOptionsMenu */ "./app/components/profiling/flamegraphOptionsMenu.tsx");
/* harmony import */ var sentry_components_profiling_flamegraphSearch__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/profiling/flamegraphSearch */ "./app/components/profiling/flamegraphSearch.tsx");
/* harmony import */ var sentry_components_profiling_flamegraphToolbar__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/profiling/flamegraphToolbar */ "./app/components/profiling/flamegraphToolbar.tsx");
/* harmony import */ var sentry_components_profiling_flamegraphViewSelectMenu__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/profiling/flamegraphViewSelectMenu */ "./app/components/profiling/flamegraphViewSelectMenu.tsx");
/* harmony import */ var sentry_components_profiling_flamegraphZoomView__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/profiling/flamegraphZoomView */ "./app/components/profiling/flamegraphZoomView.tsx");
/* harmony import */ var sentry_components_profiling_flamegraphZoomViewMinimap__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/profiling/flamegraphZoomViewMinimap */ "./app/components/profiling/flamegraphZoomViewMinimap.tsx");
/* harmony import */ var sentry_components_profiling_FrameStack_frameStack__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/profiling/FrameStack/frameStack */ "./app/components/profiling/FrameStack/frameStack.tsx");
/* harmony import */ var sentry_components_profiling_profileDragDropImport__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/profiling/profileDragDropImport */ "./app/components/profiling/profileDragDropImport.tsx");
/* harmony import */ var sentry_components_profiling_threadSelector__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/profiling/threadSelector */ "./app/components/profiling/threadSelector.tsx");
/* harmony import */ var sentry_utils_profiling_canvasScheduler__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/utils/profiling/canvasScheduler */ "./app/utils/profiling/canvasScheduler.tsx");
/* harmony import */ var sentry_utils_profiling_flamegraph__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/utils/profiling/flamegraph */ "./app/utils/profiling/flamegraph.ts");
/* harmony import */ var sentry_utils_profiling_flamegraph_useFlamegraphPreferences__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/utils/profiling/flamegraph/useFlamegraphPreferences */ "./app/utils/profiling/flamegraph/useFlamegraphPreferences.ts");
/* harmony import */ var sentry_utils_profiling_flamegraph_useFlamegraphProfiles__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/utils/profiling/flamegraph/useFlamegraphProfiles */ "./app/utils/profiling/flamegraph/useFlamegraphProfiles.tsx");
/* harmony import */ var sentry_utils_profiling_flamegraph_useFlamegraphTheme__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/utils/profiling/flamegraph/useFlamegraphTheme */ "./app/utils/profiling/flamegraph/useFlamegraphTheme.ts");
/* harmony import */ var sentry_utils_profiling_flamegraphCanvas__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/utils/profiling/flamegraphCanvas */ "./app/utils/profiling/flamegraphCanvas.tsx");
/* harmony import */ var sentry_utils_profiling_flamegraphView__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! sentry/utils/profiling/flamegraphView */ "./app/utils/profiling/flamegraphView.tsx");
/* harmony import */ var sentry_utils_profiling_gl_utils__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! sentry/utils/profiling/gl/utils */ "./app/utils/profiling/gl/utils.ts");
/* harmony import */ var sentry_utils_profiling_renderers_flamegraphRenderer__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! sentry/utils/profiling/renderers/flamegraphRenderer */ "./app/utils/profiling/renderers/flamegraphRenderer.tsx");
/* harmony import */ var sentry_utils_useDevicePixelRatio__WEBPACK_IMPORTED_MODULE_20__ = __webpack_require__(/*! sentry/utils/useDevicePixelRatio */ "./app/utils/useDevicePixelRatio.tsx");
/* harmony import */ var sentry_utils_useMemoWithPrevious__WEBPACK_IMPORTED_MODULE_21__ = __webpack_require__(/*! sentry/utils/useMemoWithPrevious */ "./app/utils/useMemoWithPrevious.ts");
/* harmony import */ var _FlamegraphWarnings__WEBPACK_IMPORTED_MODULE_22__ = __webpack_require__(/*! ./FlamegraphWarnings */ "./app/components/profiling/FlamegraphWarnings.tsx");
/* harmony import */ var _profilingFlamechartLayout__WEBPACK_IMPORTED_MODULE_23__ = __webpack_require__(/*! ./profilingFlamechartLayout */ "./app/components/profiling/profilingFlamechartLayout.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




























function getTransactionConfigSpace(profiles) {
  const startedAt = Math.min(...profiles.map(p => p.startedAt));
  const endedAt = Math.max(...profiles.map(p => p.endedAt));
  return new sentry_utils_profiling_gl_utils__WEBPACK_IMPORTED_MODULE_18__.Rect(startedAt, 0, endedAt - startedAt, 0);
}

const noopFormatDuration = () => '';

function Flamegraph(props) {
  const [canvasBounds, setCanvasBounds] = (0,react__WEBPACK_IMPORTED_MODULE_1__.useState)(sentry_utils_profiling_gl_utils__WEBPACK_IMPORTED_MODULE_18__.Rect.Empty());
  const devicePixelRatio = (0,sentry_utils_useDevicePixelRatio__WEBPACK_IMPORTED_MODULE_20__.useDevicePixelRatio)();
  const flamegraphTheme = (0,sentry_utils_profiling_flamegraph_useFlamegraphTheme__WEBPACK_IMPORTED_MODULE_15__.useFlamegraphTheme)();
  const [{
    sorting,
    view,
    xAxis
  }, dispatch] = (0,sentry_utils_profiling_flamegraph_useFlamegraphPreferences__WEBPACK_IMPORTED_MODULE_13__.useFlamegraphPreferences)();
  const [{
    threadId,
    selectedRoot
  }, dispatchThreadId] = (0,sentry_utils_profiling_flamegraph_useFlamegraphProfiles__WEBPACK_IMPORTED_MODULE_14__.useFlamegraphProfiles)();
  const [flamegraphCanvasRef, setFlamegraphCanvasRef] = (0,react__WEBPACK_IMPORTED_MODULE_1__.useState)(null);
  const [flamegraphOverlayCanvasRef, setFlamegraphOverlayCanvasRef] = (0,react__WEBPACK_IMPORTED_MODULE_1__.useState)(null);
  const [flamegraphMiniMapCanvasRef, setFlamegraphMiniMapCanvasRef] = (0,react__WEBPACK_IMPORTED_MODULE_1__.useState)(null);
  const [flamegraphMiniMapOverlayCanvasRef, setFlamegraphMiniMapOverlayCanvasRef] = (0,react__WEBPACK_IMPORTED_MODULE_1__.useState)(null);
  const canvasPoolManager = (0,react__WEBPACK_IMPORTED_MODULE_1__.useMemo)(() => new sentry_utils_profiling_canvasScheduler__WEBPACK_IMPORTED_MODULE_11__.CanvasPoolManager(), []);
  const scheduler = (0,react__WEBPACK_IMPORTED_MODULE_1__.useMemo)(() => new sentry_utils_profiling_canvasScheduler__WEBPACK_IMPORTED_MODULE_11__.CanvasScheduler(), []);
  const flamegraph = (0,react__WEBPACK_IMPORTED_MODULE_1__.useMemo)(() => {
    if (typeof threadId !== 'number') {
      return sentry_utils_profiling_flamegraph__WEBPACK_IMPORTED_MODULE_12__.Flamegraph.Empty();
    } // This could happen if threadId was initialized from query string, but for some
    // reason the profile was removed from the list of profiles.


    const profile = props.profiles.profiles.find(p => p.threadId === threadId);

    if (!profile) {
      return sentry_utils_profiling_flamegraph__WEBPACK_IMPORTED_MODULE_12__.Flamegraph.Empty();
    }

    return new sentry_utils_profiling_flamegraph__WEBPACK_IMPORTED_MODULE_12__.Flamegraph(profile, threadId, {
      inverted: view === 'bottom up',
      leftHeavy: sorting === 'left heavy',
      configSpace: xAxis === 'transaction' ? getTransactionConfigSpace(props.profiles.profiles) : undefined
    });
  }, [props.profiles, sorting, threadId, view, xAxis]);
  const flamegraphCanvas = (0,react__WEBPACK_IMPORTED_MODULE_1__.useMemo)(() => {
    if (!flamegraphCanvasRef) {
      return null;
    }

    return new sentry_utils_profiling_flamegraphCanvas__WEBPACK_IMPORTED_MODULE_16__.FlamegraphCanvas(flamegraphCanvasRef, gl_matrix__WEBPACK_IMPORTED_MODULE_24__.fromValues(0, flamegraphTheme.SIZES.TIMELINE_HEIGHT * devicePixelRatio));
  }, [devicePixelRatio, flamegraphCanvasRef, flamegraphTheme]);
  const flamegraphMiniMapCanvas = (0,react__WEBPACK_IMPORTED_MODULE_1__.useMemo)(() => {
    if (!flamegraphMiniMapCanvasRef) {
      return null;
    }

    return new sentry_utils_profiling_flamegraphCanvas__WEBPACK_IMPORTED_MODULE_16__.FlamegraphCanvas(flamegraphMiniMapCanvasRef, gl_matrix__WEBPACK_IMPORTED_MODULE_24__.fromValues(0, 0));
  }, [flamegraphMiniMapCanvasRef]);
  const flamegraphView = (0,sentry_utils_useMemoWithPrevious__WEBPACK_IMPORTED_MODULE_21__.useMemoWithPrevious)(previousView => {
    if (!flamegraphCanvas) {
      return null;
    }

    const newView = new sentry_utils_profiling_flamegraphView__WEBPACK_IMPORTED_MODULE_17__.FlamegraphView({
      canvas: flamegraphCanvas,
      flamegraph,
      theme: flamegraphTheme
    }); // if the profile or the config space of the flamegraph has changed, we do not
    // want to persist the config view. This is to avoid a case where the new config space
    // is larger than the previous one, meaning the new view could now be zoomed in even
    // though the user did not fire any zoom events.

    if ((previousView === null || previousView === void 0 ? void 0 : previousView.flamegraph.profile) === newView.flamegraph.profile && previousView.configSpace.equals(newView.configSpace)) {
      // if we're still looking at the same profile but only a preference other than
      // left heavy has changed, we do want to persist the config view
      if (previousView.flamegraph.leftHeavy === newView.flamegraph.leftHeavy) {
        newView.setConfigView(previousView.configView.withHeight(newView.configView.height));
      }
    }

    return newView;
  }, [flamegraph, flamegraphCanvas, flamegraphTheme]);
  (0,react__WEBPACK_IMPORTED_MODULE_1__.useEffect)(() => {
    if (!flamegraphCanvas || !flamegraphView) {
      return undefined;
    }

    const onConfigViewChange = rect => {
      flamegraphView.setConfigView(rect);
      canvasPoolManager.draw();
    };

    const onTransformConfigView = mat => {
      flamegraphView.transformConfigView(mat);
      canvasPoolManager.draw();
    };

    const onResetZoom = () => {
      flamegraphView.resetConfigView(flamegraphCanvas);
      canvasPoolManager.draw();
    };

    const onZoomIntoFrame = (frame, strategy) => {
      const newConfigView = (0,sentry_utils_profiling_gl_utils__WEBPACK_IMPORTED_MODULE_18__.computeConfigViewWithStategy)(strategy, flamegraphView.configView, new sentry_utils_profiling_gl_utils__WEBPACK_IMPORTED_MODULE_18__.Rect(frame.start, frame.depth, frame.end - frame.start, 1));
      flamegraphView.setConfigView(newConfigView);
      canvasPoolManager.draw();
    };

    scheduler.on('set config view', onConfigViewChange);
    scheduler.on('transform config view', onTransformConfigView);
    scheduler.on('reset zoom', onResetZoom);
    scheduler.on('zoom at frame', onZoomIntoFrame);
    return () => {
      scheduler.off('set config view', onConfigViewChange);
      scheduler.off('transform config view', onTransformConfigView);
      scheduler.off('reset zoom', onResetZoom);
      scheduler.off('zoom at frame', onZoomIntoFrame);
    };
  }, [canvasPoolManager, flamegraphCanvas, flamegraphView, scheduler]);
  (0,react__WEBPACK_IMPORTED_MODULE_1__.useEffect)(() => {
    canvasPoolManager.registerScheduler(scheduler);
    return () => canvasPoolManager.unregisterScheduler(scheduler);
  }, [canvasPoolManager, scheduler]);
  (0,react__WEBPACK_IMPORTED_MODULE_1__.useLayoutEffect)(() => {
    if (!flamegraphView || !flamegraphCanvas || !flamegraphMiniMapCanvas || !flamegraphCanvasRef || !flamegraphOverlayCanvasRef || !flamegraphMiniMapCanvasRef || !flamegraphMiniMapOverlayCanvasRef) {
      return undefined;
    }

    const flamegraphObserver = (0,sentry_utils_profiling_gl_utils__WEBPACK_IMPORTED_MODULE_18__.watchForResize)([flamegraphCanvasRef, flamegraphOverlayCanvasRef], () => {
      const bounds = flamegraphCanvasRef.getBoundingClientRect();
      setCanvasBounds(new sentry_utils_profiling_gl_utils__WEBPACK_IMPORTED_MODULE_18__.Rect(bounds.x, bounds.y, bounds.width, bounds.height));
      flamegraphCanvas.initPhysicalSpace();
      flamegraphView.resizeConfigSpace(flamegraphCanvas);
      canvasPoolManager.drawSync();
    });
    const flamegraphMiniMapObserver = (0,sentry_utils_profiling_gl_utils__WEBPACK_IMPORTED_MODULE_18__.watchForResize)([flamegraphMiniMapCanvasRef, flamegraphMiniMapOverlayCanvasRef], () => {
      flamegraphMiniMapCanvas.initPhysicalSpace();
      canvasPoolManager.drawSync();
    });
    return () => {
      flamegraphObserver.disconnect();
      flamegraphMiniMapObserver.disconnect();
    };
  }, [canvasPoolManager, flamegraphCanvas, flamegraphCanvasRef, flamegraphMiniMapCanvas, flamegraphMiniMapCanvasRef, flamegraphMiniMapOverlayCanvasRef, flamegraphOverlayCanvasRef, flamegraphView]);
  const flamegraphRenderer = (0,react__WEBPACK_IMPORTED_MODULE_1__.useMemo)(() => {
    if (!flamegraphCanvasRef) {
      return null;
    }

    return new sentry_utils_profiling_renderers_flamegraphRenderer__WEBPACK_IMPORTED_MODULE_19__.FlamegraphRenderer(flamegraphCanvasRef, flamegraph, flamegraphTheme, {
      draw_border: true
    });
  }, [flamegraph, flamegraphCanvasRef, flamegraphTheme]);
  const getFrameColor = (0,react__WEBPACK_IMPORTED_MODULE_1__.useCallback)(frame => {
    if (!flamegraphRenderer) {
      return '';
    }

    return (0,sentry_utils_profiling_gl_utils__WEBPACK_IMPORTED_MODULE_18__.formatColorForFrame)(frame, flamegraphRenderer);
  }, [flamegraphRenderer]); // referenceNode is passed down to the frameStack and is used to determine
  // the weights of each frame. In other words, in case there is no user selected root, then all
  // of the frame weights and timing are relative to the entire profile. If there is a user selected
  // root however, all weights are relative to that sub tree.

  const referenceNode = (0,react__WEBPACK_IMPORTED_MODULE_1__.useMemo)(() => selectedRoot ? selectedRoot : flamegraph.root, [selectedRoot, flamegraph.root]); // In case a user selected root is present, we will display that root + it's entire sub tree.
  // If no root is selected, we will display the entire sub tree down from the root. We start at
  // root.children because flamegraph.root is a virtual node that we do not want to show in the table.

  const rootNodes = (0,react__WEBPACK_IMPORTED_MODULE_1__.useMemo)(() => {
    return selectedRoot ? [selectedRoot] : flamegraph.root.children;
  }, [selectedRoot, flamegraph.root]);
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsxs)(react__WEBPACK_IMPORTED_MODULE_1__.Fragment, {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsxs)(sentry_components_profiling_flamegraphToolbar__WEBPACK_IMPORTED_MODULE_4__.FlamegraphToolbar, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(sentry_components_profiling_threadSelector__WEBPACK_IMPORTED_MODULE_10__.ThreadMenuSelector, {
        profileGroup: props.profiles,
        threadId: threadId,
        onThreadIdChange: newThreadId => dispatchThreadId({
          type: 'set thread id',
          payload: newThreadId
        })
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(sentry_components_profiling_flamegraphViewSelectMenu__WEBPACK_IMPORTED_MODULE_5__.FlamegraphViewSelectMenu, {
        view: view,
        sorting: sorting,
        onSortingChange: s => {
          dispatch({
            type: 'set sorting',
            payload: s
          });
        },
        onViewChange: v => {
          dispatch({
            type: 'set view',
            payload: v
          });
        }
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(sentry_components_profiling_flamegraphSearch__WEBPACK_IMPORTED_MODULE_3__.FlamegraphSearch, {
        flamegraphs: [flamegraph],
        canvasPoolManager: canvasPoolManager
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(sentry_components_profiling_flamegraphOptionsMenu__WEBPACK_IMPORTED_MODULE_2__.FlamegraphOptionsMenu, {
        canvasPoolManager: canvasPoolManager
      })]
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(_profilingFlamechartLayout__WEBPACK_IMPORTED_MODULE_23__.ProfilingFlamechartLayout, {
      minimap: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(sentry_components_profiling_flamegraphZoomViewMinimap__WEBPACK_IMPORTED_MODULE_7__.FlamegraphZoomViewMinimap, {
        canvasPoolManager: canvasPoolManager,
        flamegraph: flamegraph,
        flamegraphMiniMapCanvas: flamegraphMiniMapCanvas,
        flamegraphMiniMapCanvasRef: flamegraphMiniMapCanvasRef,
        flamegraphMiniMapOverlayCanvasRef: flamegraphMiniMapOverlayCanvasRef,
        flamegraphMiniMapView: flamegraphView,
        setFlamegraphMiniMapCanvasRef: setFlamegraphMiniMapCanvasRef,
        setFlamegraphMiniMapOverlayCanvasRef: setFlamegraphMiniMapOverlayCanvasRef
      }),
      flamechart: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsxs)(sentry_components_profiling_profileDragDropImport__WEBPACK_IMPORTED_MODULE_9__.ProfileDragDropImport, {
        onImport: props.onImport,
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(_FlamegraphWarnings__WEBPACK_IMPORTED_MODULE_22__.FlamegraphWarnings, {
          flamegraph: flamegraph
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(sentry_components_profiling_flamegraphZoomView__WEBPACK_IMPORTED_MODULE_6__.FlamegraphZoomView, {
          flamegraphRenderer: flamegraphRenderer,
          canvasBounds: canvasBounds,
          canvasPoolManager: canvasPoolManager,
          flamegraph: flamegraph,
          flamegraphCanvas: flamegraphCanvas,
          flamegraphCanvasRef: flamegraphCanvasRef,
          flamegraphOverlayCanvasRef: flamegraphOverlayCanvasRef,
          flamegraphView: flamegraphView,
          setFlamegraphCanvasRef: setFlamegraphCanvasRef,
          setFlamegraphOverlayCanvasRef: setFlamegraphOverlayCanvasRef
        })]
      }),
      frameStack: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_25__.jsx)(sentry_components_profiling_FrameStack_frameStack__WEBPACK_IMPORTED_MODULE_8__.FrameStack, {
        referenceNode: referenceNode,
        rootNodes: rootNodes,
        getFrameColor: getFrameColor,
        formatDuration: flamegraph ? flamegraph.formatter : noopFormatDuration,
        canvasPoolManager: canvasPoolManager
      })
    })]
  });
}

Flamegraph.displayName = "Flamegraph";


/***/ }),

/***/ "./app/components/profiling/flamegraphOptionsContextMenu.tsx":
/*!*******************************************************************!*\
  !*** ./app/components/profiling/flamegraphOptionsContextMenu.tsx ***!
  \*******************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "FlamegraphOptionsContextMenu": () => (/* binding */ FlamegraphOptionsContextMenu)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_profiling_flamegraph_useFlamegraphPreferences__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/utils/profiling/flamegraph/useFlamegraphPreferences */ "./app/utils/profiling/flamegraph/useFlamegraphPreferences.ts");
/* harmony import */ var _ProfilingContextMenu_profilingContextMenu__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ./ProfilingContextMenu/profilingContextMenu */ "./app/components/profiling/ProfilingContextMenu/profilingContextMenu.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");







const FLAMEGRAPH_COLOR_CODINGS = ['by symbol name', 'by system / application', 'by library', 'by recursion', 'by frequency'];
const FLAMEGRAPH_VIEW_OPTIONS = ['top down', 'bottom up'];
const FLAMEGRAPH_SORTING_OPTIONS = ['left heavy', 'call order'];
const FLAMEGRAPH_AXIS_OPTIONS = ['standalone', 'transaction'];
function FlamegraphOptionsContextMenu(props) {
  var _props$contextMenu$po, _props$contextMenu$po2, _props$contextMenu$po3, _props$contextMenu$po4, _props$contextMenu$co, _props$contextMenu$co2;

  const [preferences, dispatch] = (0,sentry_utils_profiling_flamegraph_useFlamegraphPreferences__WEBPACK_IMPORTED_MODULE_3__.useFlamegraphPreferences)();
  return props.contextMenu.open ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsxs)(react__WEBPACK_IMPORTED_MODULE_1__.Fragment, {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(_ProfilingContextMenu_profilingContextMenu__WEBPACK_IMPORTED_MODULE_4__.ProfilingContextMenuLayer, {
      onClick: () => props.contextMenu.setOpen(false)
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsxs)(_ProfilingContextMenu_profilingContextMenu__WEBPACK_IMPORTED_MODULE_4__.ProfilingContextMenu, { ...props.contextMenu.getMenuProps(),
      style: {
        position: 'absolute',
        left: (_props$contextMenu$po = (_props$contextMenu$po2 = props.contextMenu.position) === null || _props$contextMenu$po2 === void 0 ? void 0 : _props$contextMenu$po2.left) !== null && _props$contextMenu$po !== void 0 ? _props$contextMenu$po : -9999,
        top: (_props$contextMenu$po3 = (_props$contextMenu$po4 = props.contextMenu.position) === null || _props$contextMenu$po4 === void 0 ? void 0 : _props$contextMenu$po4.top) !== null && _props$contextMenu$po3 !== void 0 ? _props$contextMenu$po3 : -9999,
        maxHeight: (_props$contextMenu$co = (_props$contextMenu$co2 = props.contextMenu.containerCoordinates) === null || _props$contextMenu$co2 === void 0 ? void 0 : _props$contextMenu$co2.height) !== null && _props$contextMenu$co !== void 0 ? _props$contextMenu$co : 'auto'
      },
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsxs)(_ProfilingContextMenu_profilingContextMenu__WEBPACK_IMPORTED_MODULE_4__.ProfilingContextMenuGroup, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(_ProfilingContextMenu_profilingContextMenu__WEBPACK_IMPORTED_MODULE_4__.ProfilingContextMenuHeading, {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Color Coding')
        }), FLAMEGRAPH_COLOR_CODINGS.map((coding, idx) => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(_ProfilingContextMenu_profilingContextMenu__WEBPACK_IMPORTED_MODULE_4__.ProfilingContextMenuItemCheckbox, { ...props.contextMenu.getMenuItemProps(),
          onClick: () => dispatch({
            type: 'set color coding',
            payload: coding
          }),
          checked: preferences.colorCoding === coding,
          children: coding
        }, idx))]
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsxs)(_ProfilingContextMenu_profilingContextMenu__WEBPACK_IMPORTED_MODULE_4__.ProfilingContextMenuGroup, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(_ProfilingContextMenu_profilingContextMenu__WEBPACK_IMPORTED_MODULE_4__.ProfilingContextMenuHeading, {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('View')
        }), FLAMEGRAPH_VIEW_OPTIONS.map((view, idx) => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(_ProfilingContextMenu_profilingContextMenu__WEBPACK_IMPORTED_MODULE_4__.ProfilingContextMenuItemCheckbox, { ...props.contextMenu.getMenuItemProps(),
          onClick: () => dispatch({
            type: 'set view',
            payload: view
          }),
          checked: preferences.view === view,
          children: view
        }, idx))]
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsxs)(_ProfilingContextMenu_profilingContextMenu__WEBPACK_IMPORTED_MODULE_4__.ProfilingContextMenuGroup, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(_ProfilingContextMenu_profilingContextMenu__WEBPACK_IMPORTED_MODULE_4__.ProfilingContextMenuHeading, {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('Sorting')
        }), FLAMEGRAPH_SORTING_OPTIONS.map((sorting, idx) => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(_ProfilingContextMenu_profilingContextMenu__WEBPACK_IMPORTED_MODULE_4__.ProfilingContextMenuItemCheckbox, { ...props.contextMenu.getMenuItemProps(),
          onClick: () => dispatch({
            type: 'set sorting',
            payload: sorting
          }),
          checked: preferences.sorting === sorting,
          children: sorting
        }, idx))]
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsxs)(_ProfilingContextMenu_profilingContextMenu__WEBPACK_IMPORTED_MODULE_4__.ProfilingContextMenuGroup, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(_ProfilingContextMenu_profilingContextMenu__WEBPACK_IMPORTED_MODULE_4__.ProfilingContextMenuHeading, {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('X Axis')
        }), FLAMEGRAPH_AXIS_OPTIONS.map((axis, idx) => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(_ProfilingContextMenu_profilingContextMenu__WEBPACK_IMPORTED_MODULE_4__.ProfilingContextMenuItemCheckbox, { ...props.contextMenu.getMenuItemProps(),
          onClick: () => dispatch({
            type: 'set xAxis',
            payload: axis
          }),
          checked: preferences.xAxis === axis,
          children: axis
        }, idx))]
      })]
    })]
  }) : null;
}

/***/ }),

/***/ "./app/components/profiling/flamegraphOptionsMenu.tsx":
/*!************************************************************!*\
  !*** ./app/components/profiling/flamegraphOptionsMenu.tsx ***!
  \************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "FlamegraphOptionsMenu": () => (/* binding */ FlamegraphOptionsMenu)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_forms_compositeSelect__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/forms/compositeSelect */ "./app/components/forms/compositeSelect.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_profiling_flamegraph_useFlamegraphPreferences__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/utils/profiling/flamegraph/useFlamegraphPreferences */ "./app/utils/profiling/flamegraph/useFlamegraphPreferences.ts");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");










function FlamegraphOptionsMenu(_ref) {
  let {
    canvasPoolManager
  } = _ref;
  const [{
    colorCoding,
    xAxis
  }, dispatch] = (0,sentry_utils_profiling_flamegraph_useFlamegraphPreferences__WEBPACK_IMPORTED_MODULE_6__.useFlamegraphPreferences)();
  const options = (0,react__WEBPACK_IMPORTED_MODULE_1__.useMemo)(() => {
    return [{
      label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_5__.t)('X Axis'),
      value: 'x axis',
      defaultValue: xAxis,
      options: Object.entries(X_AXIS).map(_ref2 => {
        let [value, label] = _ref2;
        return {
          label,
          value
        };
      }),
      onChange: value => dispatch({
        type: 'set xAxis',
        payload: value
      })
    }, {
      label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_5__.t)('Color Coding'),
      value: 'by symbol name',
      defaultValue: colorCoding,
      options: Object.entries(COLOR_CODINGS).map(_ref3 => {
        let [value, label] = _ref3;
        return {
          label,
          value
        };
      }),
      onChange: value => dispatch({
        type: 'set color coding',
        payload: value
      })
    }]; // If we add color and xAxis it updates the memo and the component is re-rendered (losing hovered state)
    // Not ideal, but since we are only passing default value I guess we can live with it
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch]);
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsxs)(react__WEBPACK_IMPORTED_MODULE_1__.Fragment, {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_2__["default"], {
      size: "xs",
      onClick: () => canvasPoolManager.dispatch('reset zoom', []),
      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_5__.t)('Reset Zoom')
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(sentry_components_forms_compositeSelect__WEBPACK_IMPORTED_MODULE_3__["default"], {
      triggerLabel: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_5__.t)('Options'),
      triggerProps: {
        icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_4__.IconSliders, {
          size: "xs"
        }),
        size: 'xs'
      },
      placement: "bottom right",
      sections: options
    })]
  });
}

FlamegraphOptionsMenu.displayName = "FlamegraphOptionsMenu";
const X_AXIS = {
  standalone: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_5__.t)('Standalone'),
  transaction: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_5__.t)('Transaction')
};
const COLOR_CODINGS = {
  'by symbol name': (0,sentry_locale__WEBPACK_IMPORTED_MODULE_5__.t)('By Symbol Name'),
  'by library': (0,sentry_locale__WEBPACK_IMPORTED_MODULE_5__.t)('By Library'),
  'by system / application': (0,sentry_locale__WEBPACK_IMPORTED_MODULE_5__.t)('By System / Application'),
  'by recursion': (0,sentry_locale__WEBPACK_IMPORTED_MODULE_5__.t)('By Recursion'),
  'by frequency': (0,sentry_locale__WEBPACK_IMPORTED_MODULE_5__.t)('By Frequency')
};


/***/ }),

/***/ "./app/components/profiling/flamegraphSearch.tsx":
/*!*******************************************************!*\
  !*** ./app/components/profiling/flamegraphSearch.tsx ***!
  \*******************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "FlamegraphSearch": () => (/* binding */ FlamegraphSearch)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/es.error.cause.js */ "../node_modules/core-js/modules/es.error.cause.js");
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var core_js_modules_es_string_match_all_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! core-js/modules/es.string.match-all.js */ "../node_modules/core-js/modules/es.string.match-all.js");
/* harmony import */ var core_js_modules_es_string_match_all_js__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_string_match_all_js__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var _sentry_react__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! @sentry/react */ "../node_modules/@sentry/hub/esm/exports.js");
/* harmony import */ var fuse_js__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! fuse.js */ "../node_modules/fuse.js/dist/fuse.esm.js");
/* harmony import */ var sentry_components_searchBar__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/searchBar */ "./app/components/searchBar.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_profiling_flamegraph_useFlamegraphSearch__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/utils/profiling/flamegraph/useFlamegraphSearch */ "./app/utils/profiling/flamegraph/useFlamegraphSearch.ts");
/* harmony import */ var sentry_utils_profiling_flamegraphFrame__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/utils/profiling/flamegraphFrame */ "./app/utils/profiling/flamegraphFrame.tsx");
/* harmony import */ var sentry_utils_profiling_profile_utils__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/utils/profiling/profile/utils */ "./app/utils/profiling/profile/utils.tsx");
/* harmony import */ var sentry_utils_profiling_validators_regExp__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/utils/profiling/validators/regExp */ "./app/utils/profiling/validators/regExp.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");





function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }












function sortFrameResults(frames) {
  // If frames have the same start times, move frames with lower stack depth first.
  // This results in top down and left to right iteration
  return [...frames.values()].map(f => f.frame).sort((a, b) => a.start === b.start ? numericSort(a.depth, b.depth, 'asc') : numericSort(a.start, b.start, 'asc'));
}

function findBestMatchFromFuseMatches(matches) {
  let bestMatch = null;
  let bestMatchLength = 0;
  let bestMatchStart = -1;

  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];

    for (let j = 0; j < match.indices.length; j++) {
      const index = match.indices[j];
      const matchLength = index[1] - index[0];

      if (matchLength < 0) {
        // Fuse sometimes returns negative indices - we will just skip them for now.
        continue;
      } // We only override the match if the match is longer than the current best match
      // or if the matches are the same length, but the start is earlier in the string


      if (matchLength > bestMatchLength || matchLength === bestMatchLength && index[0] > bestMatchStart) {
        // Offset end by 1 else we are always trailing by 1 character.
        bestMatch = [index[0], index[1] + 1];
        bestMatchLength = matchLength;
        bestMatchStart = index[0];
      }
    }
  }

  return bestMatch;
}

function findBestMatchFromRegexpMatchArray(matches) {
  let bestMatch = null;
  let bestMatchLength = 0;
  let bestMatchStart = -1;

  for (let i = 0; i < matches.length; i++) {
    const index = matches[i].index;

    if (index === undefined) {
      continue;
    } // We only override the match if the match is longer than the current best match
    // or if the matches are the same length, but the start is earlier in the string


    if (matches[i].length > bestMatchLength || matches[i].length === bestMatchLength && index[0] > bestMatchStart) {
      bestMatch = [index, index + matches[i].length];
      bestMatchLength = matches[i].length;
      bestMatchStart = index;
    }
  }

  return bestMatch;
}

const memoizedSortFrameResults = (0,sentry_utils_profiling_profile_utils__WEBPACK_IMPORTED_MODULE_9__.memoizeByReference)(sortFrameResults);

function frameSearch(query, frames, index) {
  const results = new Map();

  if ((0,sentry_utils_profiling_validators_regExp__WEBPACK_IMPORTED_MODULE_10__.isRegExpString)(query)) {
    var _parseRegExp;

    const [_, lookup, flags] = (_parseRegExp = (0,sentry_utils_profiling_validators_regExp__WEBPACK_IMPORTED_MODULE_10__.parseRegExp)(query)) !== null && _parseRegExp !== void 0 ? _parseRegExp : [];
    let matches = 0;

    try {
      if (!lookup) {
        throw new Error('Invalid RegExp');
      }

      for (let i = 0; i < frames.length; i++) {
        const frame = frames[i];
        const re = new RegExp(lookup, flags !== null && flags !== void 0 ? flags : 'g');
        const reMatches = Array.from(frame.frame.name.trim().matchAll(re));
        const match = findBestMatchFromRegexpMatchArray(reMatches);

        if (match) {
          const frameId = (0,sentry_utils_profiling_flamegraphFrame__WEBPACK_IMPORTED_MODULE_8__.getFlamegraphFrameSearchId)(frame);
          results.set(frameId, {
            frame,
            match
          });
          matches += 1;
        }
      }
    } catch (e) {
      _sentry_react__WEBPACK_IMPORTED_MODULE_11__.captureMessage(e.message);
    }

    if (matches <= 0) {
      return results;
    }

    return results;
  }

  const fuseResults = index.search(query);

  if (fuseResults.length <= 0) {
    return results;
  }

  for (let i = 0; i < fuseResults.length; i++) {
    var _fuseFrameResult$matc;

    const fuseFrameResult = fuseResults[i];
    const frame = fuseFrameResult.item;
    const frameId = (0,sentry_utils_profiling_flamegraphFrame__WEBPACK_IMPORTED_MODULE_8__.getFlamegraphFrameSearchId)(frame);
    const match = findBestMatchFromFuseMatches((_fuseFrameResult$matc = fuseFrameResult.matches) !== null && _fuseFrameResult$matc !== void 0 ? _fuseFrameResult$matc : []);

    if (match) {
      results.set(frameId, {
        frame,
        match
      });
    }
  }

  return results;
}

const numericSort = (a, b, direction) => {
  if (a === b) {
    return 0;
  }

  if (a === null || a === undefined) {
    return 1;
  }

  if (b === null || b === undefined) {
    return -1;
  }

  return direction === 'asc' ? a - b : b - a;
};

function FlamegraphSearch(_ref) {
  let {
    flamegraphs,
    canvasPoolManager
  } = _ref;
  const [search, dispatchSearch] = (0,sentry_utils_profiling_flamegraph_useFlamegraphSearch__WEBPACK_IMPORTED_MODULE_7__.useFlamegraphSearch)();
  const [didInitialSearch, setDidInitialSearch] = (0,react__WEBPACK_IMPORTED_MODULE_4__.useState)(!search.query);
  const allFrames = (0,react__WEBPACK_IMPORTED_MODULE_4__.useMemo)(() => {
    if (Array.isArray(flamegraphs)) {
      return flamegraphs.reduce((acc, graph) => acc.concat(graph.frames), []);
    }

    return flamegraphs.frames;
  }, [flamegraphs]);
  const searchIndex = (0,react__WEBPACK_IMPORTED_MODULE_4__.useMemo)(() => {
    return new fuse_js__WEBPACK_IMPORTED_MODULE_12__["default"](allFrames, {
      keys: ['frame.name'],
      threshold: 0.3,
      includeMatches: true,
      findAllMatches: true,
      ignoreLocation: true
    });
  }, [allFrames]);
  const onZoomIntoFrame = (0,react__WEBPACK_IMPORTED_MODULE_4__.useCallback)(frame => {
    canvasPoolManager.dispatch('zoom at frame', [frame, 'min']);
    canvasPoolManager.dispatch('highlight frame', [frame, 'selected']);
  }, [canvasPoolManager]);
  (0,react__WEBPACK_IMPORTED_MODULE_4__.useEffect)(() => {
    if (typeof search.index !== 'number') {
      return;
    }

    const frames = memoizedSortFrameResults(search.results);

    if (frames[search.index]) {
      onZoomIntoFrame(frames[search.index]);
    }
  }, [search.results, search.index, onZoomIntoFrame]);
  const handleChange = (0,react__WEBPACK_IMPORTED_MODULE_4__.useCallback)(value => {
    if (!value) {
      dispatchSearch({
        type: 'clear search'
      });
      return;
    }

    dispatchSearch({
      type: 'set results',
      payload: {
        results: frameSearch(value, allFrames, searchIndex),
        query: value
      }
    });
  }, [dispatchSearch, allFrames, searchIndex]);
  (0,react__WEBPACK_IMPORTED_MODULE_4__.useEffect)(() => {
    if (didInitialSearch || allFrames.length === 0) {
      return;
    }

    handleChange(search.query);
    setDidInitialSearch(true);
  }, [didInitialSearch, handleChange, allFrames, search.query]);
  const onNextSearchClick = (0,react__WEBPACK_IMPORTED_MODULE_4__.useCallback)(() => {
    const frames = memoizedSortFrameResults(search.results);

    if (!frames.length) {
      return;
    }

    if (search.index === null || search.index === frames.length - 1) {
      dispatchSearch({
        type: 'set search index position',
        payload: 0
      });
      return;
    }

    dispatchSearch({
      type: 'set search index position',
      payload: search.index + 1
    });
  }, [search.results, search.index, dispatchSearch]);
  const onPreviousSearchClick = (0,react__WEBPACK_IMPORTED_MODULE_4__.useCallback)(() => {
    const frames = memoizedSortFrameResults(search.results);

    if (!frames.length) {
      return;
    }

    if (search.index === null || search.index === 0) {
      dispatchSearch({
        type: 'set search index position',
        payload: frames.length - 1
      });
      return;
    }

    dispatchSearch({
      type: 'set search index position',
      payload: search.index - 1
    });
  }, [search.results, search.index, dispatchSearch]);
  const handleKeyDown = (0,react__WEBPACK_IMPORTED_MODULE_4__.useCallback)(evt => {
    if (evt.key === 'ArrowDown') {
      evt.preventDefault();
      onNextSearchClick();
    } else if (evt.key === 'ArrowUp') {
      evt.preventDefault();
      onPreviousSearchClick();
    }
  }, [onNextSearchClick, onPreviousSearchClick]);
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(StyledSearchBar, {
    size: "xs",
    placeholder: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Find Frames'),
    query: search.query,
    onChange: handleChange,
    onKeyDown: handleKeyDown
  });
}

FlamegraphSearch.displayName = "FlamegraphSearch";

const StyledSearchBar = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_searchBar__WEBPACK_IMPORTED_MODULE_5__["default"],  true ? {
  target: "esleofq0"
} : 0)( true ? {
  name: "10h7o7i",
  styles: "flex:1 1 100%"
} : 0);



/***/ }),

/***/ "./app/components/profiling/flamegraphToolbar.tsx":
/*!********************************************************!*\
  !*** ./app/components/profiling/flamegraphToolbar.tsx ***!
  \********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "FlamegraphToolbar": () => (/* binding */ FlamegraphToolbar)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");


const FlamegraphToolbar = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "es1x3st0"
} : 0)("display:flex;justify-content:space-between;align-items:center;margin:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_1__["default"])(1), ";gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_1__["default"])(1), ";" + ( true ? "" : 0));

/***/ }),

/***/ "./app/components/profiling/flamegraphViewSelectMenu.tsx":
/*!***************************************************************!*\
  !*** ./app/components/profiling/flamegraphViewSelectMenu.tsx ***!
  \***************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "FlamegraphViewSelectMenu": () => (/* binding */ FlamegraphViewSelectMenu)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_buttonBar__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/buttonBar */ "./app/components/buttonBar.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");







function FlamegraphViewSelectMenu(_ref) {
  let {
    view,
    onViewChange,
    sorting,
    onSortingChange
  } = _ref;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)(react__WEBPACK_IMPORTED_MODULE_0__.Fragment, {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)(sentry_components_buttonBar__WEBPACK_IMPORTED_MODULE_2__["default"], {
      merged: true,
      active: sorting,
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_1__["default"], {
        barId: "call order",
        size: "xs",
        onClick: () => onSortingChange('call order'),
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Call Order')
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_1__["default"], {
        barId: "left heavy",
        size: "xs",
        onClick: () => onSortingChange('left heavy'),
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Left Heavy')
      })]
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)(sentry_components_buttonBar__WEBPACK_IMPORTED_MODULE_2__["default"], {
      merged: true,
      active: view,
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_1__["default"], {
        barId: "bottom up",
        size: "xs",
        onClick: () => onViewChange('bottom up'),
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Bottom Up')
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_1__["default"], {
        barId: "top down",
        size: "xs",
        onClick: () => onViewChange('top down'),
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Top Down')
      })]
    })]
  });
}

FlamegraphViewSelectMenu.displayName = "FlamegraphViewSelectMenu";


/***/ }),

/***/ "./app/components/profiling/flamegraphZoomView.tsx":
/*!*********************************************************!*\
  !*** ./app/components/profiling/flamegraphZoomView.tsx ***!
  \*********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "FlamegraphZoomView": () => (/* binding */ FlamegraphZoomView)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var gl_matrix__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! gl-matrix */ "../node_modules/gl-matrix/esm/vec2.js");
/* harmony import */ var gl_matrix__WEBPACK_IMPORTED_MODULE_20__ = __webpack_require__(/*! gl-matrix */ "../node_modules/gl-matrix/esm/mat3.js");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_profiling_canvasScheduler__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/utils/profiling/canvasScheduler */ "./app/utils/profiling/canvasScheduler.tsx");
/* harmony import */ var sentry_utils_profiling_flamegraph_useFlamegraphProfiles__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/utils/profiling/flamegraph/useFlamegraphProfiles */ "./app/utils/profiling/flamegraph/useFlamegraphProfiles.tsx");
/* harmony import */ var sentry_utils_profiling_flamegraph_useFlamegraphSearch__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/utils/profiling/flamegraph/useFlamegraphSearch */ "./app/utils/profiling/flamegraph/useFlamegraphSearch.ts");
/* harmony import */ var sentry_utils_profiling_flamegraph_useFlamegraphState__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/utils/profiling/flamegraph/useFlamegraphState */ "./app/utils/profiling/flamegraph/useFlamegraphState.ts");
/* harmony import */ var sentry_utils_profiling_flamegraph_useFlamegraphTheme__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/utils/profiling/flamegraph/useFlamegraphTheme */ "./app/utils/profiling/flamegraph/useFlamegraphTheme.ts");
/* harmony import */ var sentry_utils_profiling_gl_utils__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/utils/profiling/gl/utils */ "./app/utils/profiling/gl/utils.ts");
/* harmony import */ var sentry_utils_profiling_hooks_useContextMenu__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/utils/profiling/hooks/useContextMenu */ "./app/utils/profiling/hooks/useContextMenu.tsx");
/* harmony import */ var sentry_utils_profiling_hooks_useInternalFlamegraphDebugMode__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/utils/profiling/hooks/useInternalFlamegraphDebugMode */ "./app/utils/profiling/hooks/useInternalFlamegraphDebugMode.ts");
/* harmony import */ var sentry_utils_profiling_renderers_gridRenderer__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/utils/profiling/renderers/gridRenderer */ "./app/utils/profiling/renderers/gridRenderer.tsx");
/* harmony import */ var sentry_utils_profiling_renderers_sampleTickRenderer__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/utils/profiling/renderers/sampleTickRenderer */ "./app/utils/profiling/renderers/sampleTickRenderer.tsx");
/* harmony import */ var sentry_utils_profiling_renderers_selectedFrameRenderer__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/utils/profiling/renderers/selectedFrameRenderer */ "./app/utils/profiling/renderers/selectedFrameRenderer.tsx");
/* harmony import */ var sentry_utils_profiling_renderers_textRenderer__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/utils/profiling/renderers/textRenderer */ "./app/utils/profiling/renderers/textRenderer.tsx");
/* harmony import */ var sentry_utils_usePrevious__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/utils/usePrevious */ "./app/utils/usePrevious.tsx");
/* harmony import */ var _boundTooltip__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! ./boundTooltip */ "./app/components/profiling/boundTooltip.tsx");
/* harmony import */ var _flamegraphOptionsContextMenu__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! ./flamegraphOptionsContextMenu */ "./app/components/profiling/flamegraphOptionsContextMenu.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");



function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }






















function formatWeightToProfileDuration(frame, flamegraph) {
  return `(${Math.round(frame.totalWeight / flamegraph.profile.duration * 100)}%)`;
}

function FlamegraphZoomView(_ref) {
  var _hoveredNode$frame;

  let {
    canvasPoolManager,
    canvasBounds,
    flamegraphRenderer,
    flamegraph,
    flamegraphCanvas,
    flamegraphCanvasRef,
    flamegraphOverlayCanvasRef,
    flamegraphView,
    setFlamegraphCanvasRef,
    setFlamegraphOverlayCanvasRef
  } = _ref;
  const flamegraphTheme = (0,sentry_utils_profiling_flamegraph_useFlamegraphTheme__WEBPACK_IMPORTED_MODULE_8__.useFlamegraphTheme)();
  const [flamegraphProfile] = (0,sentry_utils_profiling_flamegraph_useFlamegraphProfiles__WEBPACK_IMPORTED_MODULE_5__.useFlamegraphProfiles)();
  const [flamegraphSearch] = (0,sentry_utils_profiling_flamegraph_useFlamegraphSearch__WEBPACK_IMPORTED_MODULE_6__.useFlamegraphSearch)();
  const isInternalFlamegraphDebugModeEnabled = (0,sentry_utils_profiling_hooks_useInternalFlamegraphDebugMode__WEBPACK_IMPORTED_MODULE_11__.useInternalFlamegraphDebugMode)();
  const [lastInteraction, setLastInteraction] = (0,react__WEBPACK_IMPORTED_MODULE_2__.useState)(null);
  const [dispatch, {
    previousState,
    nextState
  }] = (0,sentry_utils_profiling_flamegraph_useFlamegraphState__WEBPACK_IMPORTED_MODULE_7__.useDispatchFlamegraphState)();
  const scheduler = (0,react__WEBPACK_IMPORTED_MODULE_2__.useMemo)(() => new sentry_utils_profiling_canvasScheduler__WEBPACK_IMPORTED_MODULE_4__.CanvasScheduler(), []);
  const [flamegraphState, dispatchFlamegraphState] = (0,sentry_utils_profiling_flamegraph_useFlamegraphState__WEBPACK_IMPORTED_MODULE_7__.useFlamegraphState)();
  const [startPanVector, setStartPanVector] = (0,react__WEBPACK_IMPORTED_MODULE_2__.useState)(null);
  const [configSpaceCursor, setConfigSpaceCursor] = (0,react__WEBPACK_IMPORTED_MODULE_2__.useState)(null);
  const textRenderer = (0,react__WEBPACK_IMPORTED_MODULE_2__.useMemo)(() => {
    if (!flamegraphOverlayCanvasRef) {
      return null;
    }

    return new sentry_utils_profiling_renderers_textRenderer__WEBPACK_IMPORTED_MODULE_15__.TextRenderer(flamegraphOverlayCanvasRef, flamegraph, flamegraphTheme);
  }, [flamegraph, flamegraphOverlayCanvasRef, flamegraphTheme]);
  const gridRenderer = (0,react__WEBPACK_IMPORTED_MODULE_2__.useMemo)(() => {
    if (!flamegraphOverlayCanvasRef) {
      return null;
    }

    return new sentry_utils_profiling_renderers_gridRenderer__WEBPACK_IMPORTED_MODULE_12__.GridRenderer(flamegraphOverlayCanvasRef, flamegraphTheme, flamegraph.formatter);
  }, [flamegraphOverlayCanvasRef, flamegraph, flamegraphTheme]);
  const sampleTickRenderer = (0,react__WEBPACK_IMPORTED_MODULE_2__.useMemo)(() => {
    if (!isInternalFlamegraphDebugModeEnabled) {
      return null;
    }

    if (!flamegraphOverlayCanvasRef || !(flamegraphView !== null && flamegraphView !== void 0 && flamegraphView.configSpace)) {
      return null;
    }

    return new sentry_utils_profiling_renderers_sampleTickRenderer__WEBPACK_IMPORTED_MODULE_13__.SampleTickRenderer(flamegraphOverlayCanvasRef, flamegraph, flamegraphView.configSpace, flamegraphTheme);
  }, [isInternalFlamegraphDebugModeEnabled, flamegraphOverlayCanvasRef, flamegraph, flamegraphView === null || flamegraphView === void 0 ? void 0 : flamegraphView.configSpace, flamegraphTheme]);
  const selectedFrameRenderer = (0,react__WEBPACK_IMPORTED_MODULE_2__.useMemo)(() => {
    if (!flamegraphOverlayCanvasRef) {
      return null;
    }

    return new sentry_utils_profiling_renderers_selectedFrameRenderer__WEBPACK_IMPORTED_MODULE_14__.SelectedFrameRenderer(flamegraphOverlayCanvasRef);
  }, [flamegraphOverlayCanvasRef]);
  const hoveredNode = (0,react__WEBPACK_IMPORTED_MODULE_2__.useMemo)(() => {
    if (!configSpaceCursor || !flamegraphRenderer) {
      return null;
    }

    return flamegraphRenderer.getHoveredNode(configSpaceCursor);
  }, [configSpaceCursor, flamegraphRenderer]);
  const focusedRects = (0,react__WEBPACK_IMPORTED_MODULE_2__.useMemo)(() => {
    if (!flamegraphProfile.focusFrame) {
      return [];
    }

    const rects = [];
    const frames = [...flamegraph.root.children];

    while (frames.length > 0) {
      const frame = frames.pop();

      if (frame.frame.name === flamegraphProfile.focusFrame.name && frame.frame.image === flamegraphProfile.focusFrame.package) {
        rects.push(new sentry_utils_profiling_gl_utils__WEBPACK_IMPORTED_MODULE_9__.Rect(frame.start, frame.depth, frame.end - frame.start, 1));
      }

      for (let i = 0; i < frame.children.length; i++) {
        frames.push(frame.children[i]);
      }
    }

    return rects;
  }, [flamegraph, flamegraphProfile.focusFrame]);
  (0,react__WEBPACK_IMPORTED_MODULE_2__.useEffect)(() => {
    const onKeyDown = evt => {
      if (!flamegraphView) {
        return;
      }

      if (evt.key === 'z' && evt.metaKey) {
        const action = evt.shiftKey ? 'redo' : 'undo';

        if (action === 'undo') {
          var _previousState$positi;

          const previousPosition = previousState === null || previousState === void 0 ? void 0 : (_previousState$positi = previousState.position) === null || _previousState$positi === void 0 ? void 0 : _previousState$positi.view; // If previous position is empty, reset the view to it's max

          if (previousPosition !== null && previousPosition !== void 0 && previousPosition.isEmpty()) {
            canvasPoolManager.dispatch('reset zoom', []);
          } else if (previousPosition && !(previousPosition !== null && previousPosition !== void 0 && previousPosition.equals(flamegraphView.configView))) {
            // We need to always dispatch with the height of the current view,
            // because the height may have changed due to window resizing and
            // calling it with the old height may result in the flamegraph
            // being drawn into a very small or very large area.
            canvasPoolManager.dispatch('set config view', [previousPosition.withHeight(flamegraphView.configView.height)]);
          }
        }

        if (action === 'redo') {
          var _nextState$position;

          const nextPosition = nextState === null || nextState === void 0 ? void 0 : (_nextState$position = nextState.position) === null || _nextState$position === void 0 ? void 0 : _nextState$position.view;

          if (nextPosition && !nextPosition.equals(flamegraphView.configView)) {
            // We need to always dispatch with the height of the current view,
            // because the height may have changed due to window resizing and
            // calling it with the old height may result in the flamegraph
            // being drawn into a very small or very large area.
            canvasPoolManager.dispatch('set config view', [nextPosition.withHeight(flamegraphView.configView.height)]);
          }
        }

        dispatchFlamegraphState({
          type: action
        });
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [canvasPoolManager, dispatchFlamegraphState, nextState, previousState, flamegraphView]);
  const previousInteraction = (0,sentry_utils_usePrevious__WEBPACK_IMPORTED_MODULE_16__["default"])(lastInteraction);
  const beforeInteractionConfigView = (0,react__WEBPACK_IMPORTED_MODULE_2__.useRef)(null);
  (0,react__WEBPACK_IMPORTED_MODULE_2__.useEffect)(() => {
    if (!flamegraphView) {
      return;
    } // Check if we are starting a new interaction


    if (previousInteraction === null && lastInteraction) {
      beforeInteractionConfigView.current = flamegraphView.configView.clone();
      return;
    }

    if (beforeInteractionConfigView.current && !beforeInteractionConfigView.current.equals(flamegraphView.configView)) {
      dispatch({
        type: 'checkpoint',
        payload: flamegraphView.configView.clone()
      });
    }
  }, [dispatch, lastInteraction, previousInteraction, flamegraphView]);
  (0,react__WEBPACK_IMPORTED_MODULE_2__.useEffect)(() => {
    if (!flamegraphCanvas || !flamegraphView || !flamegraphRenderer) {
      return undefined;
    }

    const drawRectangles = () => {
      flamegraphRenderer.draw(flamegraphView.fromConfigView(flamegraphCanvas.physicalSpace), flamegraphState.search.results);
    };

    scheduler.registerBeforeFrameCallback(drawRectangles);
    scheduler.draw();
    return () => {
      scheduler.unregisterBeforeFrameCallback(drawRectangles);
    };
  }, [flamegraphCanvas, flamegraphRenderer, flamegraphState.search.results, scheduler, flamegraphView]);
  (0,react__WEBPACK_IMPORTED_MODULE_2__.useEffect)(() => {
    if (!flamegraphCanvas || !flamegraphView || !textRenderer || !gridRenderer) {
      return undefined;
    }

    const clearOverlayCanvas = () => {
      textRenderer.context.clearRect(0, 0, textRenderer.canvas.width, textRenderer.canvas.height);
    };

    const drawText = () => {
      textRenderer.draw(flamegraphView.configView, flamegraphView.fromConfigView(flamegraphCanvas.physicalSpace), flamegraphSearch.results);
    };

    const drawGrid = () => {
      gridRenderer.draw(flamegraphView.configView, flamegraphCanvas.physicalSpace, flamegraphView.fromConfigView(flamegraphCanvas.physicalSpace), flamegraphView.toConfigView(flamegraphCanvas.logicalSpace));
    };

    const drawInternalSampleTicks = () => {
      if (!sampleTickRenderer) {
        return;
      }

      sampleTickRenderer.draw(flamegraphView.fromConfigView(flamegraphCanvas.physicalSpace), flamegraphView.configView);
    };

    scheduler.registerBeforeFrameCallback(clearOverlayCanvas);
    scheduler.registerAfterFrameCallback(drawText);
    scheduler.registerAfterFrameCallback(drawGrid);
    scheduler.registerAfterFrameCallback(drawInternalSampleTicks);
    scheduler.draw();
    return () => {
      scheduler.unregisterBeforeFrameCallback(clearOverlayCanvas);
      scheduler.unregisterAfterFrameCallback(drawText);
      scheduler.unregisterAfterFrameCallback(drawGrid);
      scheduler.unregisterAfterFrameCallback(drawInternalSampleTicks);
    };
  }, [flamegraphCanvas, flamegraphView, scheduler, flamegraph, flamegraphTheme, textRenderer, gridRenderer, sampleTickRenderer, canvasPoolManager, flamegraphSearch]);
  (0,react__WEBPACK_IMPORTED_MODULE_2__.useEffect)(() => {
    if (!flamegraphCanvas || !flamegraphView || !selectedFrameRenderer) {
      return undefined;
    }

    const drawFocusedFrameBorder = () => {
      selectedFrameRenderer.draw(focusedRects, {
        BORDER_COLOR: flamegraphTheme.COLORS.FOCUSED_FRAME_BORDER_COLOR,
        BORDER_WIDTH: flamegraphTheme.SIZES.FOCUSED_FRAME_BORDER_WIDTH
      }, flamegraphView.fromConfigView(flamegraphCanvas.physicalSpace));
    };

    scheduler.registerAfterFrameCallback(drawFocusedFrameBorder);
    scheduler.draw();
    return () => {
      scheduler.unregisterAfterFrameCallback(drawFocusedFrameBorder);
    };
  }, [flamegraphCanvas, flamegraphView, flamegraphTheme, focusedRects, scheduler, selectedFrameRenderer]);
  (0,react__WEBPACK_IMPORTED_MODULE_2__.useEffect)(() => {
    if (!flamegraphCanvas || !flamegraphView || !selectedFrameRenderer) {
      return undefined;
    }

    const state = {
      selectedNode: null
    };

    const onNodeHighlight = (node, mode) => {
      if (mode === 'selected') {
        state.selectedNode = node;
      }

      scheduler.draw();
    };

    const drawSelectedFrameBorder = () => {
      if (state.selectedNode) {
        selectedFrameRenderer.draw([new sentry_utils_profiling_gl_utils__WEBPACK_IMPORTED_MODULE_9__.Rect(state.selectedNode.start, state.selectedNode.depth, state.selectedNode.end - state.selectedNode.start, 1)], {
          BORDER_COLOR: flamegraphTheme.COLORS.SELECTED_FRAME_BORDER_COLOR,
          BORDER_WIDTH: flamegraphTheme.SIZES.FRAME_BORDER_WIDTH
        }, flamegraphView.fromConfigView(flamegraphCanvas.physicalSpace));
      }
    };

    scheduler.on('highlight frame', onNodeHighlight);
    scheduler.registerAfterFrameCallback(drawSelectedFrameBorder);
    return () => {
      scheduler.off('highlight frame', onNodeHighlight);
      scheduler.unregisterAfterFrameCallback(drawSelectedFrameBorder);
    };
  }, [flamegraphView, flamegraphCanvas, scheduler, selectedFrameRenderer, flamegraphTheme]);
  (0,react__WEBPACK_IMPORTED_MODULE_2__.useEffect)(() => {
    if (!flamegraphCanvas || !flamegraphView || !selectedFrameRenderer) {
      return undefined;
    }

    const drawHoveredFrameBorder = () => {
      if (hoveredNode) {
        selectedFrameRenderer.draw([new sentry_utils_profiling_gl_utils__WEBPACK_IMPORTED_MODULE_9__.Rect(hoveredNode.start, hoveredNode.depth, hoveredNode.end - hoveredNode.start, 1)], {
          BORDER_COLOR: flamegraphTheme.COLORS.HOVERED_FRAME_BORDER_COLOR,
          BORDER_WIDTH: flamegraphTheme.SIZES.HOVERED_FRAME_BORDER_WIDTH
        }, flamegraphView.fromConfigView(flamegraphCanvas.physicalSpace));
      }
    };

    scheduler.registerAfterFrameCallback(drawHoveredFrameBorder);
    scheduler.draw();
    return () => {
      scheduler.unregisterAfterFrameCallback(drawHoveredFrameBorder);
    };
  }, [flamegraphView, flamegraphCanvas, scheduler, hoveredNode, selectedFrameRenderer, flamegraphTheme]);
  (0,react__WEBPACK_IMPORTED_MODULE_2__.useEffect)(() => {
    if (!flamegraphCanvas || !flamegraphView) {
      return undefined;
    }

    const onResetZoom = () => {
      setConfigSpaceCursor(null);
    };

    const onZoomIntoFrame = () => {
      setConfigSpaceCursor(null);
    };

    scheduler.on('reset zoom', onResetZoom);
    scheduler.on('zoom at frame', onZoomIntoFrame);
    return () => {
      scheduler.off('reset zoom', onResetZoom);
      scheduler.off('zoom at frame', onZoomIntoFrame);
    };
  }, [flamegraphCanvas, canvasPoolManager, dispatchFlamegraphState, scheduler, flamegraphView]);
  (0,react__WEBPACK_IMPORTED_MODULE_2__.useEffect)(() => {
    canvasPoolManager.registerScheduler(scheduler);
    return () => canvasPoolManager.unregisterScheduler(scheduler);
  }, [canvasPoolManager, scheduler]);
  const onCanvasMouseDown = (0,react__WEBPACK_IMPORTED_MODULE_2__.useCallback)(evt => {
    const logicalMousePos = gl_matrix__WEBPACK_IMPORTED_MODULE_19__.fromValues(evt.nativeEvent.offsetX, evt.nativeEvent.offsetY);
    const physicalMousePos = gl_matrix__WEBPACK_IMPORTED_MODULE_19__.scale(gl_matrix__WEBPACK_IMPORTED_MODULE_19__.create(), logicalMousePos, window.devicePixelRatio);
    setLastInteraction('click');
    setStartPanVector(physicalMousePos);
  }, []);
  const onCanvasMouseUp = (0,react__WEBPACK_IMPORTED_MODULE_2__.useCallback)(evt => {
    evt.preventDefault();
    evt.stopPropagation();

    if (!configSpaceCursor) {
      setLastInteraction(null);
      setStartPanVector(null);
      return;
    } // Only dispatch the zoom action if the new clicked node is not the same as the old selected node.
    // This essentially tracks double click action on a rectangle


    if (lastInteraction === 'click') {
      if (hoveredNode && flamegraphState.profiles.selectedRoot && hoveredNode === flamegraphState.profiles.selectedRoot) {
        // If double click is fired on a node, then zoom into it
        canvasPoolManager.dispatch('zoom at frame', [hoveredNode, 'exact']);
      }

      canvasPoolManager.dispatch('highlight frame', [hoveredNode, 'selected']);
      dispatchFlamegraphState({
        type: 'set selected root',
        payload: hoveredNode
      });
    }

    setLastInteraction(null);
    setStartPanVector(null);
  }, [configSpaceCursor, flamegraphState.profiles.selectedRoot, dispatchFlamegraphState, hoveredNode, canvasPoolManager, lastInteraction]);
  const onMouseDrag = (0,react__WEBPACK_IMPORTED_MODULE_2__.useCallback)(evt => {
    if (!flamegraphCanvas || !flamegraphView || !startPanVector) {
      return;
    }

    const logicalMousePos = gl_matrix__WEBPACK_IMPORTED_MODULE_19__.fromValues(evt.nativeEvent.offsetX, evt.nativeEvent.offsetY);
    const physicalMousePos = gl_matrix__WEBPACK_IMPORTED_MODULE_19__.scale(gl_matrix__WEBPACK_IMPORTED_MODULE_19__.create(), logicalMousePos, window.devicePixelRatio);
    const physicalDelta = gl_matrix__WEBPACK_IMPORTED_MODULE_19__.subtract(gl_matrix__WEBPACK_IMPORTED_MODULE_19__.create(), startPanVector, physicalMousePos);

    if (physicalDelta[0] === 0 && physicalDelta[1] === 0) {
      return;
    }

    const physicalToConfig = gl_matrix__WEBPACK_IMPORTED_MODULE_20__.invert(gl_matrix__WEBPACK_IMPORTED_MODULE_20__.create(), flamegraphView.fromConfigView(flamegraphCanvas.physicalSpace));
    const [m00, m01, m02, m10, m11, m12] = physicalToConfig;
    const configDelta = gl_matrix__WEBPACK_IMPORTED_MODULE_19__.transformMat3(gl_matrix__WEBPACK_IMPORTED_MODULE_19__.create(), physicalDelta, [m00, m01, m02, m10, m11, m12, 0, 0, 0]);
    canvasPoolManager.dispatch('transform config view', [gl_matrix__WEBPACK_IMPORTED_MODULE_20__.fromTranslation(gl_matrix__WEBPACK_IMPORTED_MODULE_20__.create(), configDelta)]);
    setStartPanVector(physicalMousePos);
  }, [flamegraphCanvas, flamegraphView, startPanVector, canvasPoolManager]);
  const onCanvasMouseMove = (0,react__WEBPACK_IMPORTED_MODULE_2__.useCallback)(evt => {
    if (!flamegraphCanvas || !flamegraphView) {
      return;
    }

    const configSpaceMouse = flamegraphView.getConfigViewCursor(gl_matrix__WEBPACK_IMPORTED_MODULE_19__.fromValues(evt.nativeEvent.offsetX, evt.nativeEvent.offsetY), flamegraphCanvas);
    setConfigSpaceCursor(configSpaceMouse);

    if (startPanVector) {
      onMouseDrag(evt);
      setLastInteraction('pan');
    } else {
      setLastInteraction(null);
    }
  }, [flamegraphCanvas, flamegraphView, setConfigSpaceCursor, onMouseDrag, startPanVector]);
  const onCanvasMouseLeave = (0,react__WEBPACK_IMPORTED_MODULE_2__.useCallback)(() => {
    setConfigSpaceCursor(null);
    setStartPanVector(null);
    setLastInteraction(null);
  }, []);
  const zoom = (0,react__WEBPACK_IMPORTED_MODULE_2__.useCallback)(evt => {
    if (!flamegraphCanvas || !flamegraphView) {
      return;
    }

    const identity = gl_matrix__WEBPACK_IMPORTED_MODULE_20__.identity(gl_matrix__WEBPACK_IMPORTED_MODULE_20__.create());
    const scale = 1 - evt.deltaY * 0.01 * -1; // -1 to invert scale

    const mouseInConfigView = flamegraphView.getConfigViewCursor(gl_matrix__WEBPACK_IMPORTED_MODULE_19__.fromValues(evt.offsetX, evt.offsetY), flamegraphCanvas);
    const configCenter = gl_matrix__WEBPACK_IMPORTED_MODULE_19__.fromValues(mouseInConfigView[0], flamegraphView.configView.y);
    const invertedConfigCenter = gl_matrix__WEBPACK_IMPORTED_MODULE_19__.multiply(gl_matrix__WEBPACK_IMPORTED_MODULE_19__.create(), gl_matrix__WEBPACK_IMPORTED_MODULE_19__.fromValues(-1, -1), configCenter);
    const translated = gl_matrix__WEBPACK_IMPORTED_MODULE_20__.translate(gl_matrix__WEBPACK_IMPORTED_MODULE_20__.create(), identity, configCenter);
    const scaled = gl_matrix__WEBPACK_IMPORTED_MODULE_20__.scale(gl_matrix__WEBPACK_IMPORTED_MODULE_20__.create(), translated, gl_matrix__WEBPACK_IMPORTED_MODULE_19__.fromValues(scale, 1));
    const translatedBack = gl_matrix__WEBPACK_IMPORTED_MODULE_20__.translate(gl_matrix__WEBPACK_IMPORTED_MODULE_20__.create(), scaled, invertedConfigCenter);
    canvasPoolManager.dispatch('transform config view', [translatedBack]);
  }, [flamegraphCanvas, flamegraphView, canvasPoolManager]);
  const scroll = (0,react__WEBPACK_IMPORTED_MODULE_2__.useCallback)(evt => {
    if (!flamegraphCanvas || !flamegraphView) {
      return;
    }

    const physicalDelta = gl_matrix__WEBPACK_IMPORTED_MODULE_19__.fromValues(evt.deltaX, evt.deltaY);
    const physicalToConfig = gl_matrix__WEBPACK_IMPORTED_MODULE_20__.invert(gl_matrix__WEBPACK_IMPORTED_MODULE_20__.create(), flamegraphView.fromConfigView(flamegraphCanvas.physicalSpace));
    const [m00, m01, m02, m10, m11, m12] = physicalToConfig;
    const configDelta = gl_matrix__WEBPACK_IMPORTED_MODULE_19__.transformMat3(gl_matrix__WEBPACK_IMPORTED_MODULE_19__.create(), physicalDelta, [m00, m01, m02, m10, m11, m12, 0, 0, 0]);
    const translate = gl_matrix__WEBPACK_IMPORTED_MODULE_20__.fromTranslation(gl_matrix__WEBPACK_IMPORTED_MODULE_20__.create(), configDelta);
    canvasPoolManager.dispatch('transform config view', [translate]);
  }, [flamegraphCanvas, flamegraphView, canvasPoolManager]);
  (0,react__WEBPACK_IMPORTED_MODULE_2__.useEffect)(() => {
    if (!flamegraphCanvasRef) {
      return undefined;
    }

    let wheelStopTimeoutId;

    function onCanvasWheel(evt) {
      window.clearTimeout(wheelStopTimeoutId);
      wheelStopTimeoutId = window.setTimeout(() => {
        setLastInteraction(null);
      }, 300);
      evt.preventDefault(); // When we zoom, we want to clear cursor so that any tooltips
      // rendered on the flamegraph are removed from the flamegraphView

      setConfigSpaceCursor(null); // pinch to zoom is recognized as `ctrlKey + wheelEvent`

      if (evt.metaKey || evt.ctrlKey) {
        zoom(evt);
        setLastInteraction('zoom');
      } else {
        scroll(evt);
        setLastInteraction('scroll');
      }
    }

    flamegraphCanvasRef.addEventListener('wheel', onCanvasWheel);
    return () => {
      window.clearTimeout(wheelStopTimeoutId);
      flamegraphCanvasRef.removeEventListener('wheel', onCanvasWheel);
    };
  }, [flamegraphCanvasRef, zoom, scroll]);
  const contextMenu = (0,sentry_utils_profiling_hooks_useContextMenu__WEBPACK_IMPORTED_MODULE_10__.useContextMenu)({
    container: flamegraphCanvasRef
  });
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxs)(CanvasContainer, {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__.jsx)(Canvas, {
      ref: canvas => setFlamegraphCanvasRef(canvas),
      onMouseDown: onCanvasMouseDown,
      onMouseUp: onCanvasMouseUp,
      onMouseMove: onCanvasMouseMove,
      onMouseLeave: onCanvasMouseLeave,
      onContextMenu: contextMenu.handleContextMenu,
      style: {
        cursor: lastInteraction === 'pan' ? 'grab' : 'default'
      }
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__.jsx)(Canvas, {
      ref: canvas => setFlamegraphOverlayCanvasRef(canvas),
      style: {
        pointerEvents: 'none'
      }
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__.jsx)(_flamegraphOptionsContextMenu__WEBPACK_IMPORTED_MODULE_18__.FlamegraphOptionsContextMenu, {
      contextMenu: contextMenu
    }), flamegraphCanvas && flamegraphRenderer && flamegraphView && configSpaceCursor && hoveredNode !== null && hoveredNode !== void 0 && (_hoveredNode$frame = hoveredNode.frame) !== null && _hoveredNode$frame !== void 0 && _hoveredNode$frame.name ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxs)(_boundTooltip__WEBPACK_IMPORTED_MODULE_17__.BoundTooltip, {
      bounds: canvasBounds,
      cursor: configSpaceCursor,
      flamegraphCanvas: flamegraphCanvas,
      flamegraphView: flamegraphView,
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxs)(HoveredFrameMainInfo, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__.jsx)(FrameColorIndicator, {
          backgroundColor: (0,sentry_utils_profiling_gl_utils__WEBPACK_IMPORTED_MODULE_9__.formatColorForFrame)(hoveredNode, flamegraphRenderer)
        }), flamegraphRenderer.flamegraph.formatter(hoveredNode.node.totalWeight), ' ', formatWeightToProfileDuration(hoveredNode.node, flamegraphRenderer.flamegraph), ' ', hoveredNode.frame.name]
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxs)(HoveredFrameTimelineInfo, {
        children: [flamegraphRenderer.flamegraph.timelineFormatter(hoveredNode.start), ' ', ' \u2014 ', flamegraphRenderer.flamegraph.timelineFormatter(hoveredNode.end)]
      })]
    }) : null]
  });
}

FlamegraphZoomView.displayName = "FlamegraphZoomView";

const HoveredFrameTimelineInfo = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1k891b74"
} : 0)("color:", p => p.theme.subText, ";" + ( true ? "" : 0));

const HoveredFrameMainInfo = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1k891b73"
} : 0)( true ? {
  name: "s5xdrg",
  styles: "display:flex;align-items:center"
} : 0);

const FrameColorIndicator = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1k891b72"
} : 0)("width:12px;height:12px;min-width:12px;min-height:12px;border-radius:2px;display:inline-block;background-color:", p => p.backgroundColor, ";margin-right:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_3__["default"])(1), ";" + ( true ? "" : 0));

const CanvasContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1k891b71"
} : 0)( true ? {
  name: "1e6ma8a",
  styles: "display:flex;flex-direction:column;height:100%;position:relative"
} : 0);

const Canvas = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('canvas',  true ? {
  target: "e1k891b70"
} : 0)( true ? {
  name: "yfg64d",
  styles: "left:0;top:0;width:100%;height:100%;user-select:none;position:absolute"
} : 0);



/***/ }),

/***/ "./app/components/profiling/flamegraphZoomViewMinimap.tsx":
/*!****************************************************************!*\
  !*** ./app/components/profiling/flamegraphZoomViewMinimap.tsx ***!
  \****************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "FlamegraphZoomViewMinimap": () => (/* binding */ FlamegraphZoomViewMinimap)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var gl_matrix__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! gl-matrix */ "../node_modules/gl-matrix/esm/vec2.js");
/* harmony import */ var gl_matrix__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! gl-matrix */ "../node_modules/gl-matrix/esm/mat3.js");
/* harmony import */ var sentry_utils_profiling_canvasScheduler__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/utils/profiling/canvasScheduler */ "./app/utils/profiling/canvasScheduler.tsx");
/* harmony import */ var sentry_utils_profiling_flamegraph_useFlamegraphState__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/utils/profiling/flamegraph/useFlamegraphState */ "./app/utils/profiling/flamegraph/useFlamegraphState.ts");
/* harmony import */ var sentry_utils_profiling_flamegraph_useFlamegraphTheme__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/utils/profiling/flamegraph/useFlamegraphTheme */ "./app/utils/profiling/flamegraph/useFlamegraphTheme.ts");
/* harmony import */ var sentry_utils_profiling_gl_utils__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/utils/profiling/gl/utils */ "./app/utils/profiling/gl/utils.ts");
/* harmony import */ var sentry_utils_profiling_renderers_flamegraphRenderer__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/utils/profiling/renderers/flamegraphRenderer */ "./app/utils/profiling/renderers/flamegraphRenderer.tsx");
/* harmony import */ var sentry_utils_profiling_renderers_positionIndicatorRenderer__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/utils/profiling/renderers/positionIndicatorRenderer */ "./app/utils/profiling/renderers/positionIndicatorRenderer.tsx");
/* harmony import */ var sentry_utils_usePrevious__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/utils/usePrevious */ "./app/utils/usePrevious.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");



function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }













function FlamegraphZoomViewMinimap(_ref) {
  let {
    canvasPoolManager,
    flamegraph,
    flamegraphMiniMapCanvas,
    flamegraphMiniMapCanvasRef,
    flamegraphMiniMapOverlayCanvasRef,
    flamegraphMiniMapView,
    setFlamegraphMiniMapCanvasRef,
    setFlamegraphMiniMapOverlayCanvasRef
  } = _ref;
  const flamegraphTheme = (0,sentry_utils_profiling_flamegraph_useFlamegraphTheme__WEBPACK_IMPORTED_MODULE_5__.useFlamegraphTheme)();
  const [lastInteraction, setLastInteraction] = (0,react__WEBPACK_IMPORTED_MODULE_2__.useState)(null);
  const [dispatch] = (0,sentry_utils_profiling_flamegraph_useFlamegraphState__WEBPACK_IMPORTED_MODULE_4__.useDispatchFlamegraphState)();
  const [configSpaceCursor, setConfigSpaceCursor] = (0,react__WEBPACK_IMPORTED_MODULE_2__.useState)(null);
  const scheduler = (0,react__WEBPACK_IMPORTED_MODULE_2__.useMemo)(() => new sentry_utils_profiling_canvasScheduler__WEBPACK_IMPORTED_MODULE_3__.CanvasScheduler(), []);
  const flamegraphMiniMapRenderer = (0,react__WEBPACK_IMPORTED_MODULE_2__.useMemo)(() => {
    if (!flamegraphMiniMapCanvasRef) {
      return null;
    }

    const BAR_HEIGHT = flamegraphTheme.SIZES.MINIMAP_HEIGHT / (flamegraph.depth + flamegraphTheme.SIZES.FLAMEGRAPH_DEPTH_OFFSET);
    return new sentry_utils_profiling_renderers_flamegraphRenderer__WEBPACK_IMPORTED_MODULE_7__.FlamegraphRenderer(flamegraphMiniMapCanvasRef, flamegraph, { ...flamegraphTheme,
      SIZES: { ...flamegraphTheme.SIZES,
        BAR_HEIGHT
      }
    });
  }, [flamegraph, flamegraphMiniMapCanvasRef, flamegraphTheme]);
  const positionIndicatorRenderer = (0,react__WEBPACK_IMPORTED_MODULE_2__.useMemo)(() => {
    if (!flamegraphMiniMapOverlayCanvasRef) {
      return null;
    }

    return new sentry_utils_profiling_renderers_positionIndicatorRenderer__WEBPACK_IMPORTED_MODULE_8__.PositionIndicatorRenderer(flamegraphMiniMapOverlayCanvasRef, flamegraphTheme);
  }, [flamegraphMiniMapOverlayCanvasRef, flamegraphTheme]);
  (0,react__WEBPACK_IMPORTED_MODULE_2__.useEffect)(() => {
    if (!flamegraphMiniMapCanvas || !flamegraphMiniMapView || !flamegraphMiniMapRenderer) {
      return undefined;
    }

    const drawRectangles = () => {
      flamegraphMiniMapRenderer.draw(flamegraphMiniMapView.fromConfigSpace(flamegraphMiniMapCanvas.physicalSpace), new Map());
    };

    scheduler.registerBeforeFrameCallback(drawRectangles);
    return () => {
      scheduler.unregisterBeforeFrameCallback(drawRectangles);
    };
  }, [flamegraphMiniMapCanvas, flamegraphMiniMapRenderer, scheduler, flamegraphMiniMapView]);
  (0,react__WEBPACK_IMPORTED_MODULE_2__.useEffect)(() => {
    if (!flamegraphMiniMapCanvas || !flamegraphMiniMapView || !positionIndicatorRenderer) {
      return undefined;
    }

    const clearOverlayCanvas = () => {
      positionIndicatorRenderer.context.clearRect(0, 0, positionIndicatorRenderer.canvas.width, positionIndicatorRenderer.canvas.height);
    };

    const drawPosition = () => {
      positionIndicatorRenderer.draw(flamegraphMiniMapView.configView, flamegraphMiniMapView.configSpace, flamegraphMiniMapView.fromConfigSpace(flamegraphMiniMapCanvas.physicalSpace));
    };

    scheduler.registerBeforeFrameCallback(clearOverlayCanvas);
    scheduler.registerAfterFrameCallback(drawPosition);
    scheduler.draw();
    return () => {
      scheduler.unregisterBeforeFrameCallback(clearOverlayCanvas);
      scheduler.unregisterAfterFrameCallback(drawPosition);
    };
  }, [flamegraphMiniMapCanvas, flamegraphMiniMapView, scheduler, positionIndicatorRenderer]);
  const previousInteraction = (0,sentry_utils_usePrevious__WEBPACK_IMPORTED_MODULE_9__["default"])(lastInteraction);
  const beforeInteractionConfigView = (0,react__WEBPACK_IMPORTED_MODULE_2__.useRef)(null);
  (0,react__WEBPACK_IMPORTED_MODULE_2__.useEffect)(() => {
    if (!flamegraphMiniMapView) {
      return;
    } // Check if we are starting a new interaction


    if (previousInteraction === null && lastInteraction) {
      beforeInteractionConfigView.current = flamegraphMiniMapView.configView.clone();
      return;
    }

    if (beforeInteractionConfigView.current && !beforeInteractionConfigView.current.equals(flamegraphMiniMapView.configView)) {
      dispatch({
        type: 'checkpoint',
        payload: flamegraphMiniMapView.configView.clone()
      });
    }
  }, [lastInteraction, flamegraphMiniMapView, dispatch, previousInteraction]);
  const [startDragVector, setStartDragConfigSpaceCursor] = (0,react__WEBPACK_IMPORTED_MODULE_2__.useState)(null);
  const [lastDragVector, setLastDragVector] = (0,react__WEBPACK_IMPORTED_MODULE_2__.useState)(null);
  (0,react__WEBPACK_IMPORTED_MODULE_2__.useEffect)(() => {
    canvasPoolManager.registerScheduler(scheduler);
    return () => canvasPoolManager.unregisterScheduler(scheduler);
  }, [scheduler, canvasPoolManager]);
  const onMouseDrag = (0,react__WEBPACK_IMPORTED_MODULE_2__.useCallback)(evt => {
    if (!lastDragVector || !flamegraphMiniMapCanvas || !flamegraphMiniMapView) {
      return;
    }

    const logicalMousePos = gl_matrix__WEBPACK_IMPORTED_MODULE_10__.fromValues(evt.nativeEvent.offsetX, evt.nativeEvent.offsetY);
    const physicalMousePos = gl_matrix__WEBPACK_IMPORTED_MODULE_10__.scale(gl_matrix__WEBPACK_IMPORTED_MODULE_10__.create(), logicalMousePos, window.devicePixelRatio);
    const physicalDelta = gl_matrix__WEBPACK_IMPORTED_MODULE_10__.subtract(gl_matrix__WEBPACK_IMPORTED_MODULE_10__.create(), physicalMousePos, lastDragVector);

    if (physicalDelta[0] === 0 && physicalDelta[1] === 0) {
      return;
    }

    const physicalToConfig = gl_matrix__WEBPACK_IMPORTED_MODULE_11__.invert(gl_matrix__WEBPACK_IMPORTED_MODULE_11__.create(), flamegraphMiniMapView.fromConfigSpace(flamegraphMiniMapCanvas.physicalSpace));
    const configDelta = gl_matrix__WEBPACK_IMPORTED_MODULE_10__.transformMat3(gl_matrix__WEBPACK_IMPORTED_MODULE_10__.create(), physicalDelta, physicalToConfig);
    canvasPoolManager.dispatch('transform config view', [gl_matrix__WEBPACK_IMPORTED_MODULE_11__.fromTranslation(gl_matrix__WEBPACK_IMPORTED_MODULE_11__.create(), configDelta)]);
    setLastDragVector(physicalMousePos);
  }, [flamegraphMiniMapCanvas, flamegraphMiniMapView, lastDragVector, canvasPoolManager]);
  const onMinimapCanvasMouseMove = (0,react__WEBPACK_IMPORTED_MODULE_2__.useCallback)(evt => {
    if (!flamegraphMiniMapCanvas || !flamegraphMiniMapView) {
      return;
    }

    const configSpaceMouse = flamegraphMiniMapView.getConfigSpaceCursor(gl_matrix__WEBPACK_IMPORTED_MODULE_10__.fromValues(evt.nativeEvent.offsetX, evt.nativeEvent.offsetY), flamegraphMiniMapCanvas);
    setConfigSpaceCursor(configSpaceMouse);

    if (lastDragVector) {
      onMouseDrag(evt);
      setLastInteraction('pan');
      return;
    }

    if (startDragVector) {
      const start = gl_matrix__WEBPACK_IMPORTED_MODULE_10__.min(gl_matrix__WEBPACK_IMPORTED_MODULE_10__.create(), startDragVector, configSpaceMouse);
      const end = gl_matrix__WEBPACK_IMPORTED_MODULE_10__.max(gl_matrix__WEBPACK_IMPORTED_MODULE_10__.create(), startDragVector, configSpaceMouse);
      const rect = new sentry_utils_profiling_gl_utils__WEBPACK_IMPORTED_MODULE_6__.Rect(start[0], configSpaceMouse[1] - flamegraphMiniMapView.configView.height / 2, end[0] - start[0], flamegraphMiniMapView.configView.height);
      canvasPoolManager.dispatch('set config view', [rect]);
      setLastInteraction('select');
      return;
    }

    setLastInteraction(null);
  }, [flamegraphMiniMapCanvas, flamegraphMiniMapView, canvasPoolManager, lastDragVector, onMouseDrag, startDragVector]);
  const onMinimapScroll = (0,react__WEBPACK_IMPORTED_MODULE_2__.useCallback)(evt => {
    if (!flamegraphMiniMapCanvas || !flamegraphMiniMapView) {
      return;
    }

    {
      const physicalDelta = gl_matrix__WEBPACK_IMPORTED_MODULE_10__.fromValues(evt.deltaX * 0.8, evt.deltaY);
      const physicalToConfig = gl_matrix__WEBPACK_IMPORTED_MODULE_11__.invert(gl_matrix__WEBPACK_IMPORTED_MODULE_11__.create(), flamegraphMiniMapView.fromConfigView(flamegraphMiniMapCanvas.physicalSpace));
      const [m00, m01, m02, m10, m11, m12] = physicalToConfig;
      const configDelta = gl_matrix__WEBPACK_IMPORTED_MODULE_10__.transformMat3(gl_matrix__WEBPACK_IMPORTED_MODULE_10__.create(), physicalDelta, [m00, m01, m02, m10, m11, m12, 0, 0, 0]);
      const translate = gl_matrix__WEBPACK_IMPORTED_MODULE_11__.fromTranslation(gl_matrix__WEBPACK_IMPORTED_MODULE_11__.create(), configDelta);
      canvasPoolManager.dispatch('transform config view', [translate]);
    }
  }, [flamegraphMiniMapCanvas, flamegraphMiniMapView, canvasPoolManager]);
  const onMinimapZoom = (0,react__WEBPACK_IMPORTED_MODULE_2__.useCallback)(evt => {
    if (!flamegraphMiniMapCanvas || !flamegraphMiniMapView) {
      return;
    }

    const identity = gl_matrix__WEBPACK_IMPORTED_MODULE_11__.identity(gl_matrix__WEBPACK_IMPORTED_MODULE_11__.create());
    const scale = 1 - evt.deltaY * 0.001 * -1; // -1 to invert scale

    const mouseInConfigSpace = flamegraphMiniMapView.getConfigSpaceCursor(gl_matrix__WEBPACK_IMPORTED_MODULE_10__.fromValues(evt.offsetX, evt.offsetY), flamegraphMiniMapCanvas);
    const configCenter = gl_matrix__WEBPACK_IMPORTED_MODULE_10__.fromValues(mouseInConfigSpace[0], flamegraphMiniMapView.configView.y);
    const invertedConfigCenter = gl_matrix__WEBPACK_IMPORTED_MODULE_10__.multiply(gl_matrix__WEBPACK_IMPORTED_MODULE_10__.create(), gl_matrix__WEBPACK_IMPORTED_MODULE_10__.fromValues(-1, -1), configCenter);
    const translated = gl_matrix__WEBPACK_IMPORTED_MODULE_11__.translate(gl_matrix__WEBPACK_IMPORTED_MODULE_11__.create(), identity, configCenter);
    const scaled = gl_matrix__WEBPACK_IMPORTED_MODULE_11__.scale(gl_matrix__WEBPACK_IMPORTED_MODULE_11__.create(), translated, gl_matrix__WEBPACK_IMPORTED_MODULE_10__.fromValues(scale, 1));
    const translatedBack = gl_matrix__WEBPACK_IMPORTED_MODULE_11__.translate(gl_matrix__WEBPACK_IMPORTED_MODULE_11__.create(), scaled, invertedConfigCenter);
    canvasPoolManager.dispatch('transform config view', [translatedBack]);
  }, [flamegraphMiniMapCanvas, flamegraphMiniMapView, canvasPoolManager]);
  const onMinimapCanvasMouseDown = (0,react__WEBPACK_IMPORTED_MODULE_2__.useCallback)(evt => {
    if (!configSpaceCursor || !flamegraphMiniMapCanvas || !flamegraphMiniMapView || !canvasPoolManager) {
      return;
    }

    const logicalMousePos = gl_matrix__WEBPACK_IMPORTED_MODULE_10__.fromValues(evt.nativeEvent.offsetX, evt.nativeEvent.offsetY);
    const physicalMousePos = gl_matrix__WEBPACK_IMPORTED_MODULE_10__.scale(gl_matrix__WEBPACK_IMPORTED_MODULE_10__.create(), logicalMousePos, window.devicePixelRatio);

    if (flamegraphMiniMapView.configView.contains(configSpaceCursor)) {
      setLastDragVector(physicalMousePos);
    } else {
      const startConfigSpaceCursor = flamegraphMiniMapView.getConfigSpaceCursor(gl_matrix__WEBPACK_IMPORTED_MODULE_10__.fromValues(evt.nativeEvent.offsetX, evt.nativeEvent.offsetY), flamegraphMiniMapCanvas);
      setStartDragConfigSpaceCursor(startConfigSpaceCursor);
    }

    setLastInteraction('select');
  }, [configSpaceCursor, flamegraphMiniMapCanvas, flamegraphMiniMapView, canvasPoolManager]);
  const onMinimapCanvasMouseUp = (0,react__WEBPACK_IMPORTED_MODULE_2__.useCallback)(() => {
    setConfigSpaceCursor(null);
    setStartDragConfigSpaceCursor(null);
    setLastDragVector(null);
    setLastInteraction(null);
  }, []);
  (0,react__WEBPACK_IMPORTED_MODULE_2__.useEffect)(() => {
    if (!flamegraphMiniMapCanvasRef) {
      return undefined;
    }

    let wheelStopTimeoutId;

    function onCanvasWheel(evt) {
      window.clearTimeout(wheelStopTimeoutId);
      wheelStopTimeoutId = window.setTimeout(() => {
        setLastInteraction(null);
      }, 300);
      evt.preventDefault(); // When we zoom, we want to clear cursor so that any tooltips
      // rendered on the flamegraph are removed from the view

      setConfigSpaceCursor(null);

      if (evt.metaKey || evt.ctrlKey) {
        onMinimapZoom(evt);
        setLastInteraction('zoom');
      } else {
        onMinimapScroll(evt);
        setLastInteraction('scroll');
      }
    }

    flamegraphMiniMapCanvasRef.addEventListener('wheel', onCanvasWheel);
    return () => {
      window.clearTimeout(wheelStopTimeoutId);
      flamegraphMiniMapCanvasRef.removeEventListener('wheel', onCanvasWheel);
    };
  }, [flamegraphMiniMapCanvasRef, onMinimapZoom, onMinimapScroll]);
  (0,react__WEBPACK_IMPORTED_MODULE_2__.useEffect)(() => {
    window.addEventListener('mouseup', onMinimapCanvasMouseUp);
    return () => {
      window.removeEventListener('mouseup', onMinimapCanvasMouseUp);
    };
  }, [onMinimapCanvasMouseUp]);
  (0,react__WEBPACK_IMPORTED_MODULE_2__.useEffect)(() => {
    if (!flamegraphMiniMapCanvasRef) {
      return undefined;
    }

    const onCanvasWheel = evt => {
      evt.preventDefault();
      const isZoom = evt.metaKey; // @TODO figure out what key to use for other platforms

      if (isZoom) {
        onMinimapZoom(evt);
      } else {
        onMinimapScroll(evt);
      }
    };

    flamegraphMiniMapCanvasRef.addEventListener('wheel', onCanvasWheel);
    return () => flamegraphMiniMapCanvasRef === null || flamegraphMiniMapCanvasRef === void 0 ? void 0 : flamegraphMiniMapCanvasRef.removeEventListener('wheel', onCanvasWheel);
  }, [flamegraphMiniMapCanvasRef, onMinimapScroll, onMinimapZoom]);
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsxs)(react__WEBPACK_IMPORTED_MODULE_2__.Fragment, {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(Canvas, {
      ref: c => setFlamegraphMiniMapCanvasRef(c),
      onMouseDown: onMinimapCanvasMouseDown,
      onMouseMove: onMinimapCanvasMouseMove,
      onMouseLeave: onMinimapCanvasMouseUp,
      cursor: configSpaceCursor && flamegraphMiniMapView !== null && flamegraphMiniMapView !== void 0 && flamegraphMiniMapView.configView.contains(configSpaceCursor) ? 'grab' : 'col-resize'
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(OverlayCanvas, {
      ref: c => setFlamegraphMiniMapOverlayCanvasRef(c)
    })]
  });
}

FlamegraphZoomViewMinimap.displayName = "FlamegraphZoomViewMinimap";

const Canvas = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('canvas',  true ? {
  target: "eakt0gn1"
} : 0)("width:100%;height:100%;position:absolute;left:0;top:0;cursor:", props => {
  var _props$cursor;

  return (_props$cursor = props.cursor) !== null && _props$cursor !== void 0 ? _props$cursor : 'default';
}, ";user-select:none;" + ( true ? "" : 0));

const OverlayCanvas = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(Canvas,  true ? {
  target: "eakt0gn0"
} : 0)( true ? {
  name: "je8g23",
  styles: "pointer-events:none"
} : 0);



/***/ }),

/***/ "./app/components/profiling/profileDragDropImport.tsx":
/*!************************************************************!*\
  !*** ./app/components/profiling/profileDragDropImport.tsx ***!
  \************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "ProfileDragDropImport": () => (/* binding */ ProfileDragDropImport)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_profiling_flamegraph_flamegraphTheme__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/utils/profiling/flamegraph/flamegraphTheme */ "./app/utils/profiling/flamegraph/flamegraphTheme.tsx");
/* harmony import */ var sentry_utils_profiling_profile_importProfile__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/utils/profiling/profile/importProfile */ "./app/utils/profiling/profile/importProfile.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");



function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }









function ProfileDragDropImport(_ref) {
  let {
    onImport,
    children
  } = _ref;
  const [dropState, setDropState] = (0,react__WEBPACK_IMPORTED_MODULE_2__.useState)('idle');
  const [errorMessage, setErrorMessage] = (0,react__WEBPACK_IMPORTED_MODULE_2__.useState)(null);
  const onDrop = (0,react__WEBPACK_IMPORTED_MODULE_2__.useCallback)(evt => {
    evt.preventDefault();
    evt.stopPropagation();
    const file = evt.dataTransfer.items[0].getAsFile();

    if (file) {
      setDropState('processing');
      (0,sentry_utils_profiling_profile_importProfile__WEBPACK_IMPORTED_MODULE_6__.importDroppedProfile)(file).then(profile => {
        setDropState('idle');
        setErrorMessage(null);
        onImport(profile);
      }).catch(e => {
        setDropState('errored');
        setErrorMessage(e.message);
      });
    }
  }, [onImport]);
  const onDragEnter = (0,react__WEBPACK_IMPORTED_MODULE_2__.useCallback)(evt => {
    evt.preventDefault();
    evt.stopPropagation();
    setDropState('dragover');
  }, []);
  const onDragLeave = (0,react__WEBPACK_IMPORTED_MODULE_2__.useCallback)(evt => {
    evt.preventDefault();
    evt.stopPropagation();
    setDropState('idle');
  }, []); // This is required to indicate that onDrop is supported on this element

  const onDragOver = (0,react__WEBPACK_IMPORTED_MODULE_2__.useCallback)(evt => {
    evt.preventDefault();
  }, []);
  const onDismiss = (0,react__WEBPACK_IMPORTED_MODULE_2__.useCallback)(() => {
    setDropState('idle');
    setErrorMessage(null);
  }, []);
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsxs)(DragDropContainer, {
    onDragEnter: onDragEnter,
    children: [dropState === 'idle' ? null : dropState === 'errored' ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsxs)(Overlay, {
      children: [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Failed to import profile with error'), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)("p", {
        children: errorMessage
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)("div", {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_3__["default"], {
          onClick: onDismiss,
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Dismiss')
        })
      })]
    }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(Overlay, {
      onDrop: onDrop,
      onDragOver: onDragOver,
      onDragLeave: onDragLeave,
      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Drop profile here')
    }), children]
  });
}

ProfileDragDropImport.displayName = "ProfileDragDropImport";

const DragDropContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "etzd2mc1"
} : 0)( true ? {
  name: "1g8mdzl",
  styles: "display:flex;flex-direction:column;flex:1 1 100%"
} : 0);

const Overlay = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "etzd2mc0"
} : 0)("position:absolute;left:0;bottom:0;width:100%;height:calc(100% - ", sentry_utils_profiling_flamegraph_flamegraphTheme__WEBPACK_IMPORTED_MODULE_5__.LightFlamegraphTheme.SIZES.TIMELINE_HEIGHT, "px);display:grid;grid:auto/50%;place-content:center;z-index:", p => p.theme.zIndex.modal, ";text-align:center;background-color:", p => p.theme.surface100, ";" + ( true ? "" : 0));



/***/ }),

/***/ "./app/components/profiling/profilingFlamechartLayout.tsx":
/*!****************************************************************!*\
  !*** ./app/components/profiling/profilingFlamechartLayout.tsx ***!
  \****************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "ProfilingFlamechartLayout": () => (/* binding */ ProfilingFlamechartLayout)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_utils_profiling_flamegraph_useFlamegraphPreferences__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/utils/profiling/flamegraph/useFlamegraphPreferences */ "./app/utils/profiling/flamegraph/useFlamegraphPreferences.ts");
/* harmony import */ var sentry_utils_profiling_flamegraph_useFlamegraphTheme__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/utils/profiling/flamegraph/useFlamegraphTheme */ "./app/utils/profiling/flamegraph/useFlamegraphTheme.ts");
/* harmony import */ var sentry_utils_profiling_hooks_useResizableDrawer__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/utils/profiling/hooks/useResizableDrawer */ "./app/utils/profiling/hooks/useResizableDrawer.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }




 // 664px is approximately the width where we start to scroll inside
// 30px is the min height to where the drawer can still be resized



const MIN_FRAMESTACK_DIMENSIONS = [664, 30];
function ProfilingFlamechartLayout(props) {
  const flamegraphTheme = (0,sentry_utils_profiling_flamegraph_useFlamegraphTheme__WEBPACK_IMPORTED_MODULE_3__.useFlamegraphTheme)();
  const {
    layout
  } = (0,sentry_utils_profiling_flamegraph_useFlamegraphPreferences__WEBPACK_IMPORTED_MODULE_2__.useFlamegraphPreferencesValue)();
  const frameStackRef = (0,react__WEBPACK_IMPORTED_MODULE_1__.useRef)(null);
  const resizableOptions = (0,react__WEBPACK_IMPORTED_MODULE_1__.useMemo)(() => {
    const initialDimensions = [// Half the screen minus the ~sidebar width
    window.innerWidth * 0.5 - 220, (flamegraphTheme.SIZES.FLAMEGRAPH_DEPTH_OFFSET + 2) * flamegraphTheme.SIZES.BAR_HEIGHT];

    const onResize = newDimensions => {
      if (!frameStackRef.current) {
        return;
      }

      if (layout === 'table left' || layout === 'table right') {
        frameStackRef.current.style.width = `${newDimensions[0]}px`;
        frameStackRef.current.style.height = `100%`;
      } else {
        frameStackRef.current.style.height = `${newDimensions[1]}px`;
        frameStackRef.current.style.width = `100%`;
      }
    };

    return {
      initialDimensions,
      onResize,
      direction: layout === 'table left' ? 'horizontal-ltr' : layout === 'table right' ? 'horizontal-rtl' : 'vertical',
      min: MIN_FRAMESTACK_DIMENSIONS
    };
  }, [flamegraphTheme.SIZES.FLAMEGRAPH_DEPTH_OFFSET, flamegraphTheme.SIZES.BAR_HEIGHT, layout]);
  const {
    onMouseDown
  } = (0,sentry_utils_profiling_hooks_useResizableDrawer__WEBPACK_IMPORTED_MODULE_4__.useResizableDrawer)(resizableOptions);
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(ProfilingFlamechartLayoutContainer, {
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsxs)(ProfilingFlamechartGrid, {
      layout: layout,
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(MinimapContainer, {
        height: flamegraphTheme.SIZES.MINIMAP_HEIGHT,
        children: props.minimap
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(ZoomViewContainer, {
        children: props.flamechart
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(FrameStackContainer, {
        ref: frameStackRef,
        layout: layout,
        children: /*#__PURE__*/(0,react__WEBPACK_IMPORTED_MODULE_1__.cloneElement)(props.frameStack, {
          onResize: onMouseDown
        })
      })]
    })
  });
}
ProfilingFlamechartLayout.displayName = "ProfilingFlamechartLayout";

const ProfilingFlamechartLayoutContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1s2y9m34"
} : 0)( true ? {
  name: "b3e968",
  styles: "display:flex;flex:1 1 100%"
} : 0);

const ProfilingFlamechartGrid = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1s2y9m33"
} : 0)("display:grid;width:100%;grid-template-rows:", _ref => {
  let {
    layout
  } = _ref;
  return layout === 'table bottom' ? 'auto 1fr' : layout === 'table right' ? '100px auto' : '100px auto';
}, ";grid-template-columns:", _ref2 => {
  let {
    layout
  } = _ref2;
  return layout === 'table bottom' ? '100%' : layout === 'table left' ? `min-content auto` : `auto min-content`;
}, ";grid-template-areas:", _ref3 => {
  let {
    layout
  } = _ref3;
  return layout === 'table bottom' ? `
        'minimap'
        'flamegraph'
        'frame-stack'
        ` : layout === 'table right' ? `
        'minimap    frame-stack'
        'flamegraph frame-stack'
      ` : layout === 'table left' ? `
        'frame-stack minimap'
        'frame-stack flamegraph'
    ` : '';
}, ";" + ( true ? "" : 0));

const MinimapContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1s2y9m32"
} : 0)("position:relative;height:", p => p.height, "px;grid-area:minimap;" + ( true ? "" : 0));

const ZoomViewContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1s2y9m31"
} : 0)( true ? {
  name: "1cno8ik",
  styles: "display:flex;flex-direction:column;flex:1 1 100%;grid-area:flamegraph;position:relative"
} : 0);

const FrameStackContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1s2y9m30"
} : 0)("grid-area:frame-stack;position:relative;overflow:auto;min-width:", MIN_FRAMESTACK_DIMENSIONS[0], "px;>div{position:absolute;left:0;top:0;width:100%;height:100%;}" + ( true ? "" : 0));

/***/ }),

/***/ "./app/components/profiling/threadSelector.tsx":
/*!*****************************************************!*\
  !*** ./app/components/profiling/threadSelector.tsx ***!
  \*****************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "ThreadMenuSelector": () => (/* binding */ ThreadMenuSelector)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_forms_compactSelect__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/forms/compactSelect */ "./app/components/forms/compactSelect.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");
/* harmony import */ var sentry_utils_profiling_units_units__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/utils/profiling/units/units */ "./app/utils/profiling/units/units.ts");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");













function ThreadMenuSelector(_ref) {
  let {
    threadId,
    onThreadIdChange,
    profileGroup
  } = _ref;
  const options = (0,react__WEBPACK_IMPORTED_MODULE_3__.useMemo)(() => {
    return [...profileGroup.profiles].sort(compareProfiles).map(profile => ({
      label: profile.name ? `tid (${profile.threadId}): ${profile.name}` : `tid (${profile.threadId})`,
      value: profile.threadId,
      details: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(ThreadLabelDetails, {
        duration: (0,sentry_utils_profiling_units_units__WEBPACK_IMPORTED_MODULE_9__.makeFormatter)(profile.unit)(profile.duration),
        samples: profile.samples.length
      })
    }));
  }, [profileGroup]);
  const handleChange = (0,react__WEBPACK_IMPORTED_MODULE_3__.useCallback)(opt => {
    if ((0,sentry_utils__WEBPACK_IMPORTED_MODULE_8__.defined)(opt)) {
      onThreadIdChange(opt.value);
    }
  }, [onThreadIdChange]);
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(sentry_components_forms_compactSelect__WEBPACK_IMPORTED_MODULE_4__["default"], {
    triggerProps: {
      icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_5__.IconList, {
        size: "xs"
      }),
      size: 'xs'
    },
    options: options,
    value: threadId,
    onChange: handleChange,
    isSearchable: true
  });
}

ThreadMenuSelector.displayName = "ThreadMenuSelector";

function ThreadLabelDetails(props) {
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsxs)(DetailsContainer, {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)("div", {
      children: props.duration
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)("div", {
      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.tn)('%s sample', '%s samples', props.samples)
    })]
  });
}

ThreadLabelDetails.displayName = "ThreadLabelDetails";

function compareProfiles(a, b) {
  if (!b.duration) {
    return -1;
  }

  if (!a.duration) {
    return 1;
  }

  if (a.name.startsWith('(tid') && b.name.startsWith('(tid')) {
    return -1;
  }

  if (a.name.startsWith('(tid')) {
    return -1;
  }

  if (b.name.startsWith('(tid')) {
    return -1;
  }

  if (a.name.includes('main')) {
    return -1;
  }

  if (b.name.includes('main')) {
    return 1;
  }

  return a.name > b.name ? -1 : 1;
}

const DetailsContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "esj78ii0"
} : 0)("display:flex;flex-direction:row;justify-content:space-between;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_7__["default"])(1), ";" + ( true ? "" : 0));



/***/ }),

/***/ "./app/utils/profiling/canvasScheduler.tsx":
/*!*************************************************!*\
  !*** ./app/utils/profiling/canvasScheduler.tsx ***!
  \*************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "CanvasPoolManager": () => (/* binding */ CanvasPoolManager),
/* harmony export */   "CanvasScheduler": () => (/* binding */ CanvasScheduler)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);


class CanvasScheduler {
  constructor() {
    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "beforeFrameCallbacks", new Set());

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "afterFrameCallbacks", new Set());

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "onDisposeCallbacks", new Set());

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "requestAnimationFrame", null);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "events", {
      ['reset zoom']: new Set(),
      ['highlight frame']: new Set(),
      ['set config view']: new Set(),
      ['transform config view']: new Set(),
      ['zoom at frame']: new Set()
    });
  }

  onDispose(cb) {
    if (this.onDisposeCallbacks.has(cb)) {
      return;
    }

    this.onDisposeCallbacks.add(cb);
  }

  on(eventName, cb) {
    const set = this.events[eventName];

    if (set.has(cb)) {
      return;
    }

    set.add(cb);
  }

  off(eventName, cb) {
    const set = this.events[eventName];

    if (set.has(cb)) {
      set.delete(cb);
    }
  }

  dispatch(event) {
    for (var _len = arguments.length, args = new Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
      args[_key - 1] = arguments[_key];
    }

    for (const handler of this.events[event]) {
      // @ts-ignore
      handler(...args);
    }
  }

  registerCallback(cb, pool) {
    if (pool.has(cb)) {
      return;
    }

    pool.add(cb);
  }

  unregisterCallback(cb, pool) {
    if (pool.has(cb)) {
      pool.delete(cb);
    }
  }

  registerBeforeFrameCallback(cb) {
    this.registerCallback(cb, this.beforeFrameCallbacks);
  }

  unregisterBeforeFrameCallback(cb) {
    this.unregisterCallback(cb, this.beforeFrameCallbacks);
  }

  registerAfterFrameCallback(cb) {
    this.registerCallback(cb, this.afterFrameCallbacks);
  }

  unregisterAfterFrameCallback(cb) {
    this.unregisterCallback(cb, this.afterFrameCallbacks);
  }

  dispose() {
    for (const cb of this.onDisposeCallbacks) {
      this.onDisposeCallbacks.delete(cb);
      cb();
    }

    for (const type in this.events) {
      this.events[type].clear();
    }
  }

  drawSync() {
    for (const cb of this.beforeFrameCallbacks) {
      cb();
    }

    for (const cb of this.afterFrameCallbacks) {
      cb();
    }
  }

  draw() {
    if (this.requestAnimationFrame) {
      window.cancelAnimationFrame(this.requestAnimationFrame);
    }

    this.requestAnimationFrame = window.requestAnimationFrame(() => {
      for (const cb of this.beforeFrameCallbacks) {
        cb();
      }

      for (const cb of this.afterFrameCallbacks) {
        cb();
      }

      this.requestAnimationFrame = null;
    });
  }

}
class CanvasPoolManager {
  constructor() {
    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "schedulers", new Set());
  }

  registerScheduler(scheduler) {
    if (this.schedulers.has(scheduler)) {
      return;
    }

    this.schedulers.add(scheduler);
  }

  dispatch(event, args) {
    for (const scheduler of this.schedulers) {
      scheduler.dispatch(event, ...args);
    }
  }

  unregisterScheduler(scheduler) {
    if (this.schedulers.has(scheduler)) {
      scheduler.dispose();
      this.schedulers.delete(scheduler);
    }
  }

  drawSync() {
    for (const scheduler of this.schedulers) {
      scheduler.drawSync();
    }
  }

  draw() {
    for (const scheduler of this.schedulers) {
      scheduler.draw();
    }
  }

}

/***/ }),

/***/ "./app/utils/profiling/colors/utils.tsx":
/*!**********************************************!*\
  !*** ./app/utils/profiling/colors/utils.tsx ***!
  \**********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "clamp": () => (/* binding */ clamp),
/* harmony export */   "defaultFrameSortKey": () => (/* binding */ defaultFrameSortKey),
/* harmony export */   "fract": () => (/* binding */ fract),
/* harmony export */   "fromLumaChromaHue": () => (/* binding */ fromLumaChromaHue),
/* harmony export */   "isNumber": () => (/* binding */ isNumber),
/* harmony export */   "makeColorBucketTheme": () => (/* binding */ makeColorBucketTheme),
/* harmony export */   "makeColorMap": () => (/* binding */ makeColorMap),
/* harmony export */   "makeColorMapByFrequency": () => (/* binding */ makeColorMapByFrequency),
/* harmony export */   "makeColorMapByImage": () => (/* binding */ makeColorMapByImage),
/* harmony export */   "makeColorMapByRecursion": () => (/* binding */ makeColorMapByRecursion),
/* harmony export */   "makeColorMapBySystemVsApplication": () => (/* binding */ makeColorMapBySystemVsApplication),
/* harmony export */   "makeStackToColor": () => (/* binding */ makeStackToColor),
/* harmony export */   "toRGBAString": () => (/* binding */ toRGBAString),
/* harmony export */   "triangle": () => (/* binding */ triangle)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/es.error.cause.js */ "../node_modules/core-js/modules/es.error.cause.js");
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_1__);



const uniqueBy = (arr, predicate) => {
  const cb = typeof predicate === 'function' ? predicate : o => o[predicate];
  return [...arr.reduce((map, item) => {
    const key = item === null || item === undefined ? item : cb(item);

    if (key === undefined || key === null) {
      return map;
    }

    map.has(key) || map.set(key, item);
    return map;
  }, new Map()).values()];
}; // These were taken from speedscope, originally described in
// https://en.wikipedia.org/wiki/HSL_and_HSV#From_luma/chroma/hue


const fract = x => x - Math.floor(x);
const triangle = x => 2.0 * Math.abs(fract(x) - 0.5) - 1.0;
function fromLumaChromaHue(L, C, H) {
  const hPrime = H / 60;
  const X = C * (1 - Math.abs(hPrime % 2 - 1));
  const [R1, G1, B1] = hPrime < 1 ? [C, X, 0] : hPrime < 2 ? [X, C, 0] : hPrime < 3 ? [0, C, X] : hPrime < 4 ? [0, X, C] : hPrime < 5 ? [X, 0, C] : [C, 0, X];
  const m = L - (0.3 * R1 + 0.59 * G1 + 0.11 * B1);
  return [clamp(R1 + m, 0, 1), clamp(G1 + m, 0, 1), clamp(B1 + m, 0, 1.0)];
}
const makeStackToColor = fallback => {
  return (frames, colorMap, colorBucket) => {
    const colors = colorMap(frames, colorBucket);
    const length = frames.length; // Length * number of frames * color components

    const colorBuffer = new Array(length * 4 * 6);

    for (let index = 0; index < length; index++) {
      const c = colors.get(frames[index].key);
      const colorWithAlpha = c ? c.concat(1) : fallback;

      for (let i = 0; i < 6; i++) {
        const offset = index * 6 * 4 + i * 4;
        colorBuffer[offset] = colorWithAlpha[0];
        colorBuffer[offset + 1] = colorWithAlpha[1];
        colorBuffer[offset + 2] = colorWithAlpha[2];
        colorBuffer[offset + 3] = colorWithAlpha[3];
      }
    }

    return {
      colorBuffer,
      colorMap: colors
    };
  };
};
const isNumber = input => {
  return typeof input === 'number' && !isNaN(input);
};
function clamp(number, min, max) {
  if (!isNumber(min) && !isNumber(max)) {
    throw new Error('Clamp requires at least a min or max parameter');
  }

  if (isNumber(min) && isNumber(max)) {
    return number < min ? min : number > max ? max : number;
  }

  if (isNumber(max)) {
    return number > max ? max : number;
  }

  if (isNumber(min)) {
    return number < min ? min : number;
  }

  throw new Error('Unreachable case detected');
}
function toRGBAString(r, g, b, alpha) {
  return `rgba(${clamp(r * 255, 0, 255)}, ${clamp(g * 255, 0, 255)}, ${clamp(b * 255, 0, 255)}, ${alpha})`;
}
function defaultFrameSortKey(frame) {
  return frame.frame.name + (frame.frame.image || '');
}

function defaultFrameSort(a, b) {
  return defaultFrameSortKey(a) > defaultFrameSortKey(b) ? 1 : -1;
}

const makeColorBucketTheme = lch => {
  return t => {
    const x = triangle(30.0 * t);
    const H = 360.0 * (0.9 * t);
    const C = lch.C_0 + lch.C_d * x;
    const L = lch.L_0 - lch.L_d * x;
    return fromLumaChromaHue(L, C, H);
  };
};
const makeColorMap = function (frames, colorBucket) {
  let sortBy = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : defaultFrameSort;
  const colors = new Map();
  const sortedFrames = [...frames].sort(sortBy);
  const uniqueFrames = uniqueBy(frames, f => f.frame.name + f.frame.image);
  const colorsByName = new Map();

  for (let i = 0; i < sortedFrames.length; i++) {
    var _ref;

    const frame = sortedFrames[i];
    const nameKey = (_ref = frame.frame.name + frame.frame.image) !== null && _ref !== void 0 ? _ref : '';

    if (!colorsByName.has(nameKey)) {
      const color = colorBucket(Math.floor(255 * i / uniqueFrames.length) / 256, frame.frame);
      colorsByName.set(nameKey, color);
    }

    colors.set(frame.key, colorsByName.get(nameKey));
  }

  return colors;
};
const makeColorMapByRecursion = (frames, colorBucket) => {
  const colors = new Map();
  const sortedFrames = [...frames].sort((a, b) => a.frame.name.localeCompare(b.frame.name)).filter(f => f.node.isRecursive());
  const colorsByName = new Map();

  for (let i = 0; i < sortedFrames.length; i++) {
    var _ref2;

    const frame = sortedFrames[i];
    const nameKey = (_ref2 = frame.frame.name + frame.frame.image) !== null && _ref2 !== void 0 ? _ref2 : '';

    if (!colorsByName.has(nameKey)) {
      const color = colorBucket(Math.floor(255 * i / sortedFrames.length) / 256, frame.frame);
      colorsByName.set(nameKey, color);
    }

    colors.set(frame.key, colorsByName.get(nameKey));
  }

  return colors;
};
const makeColorMapByImage = (frames, colorBucket) => {
  const colors = new Map();
  const reverseFrameToImageIndex = {};
  const uniqueFrames = uniqueBy(frames, f => f.frame.image);
  const sortedFrames = [...uniqueFrames].sort((a, b) => {
    var _a$frame$image, _b$frame$image;

    return ((_a$frame$image = a.frame.image) !== null && _a$frame$image !== void 0 ? _a$frame$image : '') > ((_b$frame$image = b.frame.image) !== null && _b$frame$image !== void 0 ? _b$frame$image : '') ? 1 : -1;
  });

  for (let i = 0; i < frames.length; i++) {
    var _frame$frame$image;

    const frame = frames[i];
    const key = (_frame$frame$image = frame.frame.image) !== null && _frame$frame$image !== void 0 ? _frame$frame$image : '';

    if (!reverseFrameToImageIndex[key]) {
      reverseFrameToImageIndex[key] = [];
    }

    reverseFrameToImageIndex[key].push(frame);
  }

  for (let i = 0; i < sortedFrames.length; i++) {
    var _sortedFrames$i$frame, _sortedFrames$i, _sortedFrames$i$frame2;

    const imageFrames = reverseFrameToImageIndex[(_sortedFrames$i$frame = (_sortedFrames$i = sortedFrames[i]) === null || _sortedFrames$i === void 0 ? void 0 : (_sortedFrames$i$frame2 = _sortedFrames$i.frame) === null || _sortedFrames$i$frame2 === void 0 ? void 0 : _sortedFrames$i$frame2.image) !== null && _sortedFrames$i$frame !== void 0 ? _sortedFrames$i$frame : ''];

    for (let j = 0; j < imageFrames.length; j++) {
      colors.set(imageFrames[j].key, colorBucket(Math.floor(255 * i / sortedFrames.length) / 256, imageFrames[j].frame));
    }
  }

  return colors;
};
const makeColorMapBySystemVsApplication = (frames, colorBucket) => {
  const colors = new Map();

  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i];

    if (frame.frame.is_application) {
      colors.set(frame.key, colorBucket(0.7, frame.frame));
      continue;
    }

    colors.set(frame.key, colorBucket(0.09, frame.frame));
  }

  return colors;
};
const makeColorMapByFrequency = (frames, colorBucket) => {
  let max = 0;
  const countMap = new Map();
  const colors = new Map();

  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i];
    const key = frame.frame.name + frame.frame.image;

    if (!countMap.has(key)) {
      countMap.set(key, 0);
    }

    const previousCount = countMap.get(key);
    countMap.set(key, previousCount + 1);
    max = Math.max(max, previousCount + 1);
  }

  for (let i = 0; i < frames.length; i++) {
    const key = frames[i].frame.name + frames[i].frame.image;
    const count = countMap.get(key);
    const [r, g, b] = colorBucket(0.7, frames[i].frame);
    const color = [r, g, b, Math.max(count / max, 0.1)];
    colors.set(frames[i].key, color);
  }

  return colors;
};

/***/ }),

/***/ "./app/utils/profiling/filterFlamegraphTree.tsx":
/*!******************************************************!*\
  !*** ./app/utils/profiling/filterFlamegraphTree.tsx ***!
  \******************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "filterFlamegraphTree": () => (/* binding */ filterFlamegraphTree)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);

// Utility fn to filter a tree.
// The filtering is done in two steps - the first step marks nodes
// that should be kept in the tree. The second step iterates over all of the
// nodes that should be kept in the tree and finds their new parent nodes
// by walking up the node.parent reference chain and checking if the parent
// is in the set of nodes that should be kept.
// A tiny but important implementation details is that we only need to find every node's
// first new parent and not all of the parents. That is because we rely on insertion order
// of nodesToKeep (dfs). This effectively means that when a node is marked as kept, all of
// it's parent nodes have already been considered and exist in our new tree.
function filterFlamegraphTree(roots, skipFn) {
  const stack = [];
  const nodesToKeep = new Map(); // dfs to find nodes we want to keep.
  // Iteration order is important because we want to keep the order of the
  // original tree which allows us to rebuild it starting from the root.

  for (const root of roots) {
    stack.push(root);

    while (stack.length > 0) {
      const node = stack.pop();

      if (!node) {
        continue;
      } // If this is not a skippable node, add it to the set


      if (!skipFn(node)) {
        nodesToKeep.set(node.key, node);
      } // enqueue children


      for (let i = 0; i < node.children.length; i++) {
        stack.push(node.children[node.children.length - i - 1]);
      }
    }
  } // Rebuild the tree by iterating over the nodes we want to keep and
  // finding a new parent for each node.


  const tree = [];
  const nodes = new Map();

  for (const node of nodesToKeep.values()) {
    // We clear the children when we create a copy so we dont carry
    // over nodes that were not meant to be kept.
    const cpy = { ...node,
      children: []
    }; // Find the first parent that we are not supposed to skip

    let parent = node.parent; // While we have a parent and while that parent is not a node we want to keep

    while (parent) {
      if (nodesToKeep.has(parent.key)) {
        // We found a base, break
        break;
      }

      parent = parent.parent;
    } // Reassign parent. We can guarantee that parent is not null because
    // we are iterating over values in insertion order (maps guarantee this)


    cpy.parent = (parent ? nodes.get(parent.key) : null) || null;

    if (cpy.parent) {
      cpy.parent.children.push(cpy);
    } else {
      // If the frame's root does not exist or it may have
      // been filtered out, push the node to the roots
      tree.push(cpy);
    } // Set the new node in the map


    nodes.set(cpy.key, cpy);
  }

  return tree;
}

/***/ }),

/***/ "./app/utils/profiling/flamegraph.ts":
/*!*******************************************!*\
  !*** ./app/utils/profiling/flamegraph.ts ***!
  \*******************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "Flamegraph": () => (/* binding */ Flamegraph)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/es.error.cause.js */ "../node_modules/core-js/modules/es.error.cause.js");
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");
/* harmony import */ var _gl_utils__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./gl/utils */ "./app/utils/profiling/gl/utils.ts");
/* harmony import */ var _profile_profile__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ./profile/profile */ "./app/utils/profiling/profile/profile.tsx");
/* harmony import */ var _units_units__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ./units/units */ "./app/utils/profiling/units/units.ts");
/* harmony import */ var _callTreeNode__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! ./callTreeNode */ "./app/utils/profiling/callTreeNode.tsx");
/* harmony import */ var _frame__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! ./frame */ "./app/utils/profiling/frame.tsx");







 // Intermediary flamegraph data structure for rendering a profile. Constructs a list of frames from a profile
// and appends them to a virtual root. Taken mostly from speedscope with a few modifications. This should get
// removed as we port to our own format for profiles. The general idea is to iterate over profiles while
// keeping an intermediary stack so as to resemble the execution of the program.

class Flamegraph {
  static Empty() {
    return new Flamegraph(_profile_profile__WEBPACK_IMPORTED_MODULE_4__.Profile.Empty(), 0, {
      inverted: false,
      leftHeavy: false
    });
  }

  static From(from, _ref) {
    let {
      inverted = false,
      leftHeavy = false
    } = _ref;
    return new Flamegraph(from.profile, from.profileIndex, {
      inverted,
      leftHeavy
    });
  }

  constructor(profile, profileIndex) {
    let {
      inverted = false,
      leftHeavy = false,
      configSpace
    } = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "profile", void 0);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "frames", []);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "profileIndex", void 0);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "inverted", false);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "leftHeavy", false);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "depth", 0);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "configSpace", new _gl_utils__WEBPACK_IMPORTED_MODULE_3__.Rect(0, 0, 0, 0));

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "root", {
      key: -1,
      parent: null,
      frame: new _frame__WEBPACK_IMPORTED_MODULE_7__.Frame({ ..._frame__WEBPACK_IMPORTED_MODULE_7__.Frame.Root
      }),
      node: new _callTreeNode__WEBPACK_IMPORTED_MODULE_6__.CallTreeNode(new _frame__WEBPACK_IMPORTED_MODULE_7__.Frame({ ..._frame__WEBPACK_IMPORTED_MODULE_7__.Frame.Root
      }), null),
      depth: -1,
      start: 0,
      end: 0,
      children: []
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "formatter", void 0);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "timelineFormatter", void 0);

    this.inverted = inverted;
    this.leftHeavy = leftHeavy; // @TODO check if we can get rid of this profile reference

    this.profile = profile;
    this.profileIndex = profileIndex; // If a custom config space is provided, use it and draw the chart in it

    this.frames = leftHeavy ? this.buildLeftHeavyGraph(profile, configSpace ? configSpace.x : 0) : this.buildCallOrderGraph(profile, configSpace ? configSpace.x : 0);
    this.formatter = (0,_units_units__WEBPACK_IMPORTED_MODULE_5__.makeFormatter)(profile.unit);
    this.timelineFormatter = (0,_units_units__WEBPACK_IMPORTED_MODULE_5__.makeTimelineFormatter)(profile.unit); // If the profile duration is 0, set the flamegraph duration
    // to 1 second so we can render a placeholder grid

    this.configSpace = new _gl_utils__WEBPACK_IMPORTED_MODULE_3__.Rect(0, 0, this.profile.unit === 'nanoseconds' ? 1e9 : this.profile.unit === 'microseconds' ? 1e6 : this.profile.unit === 'milliseconds' ? 1e3 : 1, this.depth);

    if (this.profile.duration) {
      this.configSpace = new _gl_utils__WEBPACK_IMPORTED_MODULE_3__.Rect(configSpace ? configSpace.x : this.profile.startedAt, 0, configSpace ? configSpace.width : this.profile.duration, this.depth);
    }

    const weight = this.root.children.reduce((acc, frame) => acc + frame.node.totalWeight, 0);
    this.root.node.addToTotalWeight(weight);
    this.root.end = this.root.start + weight;
    this.root.frame.addToTotalWeight(weight);
  }

  buildCallOrderGraph(profile, offset) {
    const frames = [];
    const stack = [];
    let idx = 0;

    const openFrame = (node, value) => {
      const parent = (0,sentry_utils__WEBPACK_IMPORTED_MODULE_2__.lastOfArray)(stack);
      const frame = {
        key: idx,
        frame: node.frame,
        node,
        parent,
        children: [],
        depth: 0,
        start: offset + value,
        end: offset + value
      };

      if (parent) {
        parent.children.push(frame);
      } else {
        this.root.children.push(frame);
      }

      stack.push(frame);
      idx++;
    };

    const closeFrame = (_, value) => {
      const stackTop = stack.pop();

      if (!stackTop) {
        // This is unreachable because the profile importing logic already checks this
        throw new Error('Unbalanced stack');
      }

      stackTop.end = offset + value;
      stackTop.depth = stack.length;

      if (stackTop.end - stackTop.start === 0) {
        return;
      }

      frames.unshift(stackTop);
      this.depth = Math.max(stackTop.depth, this.depth);
    };

    profile.forEach(openFrame, closeFrame);
    return frames;
  }

  buildLeftHeavyGraph(profile, offset) {
    const frames = [];
    const stack = [];

    const sortTree = node => {
      node.children.sort((a, b) => -(a.totalWeight - b.totalWeight));
      node.children.forEach(c => sortTree(c));
    };

    sortTree(profile.appendOrderTree);
    const virtualRoot = {
      key: -1,
      frame: _callTreeNode__WEBPACK_IMPORTED_MODULE_6__.CallTreeNode.Root.frame,
      node: _callTreeNode__WEBPACK_IMPORTED_MODULE_6__.CallTreeNode.Root,
      parent: null,
      children: [],
      depth: 0,
      start: 0,
      end: 0
    };
    this.root = virtualRoot;
    let idx = 0;

    const openFrame = (node, value) => {
      const parent = (0,sentry_utils__WEBPACK_IMPORTED_MODULE_2__.lastOfArray)(stack);
      const frame = {
        key: idx,
        frame: node.frame,
        node,
        parent,
        children: [],
        depth: 0,
        start: offset + value,
        end: offset + value
      };

      if (parent) {
        parent.children.push(frame);
      } else {
        this.root.children.push(frame);
      }

      stack.push(frame);
      idx++;
    };

    const closeFrame = (_node, value) => {
      const stackTop = stack.pop();

      if (!stackTop) {
        throw new Error('Unbalanced stack');
      }

      stackTop.end = offset + value;
      stackTop.depth = stack.length; // Dont draw 0 width frames

      if (stackTop.end - stackTop.start === 0) {
        return;
      }

      frames.unshift(stackTop);
      this.depth = Math.max(stackTop.depth, this.depth);
    };

    function visit(node, start) {
      if (!node.frame.isRoot()) {
        openFrame(node, start);
      }

      let childTime = 0;
      node.children.forEach(child => {
        visit(child, start + childTime);
        childTime += child.totalWeight;
      });

      if (!node.frame.isRoot()) {
        closeFrame(node, start + node.totalWeight);
      }
    }

    visit(profile.appendOrderTree, 0);
    return frames;
  }

  setConfigSpace(configSpace) {
    this.configSpace = configSpace;
    return this;
  }

}

/***/ }),

/***/ "./app/utils/profiling/flamegraph/flamegraphStateProvider/flamegraphPreferences.tsx":
/*!******************************************************************************************!*\
  !*** ./app/utils/profiling/flamegraph/flamegraphStateProvider/flamegraphPreferences.tsx ***!
  \******************************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "flamegraphPreferencesReducer": () => (/* binding */ flamegraphPreferencesReducer)
/* harmony export */ });
function flamegraphPreferencesReducer(state, action) {
  switch (action.type) {
    case 'set layout':
      {
        return { ...state,
          layout: action.payload
        };
      }

    case 'set color coding':
      {
        return { ...state,
          colorCoding: action.payload
        };
      }

    case 'set sorting':
      {
        return { ...state,
          sorting: action.payload
        };
      }

    case 'set view':
      {
        return { ...state,
          view: action.payload
        };
      }

    case 'set xAxis':
      {
        return { ...state,
          xAxis: action.payload
        };
      }

    default:
      {
        return state;
      }
  }
}

/***/ }),

/***/ "./app/utils/profiling/flamegraph/flamegraphStateProvider/flamegraphProfiles.tsx":
/*!***************************************************************************************!*\
  !*** ./app/utils/profiling/flamegraph/flamegraphStateProvider/flamegraphProfiles.tsx ***!
  \***************************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "flamegraphProfilesReducer": () => (/* binding */ flamegraphProfilesReducer)
/* harmony export */ });
function flamegraphProfilesReducer(state, action) {
  switch (action.type) {
    case 'set highlight frame name':
      {
        return { ...state,
          focusFrame: action.payload
        };
      }

    case 'set selected root':
      {
        return { ...state,
          selectedRoot: action.payload
        };
      }

    case 'set thread id':
      {
        // When the profile index changes, we want to drop the selected and hovered nodes
        return { ...state,
          selectedRoot: null,
          threadId: action.payload
        };
      }

    default:
      {
        return state;
      }
  }
}

/***/ }),

/***/ "./app/utils/profiling/flamegraph/flamegraphStateProvider/flamegraphSearch.tsx":
/*!*************************************************************************************!*\
  !*** ./app/utils/profiling/flamegraph/flamegraphStateProvider/flamegraphSearch.tsx ***!
  \*************************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "flamegraphSearchReducer": () => (/* binding */ flamegraphSearchReducer)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);

function flamegraphSearchReducer(state, action) {
  switch (action.type) {
    case 'clear search':
      {
        return { ...state,
          query: '',
          index: null,
          results: new Map()
        };
      }

    case 'set results':
      {
        return { ...state,
          ...action.payload
        };
      }

    case 'set search index position':
      {
        return { ...state,
          index: action.payload
        };
      }

    default:
      {
        return state;
      }
  }
}

/***/ }),

/***/ "./app/utils/profiling/flamegraph/flamegraphStateProvider/flamegraphZoomPosition.tsx":
/*!*******************************************************************************************!*\
  !*** ./app/utils/profiling/flamegraph/flamegraphStateProvider/flamegraphZoomPosition.tsx ***!
  \*******************************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "flamegraphZoomPositionReducer": () => (/* binding */ flamegraphZoomPositionReducer)
/* harmony export */ });
/* harmony import */ var sentry_utils_profiling_gl_utils__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/utils/profiling/gl/utils */ "./app/utils/profiling/gl/utils.ts");

function flamegraphZoomPositionReducer(state, action) {
  switch (action.type) {
    case 'checkpoint':
      {
        return {
          view: sentry_utils_profiling_gl_utils__WEBPACK_IMPORTED_MODULE_0__.Rect.From(action.payload)
        };
      }

    default:
      {
        return state;
      }
  }
}

/***/ }),

/***/ "./app/utils/profiling/flamegraph/flamegraphStateProvider/index.tsx":
/*!**************************************************************************!*\
  !*** ./app/utils/profiling/flamegraph/flamegraphStateProvider/index.tsx ***!
  \**************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "DEFAULT_FLAMEGRAPH_STATE": () => (/* binding */ DEFAULT_FLAMEGRAPH_STATE),
/* harmony export */   "FLAMEGRAPH_LOCALSTORAGE_PREFERENCES_KEY": () => (/* binding */ FLAMEGRAPH_LOCALSTORAGE_PREFERENCES_KEY),
/* harmony export */   "FlamegraphStateContext": () => (/* binding */ FlamegraphStateContext),
/* harmony export */   "FlamegraphStateLocalStorageSync": () => (/* binding */ FlamegraphStateLocalStorageSync),
/* harmony export */   "FlamegraphStateProvider": () => (/* binding */ FlamegraphStateProvider),
/* harmony export */   "FlamegraphStateQueryParamSync": () => (/* binding */ FlamegraphStateQueryParamSync),
/* harmony export */   "combinedReducers": () => (/* binding */ combinedReducers),
/* harmony export */   "decodeFlamegraphStateFromQueryParams": () => (/* binding */ decodeFlamegraphStateFromQueryParams),
/* harmony export */   "encodeFlamegraphStateToQueryParams": () => (/* binding */ encodeFlamegraphStateToQueryParams)
/* harmony export */ });
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/es.string.replace.js */ "../node_modules/core-js/modules/es.string.replace.js");
/* harmony import */ var core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var react_router__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! react-router */ "../node_modules/react-router/es/index.js");
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");
/* harmony import */ var sentry_utils_profiling_flamegraph__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/utils/profiling/flamegraph */ "./app/utils/profiling/flamegraph.ts");
/* harmony import */ var sentry_utils_profiling_gl_utils__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/utils/profiling/gl/utils */ "./app/utils/profiling/gl/utils.ts");
/* harmony import */ var sentry_utils_useCombinedReducer__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/utils/useCombinedReducer */ "./app/utils/useCombinedReducer.tsx");
/* harmony import */ var sentry_utils_useLocalStorageState__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/utils/useLocalStorageState */ "./app/utils/useLocalStorageState.ts");
/* harmony import */ var sentry_utils_useLocation__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/utils/useLocation */ "./app/utils/useLocation.tsx");
/* harmony import */ var sentry_utils_useUndoableReducer__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/utils/useUndoableReducer */ "./app/utils/useUndoableReducer.tsx");
/* harmony import */ var sentry_views_profiling_profileGroupProvider__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/views/profiling/profileGroupProvider */ "./app/views/profiling/profileGroupProvider.tsx");
/* harmony import */ var _useFlamegraphState__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! ../useFlamegraphState */ "./app/utils/profiling/flamegraph/useFlamegraphState.ts");
/* harmony import */ var _flamegraphPreferences__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! ./flamegraphPreferences */ "./app/utils/profiling/flamegraph/flamegraphStateProvider/flamegraphPreferences.tsx");
/* harmony import */ var _flamegraphProfiles__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! ./flamegraphProfiles */ "./app/utils/profiling/flamegraph/flamegraphStateProvider/flamegraphProfiles.tsx");
/* harmony import */ var _flamegraphSearch__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! ./flamegraphSearch */ "./app/utils/profiling/flamegraph/flamegraphStateProvider/flamegraphSearch.tsx");
/* harmony import */ var _flamegraphZoomPosition__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! ./flamegraphZoomPosition */ "./app/utils/profiling/flamegraph/flamegraphStateProvider/flamegraphZoomPosition.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");

















 // Intersect the types so we can properly guard



function isColorCoding(value) {
  const values = ['by symbol name', 'by system / application', 'by library', 'by recursion', 'by frequency'];
  return values.includes(value);
}

function isLayout(value) {
  return value === 'table right' || value === 'table bottom' || value === 'table left';
}

function isSorting(value) {
  const values = ['left heavy', 'call order'];
  return values.includes(value);
}

function isView(value) {
  const values = ['top down', 'bottom up'];
  return values.includes(value);
}

function isXAxis(value) {
  const values = ['standalone', 'transaction'];
  return values.includes(value);
}

function decodeFlamegraphStateFromQueryParams(query) {
  var _Rect$decode;

  return {
    profiles: {
      focusFrame: typeof query.frameName === 'string' && typeof query.framePackage === 'string' ? {
        name: query.frameName,
        package: query.framePackage
      } : null,
      threadId: typeof query.tid === 'string' && !isNaN(parseInt(query.tid, 10)) ? parseInt(query.tid, 10) : null
    },
    position: {
      view: (_Rect$decode = sentry_utils_profiling_gl_utils__WEBPACK_IMPORTED_MODULE_7__.Rect.decode(query.fov)) !== null && _Rect$decode !== void 0 ? _Rect$decode : sentry_utils_profiling_gl_utils__WEBPACK_IMPORTED_MODULE_7__.Rect.Empty()
    },
    preferences: {
      layout: isLayout(query.layout) ? query.layout : DEFAULT_FLAMEGRAPH_STATE.preferences.layout,
      colorCoding: isColorCoding(query.colorCoding) ? query.colorCoding : DEFAULT_FLAMEGRAPH_STATE.preferences.colorCoding,
      sorting: isSorting(query.sorting) ? query.sorting : DEFAULT_FLAMEGRAPH_STATE.preferences.sorting,
      view: isView(query.view) ? query.view : DEFAULT_FLAMEGRAPH_STATE.preferences.view,
      xAxis: isXAxis(query.xAxis) ? query.xAxis : DEFAULT_FLAMEGRAPH_STATE.preferences.xAxis
    },
    search: {
      query: typeof query.query === 'string' ? query.query : ''
    }
  };
}
function encodeFlamegraphStateToQueryParams(state) {
  return {
    colorCoding: state.preferences.colorCoding,
    sorting: state.preferences.sorting,
    view: state.preferences.view,
    xAxis: state.preferences.xAxis,
    query: state.search.query,
    ...(state.position.view.isEmpty() ? {
      fov: undefined
    } : {
      fov: sentry_utils_profiling_gl_utils__WEBPACK_IMPORTED_MODULE_7__.Rect.encode(state.position.view)
    }),
    ...(typeof state.profiles.threadId === 'number' ? {
      tid: state.profiles.threadId
    } : {})
  };
}
const combinedReducers = (0,sentry_utils_useCombinedReducer__WEBPACK_IMPORTED_MODULE_8__.makeCombinedReducers)({
  profiles: _flamegraphProfiles__WEBPACK_IMPORTED_MODULE_15__.flamegraphProfilesReducer,
  position: _flamegraphZoomPosition__WEBPACK_IMPORTED_MODULE_17__.flamegraphZoomPositionReducer,
  preferences: _flamegraphPreferences__WEBPACK_IMPORTED_MODULE_14__.flamegraphPreferencesReducer,
  search: _flamegraphSearch__WEBPACK_IMPORTED_MODULE_16__.flamegraphSearchReducer
});
function FlamegraphStateQueryParamSync() {
  const location = (0,sentry_utils_useLocation__WEBPACK_IMPORTED_MODULE_10__.useLocation)();
  const state = (0,_useFlamegraphState__WEBPACK_IMPORTED_MODULE_13__.useFlamegraphStateValue)();
  (0,react__WEBPACK_IMPORTED_MODULE_3__.useEffect)(() => {
    react_router__WEBPACK_IMPORTED_MODULE_4__.browserHistory.replace({ ...location,
      query: { ...location.query,
        ...encodeFlamegraphStateToQueryParams(state)
      }
    }); // We only want to sync the query params when the state changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);
  return null;
}
const FLAMEGRAPH_LOCALSTORAGE_PREFERENCES_KEY = 'flamegraph-preferences';
function FlamegraphStateLocalStorageSync() {
  const state = (0,_useFlamegraphState__WEBPACK_IMPORTED_MODULE_13__.useFlamegraphStateValue)();
  const [_, setState] = (0,sentry_utils_useLocalStorageState__WEBPACK_IMPORTED_MODULE_9__.useLocalStorageState)(FLAMEGRAPH_LOCALSTORAGE_PREFERENCES_KEY, {
    preferences: {
      layout: DEFAULT_FLAMEGRAPH_STATE.preferences.layout
    }
  });
  (0,react__WEBPACK_IMPORTED_MODULE_3__.useEffect)(() => {
    setState({
      preferences: {
        layout: state.preferences.layout
      }
    }); // We only want to sync the local storage when the state changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.preferences.layout]);
  return null;
}
const FlamegraphStateContext = /*#__PURE__*/(0,react__WEBPACK_IMPORTED_MODULE_3__.createContext)(null);
const DEFAULT_FLAMEGRAPH_STATE = {
  profiles: {
    selectedRoot: null,
    threadId: null,
    focusFrame: null
  },
  position: {
    view: sentry_utils_profiling_gl_utils__WEBPACK_IMPORTED_MODULE_7__.Rect.Empty()
  },
  preferences: {
    colorCoding: 'by symbol name',
    sorting: 'call order',
    view: 'top down',
    xAxis: 'standalone',
    layout: 'table bottom'
  },
  search: {
    index: null,
    results: new Map(),
    query: ''
  }
};
function FlamegraphStateProvider(props) {
  var _props$initialState, _props$initialState$p, _props$initialState$p2, _props$initialState2, _props$initialState2$, _props$initialState2$2, _props$initialState$p3, _props$initialState3, _props$initialState3$, _props$initialState$p4, _props$initialState4, _props$initialState4$, _props$initialState$p5, _props$initialState5, _props$initialState5$, _props$initialState$p6, _props$initialState6, _props$initialState6$, _props$initialState$p7, _props$initialState7, _props$initialState7$, _props$initialState$p8, _props$initialState8, _props$initialState8$, _props$initialState$p9, _props$initialState9, _props$initialState9$, _props$initialState$s, _props$initialState10, _props$initialState11, _props$initialState12, _props$initialState13;

  const [profileGroup] = (0,sentry_views_profiling_profileGroupProvider__WEBPACK_IMPORTED_MODULE_12__.useProfileGroup)();
  const reducer = (0,sentry_utils_useUndoableReducer__WEBPACK_IMPORTED_MODULE_11__.useUndoableReducer)(combinedReducers, {
    profiles: {
      focusFrame: (_props$initialState = props.initialState) !== null && _props$initialState !== void 0 && (_props$initialState$p = _props$initialState.profiles) !== null && _props$initialState$p !== void 0 && (_props$initialState$p2 = _props$initialState$p.focusFrame) !== null && _props$initialState$p2 !== void 0 && _props$initialState$p2.name && (_props$initialState2 = props.initialState) !== null && _props$initialState2 !== void 0 && (_props$initialState2$ = _props$initialState2.profiles) !== null && _props$initialState2$ !== void 0 && (_props$initialState2$2 = _props$initialState2$.focusFrame) !== null && _props$initialState2$2 !== void 0 && _props$initialState2$2.package ? {
        name: props.initialState.profiles.focusFrame.name,
        package: props.initialState.profiles.focusFrame.package
      } : DEFAULT_FLAMEGRAPH_STATE.profiles.focusFrame,
      selectedRoot: null,
      threadId: (_props$initialState$p3 = (_props$initialState3 = props.initialState) === null || _props$initialState3 === void 0 ? void 0 : (_props$initialState3$ = _props$initialState3.profiles) === null || _props$initialState3$ === void 0 ? void 0 : _props$initialState3$.threadId) !== null && _props$initialState$p3 !== void 0 ? _props$initialState$p3 : DEFAULT_FLAMEGRAPH_STATE.profiles.threadId
    },
    position: {
      view: (_props$initialState$p4 = (_props$initialState4 = props.initialState) === null || _props$initialState4 === void 0 ? void 0 : (_props$initialState4$ = _props$initialState4.position) === null || _props$initialState4$ === void 0 ? void 0 : _props$initialState4$.view) !== null && _props$initialState$p4 !== void 0 ? _props$initialState$p4 : DEFAULT_FLAMEGRAPH_STATE.position.view
    },
    preferences: {
      layout: (_props$initialState$p5 = (_props$initialState5 = props.initialState) === null || _props$initialState5 === void 0 ? void 0 : (_props$initialState5$ = _props$initialState5.preferences) === null || _props$initialState5$ === void 0 ? void 0 : _props$initialState5$.layout) !== null && _props$initialState$p5 !== void 0 ? _props$initialState$p5 : DEFAULT_FLAMEGRAPH_STATE.preferences.layout,
      colorCoding: (_props$initialState$p6 = (_props$initialState6 = props.initialState) === null || _props$initialState6 === void 0 ? void 0 : (_props$initialState6$ = _props$initialState6.preferences) === null || _props$initialState6$ === void 0 ? void 0 : _props$initialState6$.colorCoding) !== null && _props$initialState$p6 !== void 0 ? _props$initialState$p6 : DEFAULT_FLAMEGRAPH_STATE.preferences.colorCoding,
      sorting: (_props$initialState$p7 = (_props$initialState7 = props.initialState) === null || _props$initialState7 === void 0 ? void 0 : (_props$initialState7$ = _props$initialState7.preferences) === null || _props$initialState7$ === void 0 ? void 0 : _props$initialState7$.sorting) !== null && _props$initialState$p7 !== void 0 ? _props$initialState$p7 : DEFAULT_FLAMEGRAPH_STATE.preferences.sorting,
      view: (_props$initialState$p8 = (_props$initialState8 = props.initialState) === null || _props$initialState8 === void 0 ? void 0 : (_props$initialState8$ = _props$initialState8.preferences) === null || _props$initialState8$ === void 0 ? void 0 : _props$initialState8$.view) !== null && _props$initialState$p8 !== void 0 ? _props$initialState$p8 : DEFAULT_FLAMEGRAPH_STATE.preferences.view,
      xAxis: (_props$initialState$p9 = (_props$initialState9 = props.initialState) === null || _props$initialState9 === void 0 ? void 0 : (_props$initialState9$ = _props$initialState9.preferences) === null || _props$initialState9$ === void 0 ? void 0 : _props$initialState9$.xAxis) !== null && _props$initialState$p9 !== void 0 ? _props$initialState$p9 : DEFAULT_FLAMEGRAPH_STATE.preferences.xAxis
    },
    search: { ...DEFAULT_FLAMEGRAPH_STATE.search,
      query: (_props$initialState$s = (_props$initialState10 = props.initialState) === null || _props$initialState10 === void 0 ? void 0 : (_props$initialState11 = _props$initialState10.search) === null || _props$initialState11 === void 0 ? void 0 : _props$initialState11.query) !== null && _props$initialState$s !== void 0 ? _props$initialState$s : DEFAULT_FLAMEGRAPH_STATE.search.query
    }
  });
  (0,react__WEBPACK_IMPORTED_MODULE_3__.useEffect)(() => {
    if (reducer[0].profiles.threadId === null && profileGroup.type === 'resolved') {
      /**
       * When a focus frame is specified, we need to override the active thread.
       * We look at each thread and pick the one that scores the highest.
       */
      if ((0,sentry_utils__WEBPACK_IMPORTED_MODULE_5__.defined)(reducer[0].profiles.focusFrame)) {
        const candidate = profileGroup.data.profiles.reduce((prevCandidate, profile) => {
          const flamegraph = new sentry_utils_profiling_flamegraph__WEBPACK_IMPORTED_MODULE_6__.Flamegraph(profile, profile.threadId, {
            inverted: false,
            leftHeavy: false,
            configSpace: undefined
          });
          const score = scoreFlamegraph(flamegraph, reducer[0].profiles.focusFrame);
          return score <= prevCandidate.score ? prevCandidate : {
            score,
            threadId: profile.threadId
          };
        }, {
          score: 0,
          threadId: null
        });

        if ((0,sentry_utils__WEBPACK_IMPORTED_MODULE_5__.defined)(candidate.threadId)) {
          reducer[1]({
            type: 'set thread id',
            payload: candidate.threadId
          });
          return;
        }
      }

      if (typeof profileGroup.data.activeProfileIndex === 'number') {
        const threadID = profileGroup.data.profiles[profileGroup.data.activeProfileIndex].threadId;

        if (threadID) {
          reducer[1]({
            type: 'set thread id',
            payload: threadID
          });
        }
      }
    }
  }, [(_props$initialState12 = props.initialState) === null || _props$initialState12 === void 0 ? void 0 : (_props$initialState13 = _props$initialState12.profiles) === null || _props$initialState13 === void 0 ? void 0 : _props$initialState13.threadId, profileGroup, reducer]);
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(FlamegraphStateContext.Provider, {
    value: reducer,
    children: props.children
  });
}
FlamegraphStateProvider.displayName = "FlamegraphStateProvider";

function scoreFlamegraph(flamegraph, focusFrame) {
  if (!(0,sentry_utils__WEBPACK_IMPORTED_MODULE_5__.defined)(focusFrame)) {
    return 0;
  }

  let score = 0;
  const frames = [...flamegraph.root.children];

  while (frames.length > 0) {
    const frame = frames.pop();

    if (frame.frame.name === focusFrame.name && frame.frame.image === focusFrame.package) {
      score += frame.node.totalWeight;
    }

    for (let i = 0; i < frame.children.length; i++) {
      frames.push(frame.children[i]);
    }
  }

  return score;
}

/***/ }),

/***/ "./app/utils/profiling/flamegraph/flamegraphTheme.tsx":
/*!************************************************************!*\
  !*** ./app/utils/profiling/flamegraph/flamegraphTheme.tsx ***!
  \************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "DarkFlamegraphTheme": () => (/* binding */ DarkFlamegraphTheme),
/* harmony export */   "LCH_DARK": () => (/* binding */ LCH_DARK),
/* harmony export */   "LCH_LIGHT": () => (/* binding */ LCH_LIGHT),
/* harmony export */   "LightFlamegraphTheme": () => (/* binding */ LightFlamegraphTheme)
/* harmony export */ });
/* harmony import */ var sentry_utils_profiling_colors_utils__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/utils/profiling/colors/utils */ "./app/utils/profiling/colors/utils.tsx");
/* harmony import */ var sentry_utils_theme__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/utils/theme */ "./app/utils/theme.tsx");


const MONOSPACE_FONT = `ui-monospace, Menlo, Monaco, 'Cascadia Mono', 'Segoe UI Mono', 'Roboto Mono',
'Oxygen Mono', 'Ubuntu Monospace', 'Source Code Pro', 'Fira Mono', 'Droid Sans Mono',
'Courier New', monospace`;
const FRAME_FONT = sentry_utils_theme__WEBPACK_IMPORTED_MODULE_1__.lightTheme.text.familyMono; // Luma chroma hue settings

// Luma chroma hue settings for light theme
const LCH_LIGHT = {
  C_0: 0.25,
  C_d: 0.2,
  L_0: 0.8,
  L_d: 0.15
}; // Luma chroma hue settings for dark theme

const LCH_DARK = {
  C_0: 0.2,
  C_d: 0.1,
  L_0: 0.2,
  L_d: 0.1
};
const LightFlamegraphTheme = {
  CONFIG: {
    HIGHLIGHT_RECURSION: false
  },
  SIZES: {
    BAR_FONT_SIZE: 11,
    BAR_HEIGHT: 20,
    BAR_PADDING: 4,
    FLAMEGRAPH_DEPTH_OFFSET: 12,
    FOCUSED_FRAME_BORDER_WIDTH: 2,
    FRAME_BORDER_WIDTH: 2,
    GRID_LINE_WIDTH: 2,
    HOVERED_FRAME_BORDER_WIDTH: 1,
    INTERNAL_SAMPLE_TICK_LINE_WIDTH: 1,
    LABEL_FONT_PADDING: 6,
    LABEL_FONT_SIZE: 10,
    MINIMAP_HEIGHT: 100,
    MINIMAP_POSITION_OVERLAY_BORDER_WIDTH: 2,
    REQUEST_BAR_HEIGHT: 14,
    REQUEST_DEPTH_OFFSET: 4,
    REQUEST_FONT_SIZE: 10,
    REQUEST_TAIL_HEIGHT: 8,
    SPANS_BAR_HEIGHT: 14,
    SPANS_DEPTH_OFFSET: 4,
    SPANS_FONT_SIZE: 10,
    TIMELINE_HEIGHT: 20,
    TOOLTIP_FONT_SIZE: 12
  },
  COLORS: {
    BAR_LABEL_FONT_COLOR: '#000',
    COLOR_BUCKET: (0,sentry_utils_profiling_colors_utils__WEBPACK_IMPORTED_MODULE_0__.makeColorBucketTheme)(LCH_LIGHT),
    COLOR_MAP: sentry_utils_profiling_colors_utils__WEBPACK_IMPORTED_MODULE_0__.makeColorMap,
    CURSOR_CROSSHAIR: '#bbbbbb',
    DIFFERENTIAL_DECREASE: [0.309, 0.2058, 0.98],
    DIFFERENTIAL_INCREASE: [0.98, 0.2058, 0.4381],
    FOCUSED_FRAME_BORDER_COLOR: sentry_utils_theme__WEBPACK_IMPORTED_MODULE_1__.lightTheme.focus,
    FRAME_FALLBACK_COLOR: [0, 0, 0, 0.035],
    GRID_FRAME_BACKGROUND_COLOR: 'rgba(255, 255, 255, 0.8)',
    GRID_LINE_COLOR: '#e5e7eb',
    HIGHLIGHTED_LABEL_COLOR: [255, 255, 0],
    HOVERED_FRAME_BORDER_COLOR: 'rgba(0, 0, 0, 0.8)',
    LABEL_FONT_COLOR: '#1f233a',
    MINIMAP_POSITION_OVERLAY_BORDER_COLOR: 'rgba(0,0,0, 0.2)',
    MINIMAP_POSITION_OVERLAY_COLOR: 'rgba(0,0,0,0.1)',
    REQUEST_2XX_RESPONSE: 'rgba(218, 231, 209, 1)',
    REQUEST_4XX_RESPONSE: 'rgba(255,96, 96, 1)',
    REQUEST_DNS_TIME: `rgba(57, 146, 152, 1)`,
    REQUEST_SSL_TIME: `rgba(207,84,218, 1)`,
    REQUEST_TCP_TIME: `rgba(242, 146,57,1)`,
    REQUEST_WAIT_TIME: `rgba(253,252,224, 1)`,
    SAMPLE_TICK_COLOR: [255, 0, 0, 0.5],
    SEARCH_RESULT_FRAME_COLOR: 'vec4(0.99, 0.70, 0.35, 1.0)',
    SELECTED_FRAME_BORDER_COLOR: sentry_utils_theme__WEBPACK_IMPORTED_MODULE_1__.lightTheme.blue400,
    SPAN_FRAME_BACKGROUND: 'rgba(231, 231, 231, 0.5)',
    SPAN_FRAME_BORDER: 'rgba(200, 200, 200, 1)',
    STACK_TO_COLOR: (0,sentry_utils_profiling_colors_utils__WEBPACK_IMPORTED_MODULE_0__.makeStackToColor)([0, 0, 0, 0.035])
  },
  FONTS: {
    FONT: MONOSPACE_FONT,
    FRAME_FONT
  }
};
const DarkFlamegraphTheme = {
  CONFIG: {
    HIGHLIGHT_RECURSION: false
  },
  SIZES: {
    BAR_FONT_SIZE: 11,
    BAR_HEIGHT: 20,
    BAR_PADDING: 4,
    FLAMEGRAPH_DEPTH_OFFSET: 12,
    FOCUSED_FRAME_BORDER_WIDTH: 1,
    FRAME_BORDER_WIDTH: 2,
    GRID_LINE_WIDTH: 2,
    HOVERED_FRAME_BORDER_WIDTH: 1,
    INTERNAL_SAMPLE_TICK_LINE_WIDTH: 1,
    LABEL_FONT_PADDING: 6,
    LABEL_FONT_SIZE: 10,
    MINIMAP_HEIGHT: 100,
    MINIMAP_POSITION_OVERLAY_BORDER_WIDTH: 2,
    REQUEST_BAR_HEIGHT: 14,
    REQUEST_DEPTH_OFFSET: 4,
    REQUEST_FONT_SIZE: 10,
    REQUEST_TAIL_HEIGHT: 8,
    SPANS_BAR_HEIGHT: 14,
    SPANS_DEPTH_OFFSET: 4,
    SPANS_FONT_SIZE: 10,
    TIMELINE_HEIGHT: 20,
    TOOLTIP_FONT_SIZE: 12
  },
  COLORS: {
    BAR_LABEL_FONT_COLOR: 'rgb(255 255 255 / 80%)',
    COLOR_BUCKET: (0,sentry_utils_profiling_colors_utils__WEBPACK_IMPORTED_MODULE_0__.makeColorBucketTheme)(LCH_DARK),
    COLOR_MAP: sentry_utils_profiling_colors_utils__WEBPACK_IMPORTED_MODULE_0__.makeColorMap,
    CURSOR_CROSSHAIR: '#828285',
    DIFFERENTIAL_DECREASE: [0.309, 0.2058, 0.98],
    DIFFERENTIAL_INCREASE: [0.98, 0.2058, 0.4381],
    FOCUSED_FRAME_BORDER_COLOR: sentry_utils_theme__WEBPACK_IMPORTED_MODULE_1__.darkTheme.focus,
    FRAME_FALLBACK_COLOR: [1, 1, 1, 0.1],
    GRID_FRAME_BACKGROUND_COLOR: 'rgba(0, 0, 0, 0.4)',
    GRID_LINE_COLOR: '#222227',
    HIGHLIGHTED_LABEL_COLOR: [255, 255, 0],
    HOVERED_FRAME_BORDER_COLOR: 'rgba(255, 255, 255, 0.8)',
    LABEL_FONT_COLOR: 'rgba(255, 255, 255, 0.8)',
    MINIMAP_POSITION_OVERLAY_BORDER_COLOR: 'rgba(255,255,255, 0.2)',
    MINIMAP_POSITION_OVERLAY_COLOR: 'rgba(255,255,255,0.1)',
    REQUEST_2XX_RESPONSE: 'rgba(218, 231, 209, 1)',
    REQUEST_4XX_RESPONSE: 'rgba(255,96, 96, 1)',
    REQUEST_DNS_TIME: `rgba(57, 146, 152, 1)`,
    REQUEST_SSL_TIME: `rgba(207,84,218, 1)`,
    REQUEST_TCP_TIME: `rgba(242, 146,57,1)`,
    REQUEST_WAIT_TIME: `rgba(253,252,224, 1)`,
    SAMPLE_TICK_COLOR: [255, 0, 0, 0.5],
    SEARCH_RESULT_FRAME_COLOR: 'vec4(0.99, 0.70, 0.35, 0.7)',
    SELECTED_FRAME_BORDER_COLOR: sentry_utils_theme__WEBPACK_IMPORTED_MODULE_1__.lightTheme.blue400,
    SPAN_FRAME_BACKGROUND: 'rgba(232, 232, 232, 0.2)',
    SPAN_FRAME_BORDER: '#57575b',
    STACK_TO_COLOR: (0,sentry_utils_profiling_colors_utils__WEBPACK_IMPORTED_MODULE_0__.makeStackToColor)([1, 1, 1, 0.1])
  },
  FONTS: {
    FONT: MONOSPACE_FONT,
    FRAME_FONT
  }
};

/***/ }),

/***/ "./app/utils/profiling/flamegraph/flamegraphThemeProvider.tsx":
/*!********************************************************************!*\
  !*** ./app/utils/profiling/flamegraph/flamegraphThemeProvider.tsx ***!
  \********************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "FlamegraphThemeContext": () => (/* binding */ FlamegraphThemeContext),
/* harmony export */   "FlamegraphThemeProvider": () => (/* binding */ FlamegraphThemeProvider)
/* harmony export */ });
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/es.error.cause.js */ "../node_modules/core-js/modules/es.error.cause.js");
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_stores_configStore__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/stores/configStore */ "./app/stores/configStore.tsx");
/* harmony import */ var sentry_stores_useLegacyStore__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/stores/useLegacyStore */ "./app/stores/useLegacyStore.tsx");
/* harmony import */ var _colors_utils__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ../colors/utils */ "./app/utils/profiling/colors/utils.tsx");
/* harmony import */ var _flamegraphTheme__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ./flamegraphTheme */ "./app/utils/profiling/flamegraph/flamegraphTheme.tsx");
/* harmony import */ var _useFlamegraphPreferences__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! ./useFlamegraphPreferences */ "./app/utils/profiling/flamegraph/useFlamegraphPreferences.ts");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");








const FlamegraphThemeContext = /*#__PURE__*/(0,react__WEBPACK_IMPORTED_MODULE_1__.createContext)(null);

function FlamegraphThemeProvider(props) {
  const {
    theme
  } = (0,sentry_stores_useLegacyStore__WEBPACK_IMPORTED_MODULE_3__.useLegacyStore)(sentry_stores_configStore__WEBPACK_IMPORTED_MODULE_2__["default"]);
  const flamegraphPreferences = (0,_useFlamegraphPreferences__WEBPACK_IMPORTED_MODULE_6__.useFlamegraphPreferencesValue)();
  const activeFlamegraphTheme = (0,react__WEBPACK_IMPORTED_MODULE_1__.useMemo)(() => {
    const base = theme === 'light' ? _flamegraphTheme__WEBPACK_IMPORTED_MODULE_5__.LightFlamegraphTheme : _flamegraphTheme__WEBPACK_IMPORTED_MODULE_5__.DarkFlamegraphTheme;

    switch (flamegraphPreferences.colorCoding) {
      case 'by symbol name':
        {
          return base;
        }

      case 'by recursion':
        {
          return { ...base,
            COLORS: { ...base.COLORS,
              COLOR_MAP: _colors_utils__WEBPACK_IMPORTED_MODULE_4__.makeColorMapByRecursion
            }
          };
        }

      case 'by library':
        {
          return { ...base,
            COLORS: { ...base.COLORS,
              COLOR_MAP: _colors_utils__WEBPACK_IMPORTED_MODULE_4__.makeColorMapByImage
            }
          };
        }

      case 'by system / application':
        {
          return { ...base,
            COLORS: { ...base.COLORS,
              COLOR_MAP: _colors_utils__WEBPACK_IMPORTED_MODULE_4__.makeColorMapBySystemVsApplication
            }
          };
        }

      case 'by frequency':
        {
          return { ...base,
            COLORS: { ...base.COLORS,
              COLOR_MAP: _colors_utils__WEBPACK_IMPORTED_MODULE_4__.makeColorMapByFrequency
            }
          };
        }

      default:
        {
          throw new TypeError(`Unsupported flamegraph color coding ${flamegraphPreferences.colorCoding}`);
        }
    }
  }, [theme, flamegraphPreferences.colorCoding]);
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(FlamegraphThemeContext.Provider, {
    value: activeFlamegraphTheme,
    children: props.children
  });
}

FlamegraphThemeProvider.displayName = "FlamegraphThemeProvider";


/***/ }),

/***/ "./app/utils/profiling/flamegraph/useFlamegraphPreferences.ts":
/*!********************************************************************!*\
  !*** ./app/utils/profiling/flamegraph/useFlamegraphPreferences.ts ***!
  \********************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "useFlamegraphPreferences": () => (/* binding */ useFlamegraphPreferences),
/* harmony export */   "useFlamegraphPreferencesValue": () => (/* binding */ useFlamegraphPreferencesValue)
/* harmony export */ });
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/es.error.cause.js */ "../node_modules/core-js/modules/es.error.cause.js");
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var _flamegraphStateProvider__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./flamegraphStateProvider */ "./app/utils/profiling/flamegraph/flamegraphStateProvider/index.tsx");



function useFlamegraphPreferences() {
  const context = (0,react__WEBPACK_IMPORTED_MODULE_1__.useContext)(_flamegraphStateProvider__WEBPACK_IMPORTED_MODULE_2__.FlamegraphStateContext);

  if (context === null) {
    throw new Error('useFlamegraphPreferences called outside of FlamegraphStateProvider');
  }

  return [context[0].preferences, context[1]];
}
function useFlamegraphPreferencesValue() {
  const context = (0,react__WEBPACK_IMPORTED_MODULE_1__.useContext)(_flamegraphStateProvider__WEBPACK_IMPORTED_MODULE_2__.FlamegraphStateContext);

  if (context === null) {
    throw new Error('useFlamegraphPreferencesValue called outside of FlamegraphStateProvider');
  }

  return context[0].preferences;
}

/***/ }),

/***/ "./app/utils/profiling/flamegraph/useFlamegraphProfiles.tsx":
/*!******************************************************************!*\
  !*** ./app/utils/profiling/flamegraph/useFlamegraphProfiles.tsx ***!
  \******************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "useFlamegraphProfiles": () => (/* binding */ useFlamegraphProfiles),
/* harmony export */   "useFlamegraphProfilesValue": () => (/* binding */ useFlamegraphProfilesValue)
/* harmony export */ });
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/es.error.cause.js */ "../node_modules/core-js/modules/es.error.cause.js");
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var _flamegraphStateProvider_index__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./flamegraphStateProvider/index */ "./app/utils/profiling/flamegraph/flamegraphStateProvider/index.tsx");



function useFlamegraphProfiles() {
  const context = (0,react__WEBPACK_IMPORTED_MODULE_1__.useContext)(_flamegraphStateProvider_index__WEBPACK_IMPORTED_MODULE_2__.FlamegraphStateContext);

  if (context === null) {
    throw new Error('useFlamegraphProfiles called outside of FlamegraphStateProvider');
  }

  return [context[0].profiles, context[1]];
}
function useFlamegraphProfilesValue() {
  const context = (0,react__WEBPACK_IMPORTED_MODULE_1__.useContext)(_flamegraphStateProvider_index__WEBPACK_IMPORTED_MODULE_2__.FlamegraphStateContext);

  if (context === null) {
    throw new Error('useFlamegraphProfiles called outside of FlamegraphStateProvider');
  }

  return context[0].profiles;
}

/***/ }),

/***/ "./app/utils/profiling/flamegraph/useFlamegraphSearch.ts":
/*!***************************************************************!*\
  !*** ./app/utils/profiling/flamegraph/useFlamegraphSearch.ts ***!
  \***************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "useFlamegraphSearch": () => (/* binding */ useFlamegraphSearch),
/* harmony export */   "useFlamegraphSearchValue": () => (/* binding */ useFlamegraphSearchValue)
/* harmony export */ });
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/es.error.cause.js */ "../node_modules/core-js/modules/es.error.cause.js");
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var _flamegraphStateProvider__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./flamegraphStateProvider */ "./app/utils/profiling/flamegraph/flamegraphStateProvider/index.tsx");



function useFlamegraphSearch() {
  const context = (0,react__WEBPACK_IMPORTED_MODULE_1__.useContext)(_flamegraphStateProvider__WEBPACK_IMPORTED_MODULE_2__.FlamegraphStateContext);

  if (context === null) {
    throw new Error('useFlamegraphSearch called outside of FlamegraphStateProvider');
  }

  return [context[0].search, context[1]];
}
function useFlamegraphSearchValue() {
  const context = (0,react__WEBPACK_IMPORTED_MODULE_1__.useContext)(_flamegraphStateProvider__WEBPACK_IMPORTED_MODULE_2__.FlamegraphStateContext);

  if (context === null) {
    throw new Error('useFlamegraphSearchValue called outside of FlamegraphStateProvider');
  }

  return context[0].search;
}

/***/ }),

/***/ "./app/utils/profiling/flamegraph/useFlamegraphState.ts":
/*!**************************************************************!*\
  !*** ./app/utils/profiling/flamegraph/useFlamegraphState.ts ***!
  \**************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "useDispatchFlamegraphState": () => (/* binding */ useDispatchFlamegraphState),
/* harmony export */   "useFlamegraphState": () => (/* binding */ useFlamegraphState),
/* harmony export */   "useFlamegraphStateValue": () => (/* binding */ useFlamegraphStateValue)
/* harmony export */ });
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/es.error.cause.js */ "../node_modules/core-js/modules/es.error.cause.js");
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var _flamegraphStateProvider__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./flamegraphStateProvider */ "./app/utils/profiling/flamegraph/flamegraphStateProvider/index.tsx");



function useFlamegraphState() {
  const context = (0,react__WEBPACK_IMPORTED_MODULE_1__.useContext)(_flamegraphStateProvider__WEBPACK_IMPORTED_MODULE_2__.FlamegraphStateContext);

  if (context === null) {
    throw new Error('useFlamegraphState called outside of FlamegraphStateProvider');
  }

  return context;
}
function useFlamegraphStateValue() {
  const context = (0,react__WEBPACK_IMPORTED_MODULE_1__.useContext)(_flamegraphStateProvider__WEBPACK_IMPORTED_MODULE_2__.FlamegraphStateContext);

  if (context === null) {
    throw new Error('useFlamegraphState called outside of FlamegraphStateProvider');
  }

  return context[0];
}
function useDispatchFlamegraphState() {
  const context = (0,react__WEBPACK_IMPORTED_MODULE_1__.useContext)(_flamegraphStateProvider__WEBPACK_IMPORTED_MODULE_2__.FlamegraphStateContext);

  if (context === null) {
    throw new Error('useFlamegraphState called outside of FlamegraphStateProvider');
  }

  return [context[1], context[2]];
}

/***/ }),

/***/ "./app/utils/profiling/flamegraph/useFlamegraphTheme.ts":
/*!**************************************************************!*\
  !*** ./app/utils/profiling/flamegraph/useFlamegraphTheme.ts ***!
  \**************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "useFlamegraphTheme": () => (/* binding */ useFlamegraphTheme)
/* harmony export */ });
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/es.error.cause.js */ "../node_modules/core-js/modules/es.error.cause.js");
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var _flamegraphThemeProvider__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./flamegraphThemeProvider */ "./app/utils/profiling/flamegraph/flamegraphThemeProvider.tsx");




function useFlamegraphTheme() {
  const ctx = (0,react__WEBPACK_IMPORTED_MODULE_1__.useContext)(_flamegraphThemeProvider__WEBPACK_IMPORTED_MODULE_2__.FlamegraphThemeContext);

  if (!ctx) {
    throw new Error('useFlamegraphTheme was called outside of FlamegraphThemeProvider');
  }

  return ctx;
}



/***/ }),

/***/ "./app/utils/profiling/flamegraphCanvas.tsx":
/*!**************************************************!*\
  !*** ./app/utils/profiling/flamegraphCanvas.tsx ***!
  \**************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "FlamegraphCanvas": () => (/* binding */ FlamegraphCanvas)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var gl_matrix__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! gl-matrix */ "../node_modules/gl-matrix/esm/mat3.js");
/* harmony import */ var sentry_utils_profiling_gl_utils__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/utils/profiling/gl/utils */ "./app/utils/profiling/gl/utils.ts");



class FlamegraphCanvas {
  constructor(canvas, origin) {
    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "canvas", void 0);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "origin", void 0);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "physicalSpace", sentry_utils_profiling_gl_utils__WEBPACK_IMPORTED_MODULE_1__.Rect.Empty());

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "logicalSpace", sentry_utils_profiling_gl_utils__WEBPACK_IMPORTED_MODULE_1__.Rect.Empty());

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "physicalToLogicalSpace", gl_matrix__WEBPACK_IMPORTED_MODULE_2__.create());

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "logicalToPhysicalSpace", gl_matrix__WEBPACK_IMPORTED_MODULE_2__.create());

    this.canvas = canvas;
    this.origin = origin;
    this.initPhysicalSpace();
  }

  initPhysicalSpace() {
    this.physicalSpace = new sentry_utils_profiling_gl_utils__WEBPACK_IMPORTED_MODULE_1__.Rect(this.origin[0], this.origin[1], this.canvas.width - this.origin[0], this.canvas.height - this.origin[1]);
    this.logicalSpace = this.physicalSpace.scale(1 / window.devicePixelRatio, 1 / window.devicePixelRatio);
    this.logicalToPhysicalSpace = (0,sentry_utils_profiling_gl_utils__WEBPACK_IMPORTED_MODULE_1__.transformMatrixBetweenRect)(this.logicalSpace, this.physicalSpace);
    this.physicalToLogicalSpace = (0,sentry_utils_profiling_gl_utils__WEBPACK_IMPORTED_MODULE_1__.transformMatrixBetweenRect)(this.physicalSpace, this.logicalSpace);
  }

}

/***/ }),

/***/ "./app/utils/profiling/flamegraphFrame.tsx":
/*!*************************************************!*\
  !*** ./app/utils/profiling/flamegraphFrame.tsx ***!
  \*************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "getFlamegraphFrameSearchId": () => (/* binding */ getFlamegraphFrameSearchId)
/* harmony export */ });
function getFlamegraphFrameSearchId(frame) {
  return frame.frame.name + (frame.frame.file ? frame.frame.file : '') + String(frame.start);
}

/***/ }),

/***/ "./app/utils/profiling/flamegraphView.tsx":
/*!************************************************!*\
  !*** ./app/utils/profiling/flamegraphView.tsx ***!
  \************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "FlamegraphView": () => (/* binding */ FlamegraphView)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var gl_matrix__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! gl-matrix */ "../node_modules/gl-matrix/esm/mat3.js");
/* harmony import */ var gl_matrix__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! gl-matrix */ "../node_modules/gl-matrix/esm/vec2.js");
/* harmony import */ var sentry_utils_profiling_gl_utils__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/utils/profiling/gl/utils */ "./app/utils/profiling/gl/utils.ts");



class FlamegraphView {
  constructor(_ref) {
    let {
      canvas,
      flamegraph,
      theme
    } = _ref;

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "flamegraph", void 0);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "theme", void 0);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "configView", sentry_utils_profiling_gl_utils__WEBPACK_IMPORTED_MODULE_1__.Rect.Empty());

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "configSpace", sentry_utils_profiling_gl_utils__WEBPACK_IMPORTED_MODULE_1__.Rect.Empty());

    this.flamegraph = flamegraph;
    this.theme = theme;
    this.initConfigSpace(canvas);
  }

  _initConfigSpace(canvas) {
    const BAR_HEIGHT = this.theme.SIZES.BAR_HEIGHT * window.devicePixelRatio;
    this.configSpace = new sentry_utils_profiling_gl_utils__WEBPACK_IMPORTED_MODULE_1__.Rect(0, 0, this.flamegraph.configSpace.width, Math.max(this.flamegraph.depth + this.theme.SIZES.FLAMEGRAPH_DEPTH_OFFSET + 1, canvas.physicalSpace.height / BAR_HEIGHT));
  }

  _initConfigView(canvas, space) {
    const BAR_HEIGHT = this.theme.SIZES.BAR_HEIGHT * window.devicePixelRatio;
    this.configView = sentry_utils_profiling_gl_utils__WEBPACK_IMPORTED_MODULE_1__.Rect.From(space).withHeight(canvas.physicalSpace.height / BAR_HEIGHT);
  }

  initConfigSpace(canvas) {
    this._initConfigSpace(canvas);

    this._initConfigView(canvas, this.configSpace);
  }

  resizeConfigSpace(canvas) {
    this._initConfigSpace(canvas);

    this._initConfigView(canvas, this.configView);
  }

  resetConfigView(canvas) {
    this._initConfigView(canvas, this.configSpace);
  }

  setConfigView(configView) {
    this.configView = (0,sentry_utils_profiling_gl_utils__WEBPACK_IMPORTED_MODULE_1__.computeClampedConfigView)(configView, {
      width: {
        min: this.flamegraph.profile.minFrameDuration,
        max: this.configSpace.width
      },
      height: {
        min: 0,
        max: this.configSpace.height
      }
    });
  }

  transformConfigView(transformation) {
    this.setConfigView(this.configView.transformRect(transformation));
  }

  toConfigSpace(space) {
    const toConfigSpace = (0,sentry_utils_profiling_gl_utils__WEBPACK_IMPORTED_MODULE_1__.transformMatrixBetweenRect)(space, this.configSpace);

    if (this.flamegraph.inverted) {
      gl_matrix__WEBPACK_IMPORTED_MODULE_2__.multiply(toConfigSpace, this.configSpace.invertYTransform(), toConfigSpace);
    }

    return toConfigSpace;
  }

  toConfigView(space) {
    const toConfigView = (0,sentry_utils_profiling_gl_utils__WEBPACK_IMPORTED_MODULE_1__.transformMatrixBetweenRect)(space, this.configView);

    if (this.flamegraph.inverted) {
      gl_matrix__WEBPACK_IMPORTED_MODULE_2__.multiply(toConfigView, this.configView.invertYTransform(), toConfigView);
    }

    return toConfigView;
  }

  fromConfigSpace(space) {
    const fromConfigSpace = (0,sentry_utils_profiling_gl_utils__WEBPACK_IMPORTED_MODULE_1__.transformMatrixBetweenRect)(this.configSpace, space);

    if (this.flamegraph.inverted) {
      gl_matrix__WEBPACK_IMPORTED_MODULE_2__.multiply(fromConfigSpace, space.invertYTransform(), fromConfigSpace);
    }

    return fromConfigSpace;
  }

  fromConfigView(space) {
    const fromConfigView = (0,sentry_utils_profiling_gl_utils__WEBPACK_IMPORTED_MODULE_1__.transformMatrixBetweenRect)(this.configView, space);

    if (this.flamegraph.inverted) {
      gl_matrix__WEBPACK_IMPORTED_MODULE_2__.multiply(fromConfigView, space.invertYTransform(), fromConfigView);
    }

    return fromConfigView;
  }

  getConfigSpaceCursor(logicalSpaceCursor, canvas) {
    const physicalSpaceCursor = gl_matrix__WEBPACK_IMPORTED_MODULE_3__.transformMat3(gl_matrix__WEBPACK_IMPORTED_MODULE_3__.create(), logicalSpaceCursor, canvas.logicalToPhysicalSpace);
    return gl_matrix__WEBPACK_IMPORTED_MODULE_3__.transformMat3(gl_matrix__WEBPACK_IMPORTED_MODULE_3__.create(), physicalSpaceCursor, this.toConfigSpace(canvas.physicalSpace));
  }

  getConfigViewCursor(logicalSpaceCursor, canvas) {
    const physicalSpaceCursor = gl_matrix__WEBPACK_IMPORTED_MODULE_3__.transformMat3(gl_matrix__WEBPACK_IMPORTED_MODULE_3__.create(), logicalSpaceCursor, canvas.logicalToPhysicalSpace);
    return gl_matrix__WEBPACK_IMPORTED_MODULE_3__.transformMat3(gl_matrix__WEBPACK_IMPORTED_MODULE_3__.create(), physicalSpaceCursor, this.toConfigView(canvas.physicalSpace));
  }

}

/***/ }),

/***/ "./app/utils/profiling/gl/utils.ts":
/*!*****************************************!*\
  !*** ./app/utils/profiling/gl/utils.ts ***!
  \*****************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "ELLIPSIS": () => (/* binding */ ELLIPSIS),
/* harmony export */   "Rect": () => (/* binding */ Rect),
/* harmony export */   "computeClampedConfigView": () => (/* binding */ computeClampedConfigView),
/* harmony export */   "computeConfigViewWithStategy": () => (/* binding */ computeConfigViewWithStategy),
/* harmony export */   "computeHighlightedBounds": () => (/* binding */ computeHighlightedBounds),
/* harmony export */   "createProgram": () => (/* binding */ createProgram),
/* harmony export */   "createShader": () => (/* binding */ createShader),
/* harmony export */   "findRangeBinarySearch": () => (/* binding */ findRangeBinarySearch),
/* harmony export */   "formatColorForFrame": () => (/* binding */ formatColorForFrame),
/* harmony export */   "getContext": () => (/* binding */ getContext),
/* harmony export */   "makeProjectionMatrix": () => (/* binding */ makeProjectionMatrix),
/* harmony export */   "measureText": () => (/* binding */ measureText),
/* harmony export */   "resizeCanvasToDisplaySize": () => (/* binding */ resizeCanvasToDisplaySize),
/* harmony export */   "transformMatrixBetweenRect": () => (/* binding */ transformMatrixBetweenRect),
/* harmony export */   "trimTextCenter": () => (/* binding */ trimTextCenter),
/* harmony export */   "watchForResize": () => (/* binding */ watchForResize)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/es.error.cause.js */ "../node_modules/core-js/modules/es.error.cause.js");
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var gl_matrix__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! gl-matrix */ "../node_modules/gl-matrix/esm/mat3.js");
/* harmony import */ var gl_matrix__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! gl-matrix */ "../node_modules/gl-matrix/esm/vec2.js");
/* harmony import */ var _colors_utils__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ../colors/utils */ "./app/utils/profiling/colors/utils.tsx");





function createShader(gl, type, source) {
  const shader = gl.createShader(type);

  if (!shader) {
    throw new Error('Could not create shader');
  }

  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  const success = gl.getShaderParameter(shader, gl.COMPILE_STATUS);

  if (success) {
    return shader;
  }

  gl.deleteShader(shader);
  throw new Error('Failed to compile shader');
}
function createProgram(gl, vertexShader, fragmentShader) {
  const program = gl.createProgram();

  if (!program) {
    throw new Error('Could not create program');
  }

  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  const success = gl.getProgramParameter(program, gl.LINK_STATUS);

  if (success) {
    return program;
  }

  gl.deleteProgram(program);
  throw new Error('Failed to create program');
} // Create a projection matrix with origins at 0,0 in top left corner, scaled to width/height

function makeProjectionMatrix(width, height) {
  const projectionMatrix = gl_matrix__WEBPACK_IMPORTED_MODULE_4__.create();
  gl_matrix__WEBPACK_IMPORTED_MODULE_4__.identity(projectionMatrix);
  gl_matrix__WEBPACK_IMPORTED_MODULE_4__.translate(projectionMatrix, projectionMatrix, gl_matrix__WEBPACK_IMPORTED_MODULE_5__.fromValues(-1, 1));
  gl_matrix__WEBPACK_IMPORTED_MODULE_4__.scale(projectionMatrix, projectionMatrix, gl_matrix__WEBPACK_IMPORTED_MODULE_5__.divide(gl_matrix__WEBPACK_IMPORTED_MODULE_5__.create(), gl_matrix__WEBPACK_IMPORTED_MODULE_5__.fromValues(2, -2), gl_matrix__WEBPACK_IMPORTED_MODULE_5__.fromValues(width, height)));
  return projectionMatrix;
}
const canvasToDisplaySizeMap = new Map();

function onResize(entries) {
  for (const entry of entries) {
    let width;
    let height;
    let dpr = window.devicePixelRatio; // @ts-ignore use as a progressive enhancement, some browsers don't support this yet

    if (entry.devicePixelContentBoxSize) {
      // NOTE: Only this path gives the correct answer
      // The other paths are imperfect fallbacks
      // for browsers that don't provide anyway to do this
      // @ts-ignore
      width = entry.devicePixelContentBoxSize[0].inlineSize; // @ts-ignore

      height = entry.devicePixelContentBoxSize[0].blockSize;
      dpr = 1; // it's already in width and height
    } else if (entry.contentBoxSize) {
      if (entry.contentBoxSize[0]) {
        width = entry.contentBoxSize[0].inlineSize;
        height = entry.contentBoxSize[0].blockSize;
      } else {
        // @ts-ignore
        width = entry.contentBoxSize.inlineSize; // @ts-ignore

        height = entry.contentBoxSize.blockSize;
      }
    } else {
      width = entry.contentRect.width;
      height = entry.contentRect.height;
    }

    const displayWidth = Math.round(width * dpr);
    const displayHeight = Math.round(height * dpr);
    canvasToDisplaySizeMap.set(entry.target, [displayWidth, displayHeight]);
    resizeCanvasToDisplaySize(entry.target);
  }
}

const watchForResize = (canvas, callback) => {
  const handler = entries => {
    onResize(entries);
    callback === null || callback === void 0 ? void 0 : callback();
  };

  for (const c of canvas) {
    canvasToDisplaySizeMap.set(c, [c.width, c.height]);
  }

  const resizeObserver = new ResizeObserver(handler);

  try {
    // only call us of the number of device pixels changed
    canvas.forEach(c => {
      resizeObserver.observe(c, {
        box: 'device-pixel-content-box'
      });
    });
  } catch (ex) {
    // device-pixel-content-box is not supported so fallback to this
    canvas.forEach(c => {
      resizeObserver.observe(c, {
        box: 'content-box'
      });
    });
  }

  return resizeObserver;
};
function resizeCanvasToDisplaySize(canvas) {
  // Get the size the browser is displaying the canvas in device pixels.
  const size = canvasToDisplaySizeMap.get(canvas);

  if (!size) {
    const displayWidth = canvas.clientWidth * window.devicePixelRatio;
    const displayHeight = canvas.clientHeight * window.devicePixelRatio;
    canvas.width = displayWidth;
    canvas.height = displayHeight;
    return false;
  }

  const [displayWidth, displayHeight] = size; // Check if the canvas is not the same size.

  const needResize = canvas.width !== displayWidth || canvas.height !== displayHeight;

  if (needResize) {
    // Make the canvas the same size
    canvas.width = displayWidth;
    canvas.height = displayHeight;
  }

  return needResize;
}
function transformMatrixBetweenRect(from, to) {
  return gl_matrix__WEBPACK_IMPORTED_MODULE_4__.fromValues(to.width / from.width, 0, 0, 0, to.height / from.height, 0, to.x - from.x * (to.width / from.width), to.y - from.y * (to.height / from.height), 1);
} // Utility class to manipulate a virtual rect element. Some of the implementations are based off
// speedscope, however they are not 100% accurate and we've made some changes. It is important to
// note that contructing a lot of these objects at draw time is expensive and should be avoided.

class Rect {
  constructor(x, y, width, height) {
    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "origin", void 0);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "size", void 0);

    this.origin = gl_matrix__WEBPACK_IMPORTED_MODULE_5__.fromValues(x, y);
    this.size = gl_matrix__WEBPACK_IMPORTED_MODULE_5__.fromValues(width, height);
  }

  clone() {
    return Rect.From(this);
  }

  isValid() {
    return this.toMatrix().every(n => !isNaN(n));
  }

  isEmpty() {
    return this.width === 0 && this.height === 0;
  }

  static Empty() {
    return new Rect(0, 0, 0, 0);
  }

  static From(rect) {
    return new Rect(rect.x, rect.y, rect.width, rect.height);
  }

  get x() {
    return this.origin[0];
  }

  get y() {
    return this.origin[1];
  }

  get width() {
    return this.size[0];
  }

  get height() {
    return this.size[1];
  }

  get left() {
    return this.x;
  }

  get right() {
    return this.left + this.width;
  }

  get top() {
    return this.y;
  }

  get bottom() {
    return this.top + this.height;
  }

  static decode(query) {
    let maybeEncodedRect = query;

    if (typeof query === 'string') {
      maybeEncodedRect = query.split(',');
    }

    if (!Array.isArray(maybeEncodedRect)) {
      return null;
    }

    if (maybeEncodedRect.length !== 4) {
      return null;
    }

    const rect = new Rect(...maybeEncodedRect.map(p => parseFloat(p)));

    if (rect.isValid()) {
      return rect;
    }

    return null;
  }

  static encode(rect) {
    return rect.toString();
  }

  toString() {
    return [this.x, this.y, this.width, this.height].map(n => Math.round(n)).join(',');
  }

  toMatrix() {
    const {
      width: w,
      height: h,
      x,
      y
    } = this; // it's easier to display a matrix as a 3x3 array. WebGl matrices are row first and not column first
    // https://webglfundamentals.org/webgl/lessons/webgl-matrix-vs-math.html
    // prettier-ignore

    return gl_matrix__WEBPACK_IMPORTED_MODULE_4__.fromValues(w, 0, 0, 0, h, 0, x, y, 1);
  }

  hasIntersectionWith(other) {
    const top = Math.max(this.top, other.top);
    const bottom = Math.max(top, Math.min(this.bottom, other.bottom));

    if (bottom - top === 0) {
      return false;
    }

    const left = Math.max(this.left, other.left);
    const right = Math.max(left, Math.min(this.right, other.right));

    if (right - left === 0) {
      return false;
    }

    return true;
  }

  containsX(vec) {
    return vec[0] >= this.left && vec[0] <= this.right;
  }

  containsY(vec) {
    return vec[1] >= this.top && vec[1] <= this.bottom;
  }

  contains(vec) {
    return this.containsX(vec) && this.containsY(vec);
  }

  containsRect(rect) {
    return (// left bound
      this.left <= rect.left && // right bound
      rect.right <= this.right && // top bound
      this.top <= rect.top && // bottom bound
      rect.bottom <= this.bottom
    );
  }

  leftOverlapsWith(rect) {
    return rect.left <= this.left && rect.right >= this.left;
  }

  rightOverlapsWith(rect) {
    return this.right >= rect.left && this.right <= rect.right;
  }

  overlapsX(other) {
    return this.left <= other.right && this.right >= other.left;
  }

  overlapsY(other) {
    return this.top <= other.bottom && this.bottom >= other.top;
  }

  overlaps(other) {
    return this.overlapsX(other) && this.overlapsY(other);
  }

  transformRect(transform) {
    const x = this.x * transform[0] + this.y * transform[3] + transform[6];
    const y = this.x * transform[1] + this.y * transform[4] + transform[7];
    const width = this.width * transform[0] + this.height * transform[3];
    const height = this.width * transform[1] + this.height * transform[4];
    return new Rect(x + (width < 0 ? width : 0), y + (height < 0 ? height : 0), Math.abs(width), Math.abs(height));
  }
  /**
   * Returns a transform that inverts the y axis within the rect.
   * This causes the bottom of the rect to be the top of the rect and vice versa.
   */


  invertYTransform() {
    return gl_matrix__WEBPACK_IMPORTED_MODULE_4__.fromValues(1, 0, 0, 0, -1, 0, 0, this.y * 2 + this.height, 1);
  }

  withHeight(height) {
    return new Rect(this.x, this.y, this.width, height);
  }

  withWidth(width) {
    return new Rect(this.x, this.y, width, this.height);
  }

  withX(x) {
    return new Rect(x, this.y, this.width, this.height);
  }

  withY(y) {
    return new Rect(this.x, y, this.width, this.height);
  }

  toBounds() {
    return [this.x, this.y, this.x + this.width, this.y + this.height];
  }

  toArray() {
    return [this.x, this.y, this.width, this.height];
  }

  between(to) {
    return new Rect(to.x, to.y, to.width / this.width, to.height / this.height);
  }

  translate(x, y) {
    return new Rect(x, y, this.width, this.height);
  }

  translateX(x) {
    return new Rect(x, this.y, this.width, this.height);
  }

  translateY(y) {
    return new Rect(this.x, y, this.width, this.height);
  }

  scaleX(x) {
    return new Rect(this.x, this.y, this.width * x, this.height);
  }

  scaleY(y) {
    return new Rect(this.x, this.y, this.width, this.height * y);
  }

  scale(x, y) {
    return new Rect(this.x * x, this.y * y, this.width * x, this.height * y);
  }

  scaleOriginBy(x, y) {
    return new Rect(this.x * x, this.y * y, this.width, this.height);
  }

  scaledBy(x, y) {
    return new Rect(this.x, this.y, this.width * x, this.height * y);
  }

  equals(rect) {
    if (this.x !== rect.x) {
      return false;
    }

    if (this.y !== rect.y) {
      return false;
    }

    if (this.width !== rect.width) {
      return false;
    }

    if (this.height !== rect.height) {
      return false;
    }

    return true;
  }

  notEqualTo(rect) {
    return !this.equals(rect);
  }

}

function getContext(canvas, context) {
  const ctx = context === 'webgl' ? canvas.getContext(context, {
    antialias: false
  }) : canvas.getContext(context);

  if (!ctx) {
    throw new Error(`Could not get context ${context}`);
  }

  return ctx;
} // Exported separately as writing export function for each overload as
// breaks the line width rules and makes it harder to read.



function measureText(string, ctx) {
  if (!string) {
    return Rect.Empty();
  }

  const context = ctx || getContext(document.createElement('canvas'), '2d');
  const measures = context.measureText(string);
  return new Rect(0, 0, measures.width, // https://stackoverflow.com/questions/1134586/how-can-you-find-the-height-of-text-on-an-html-canvas
  measures.actualBoundingBoxAscent + measures.actualBoundingBoxDescent);
} // Taken from speedscope, computes min/max by halving the high/low end
// of the range on each iteration as long as range precision is greater than the given precision.

function findRangeBinarySearch(_ref, fn, target) {
  let {
    low,
    high
  } = _ref;
  let precision = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : 1;

  // eslint-disable-next-line
  while (true) {
    if (high - low <= precision) {
      return [low, high];
    }

    const mid = (high + low) / 2;

    if (fn(mid) < target) {
      low = mid;
    } else {
      high = mid;
    }
  }
}
function formatColorForFrame(frame, renderer) {
  const color = renderer.getColorForFrame(frame);

  if (color.length === 4) {
    return `rgba(${color.slice(0, 3).map(n => n * 255).join(',')}, ${color[3]})`;
  }

  return `rgba(${color.map(n => n * 255).join(',')}, 1.0)`;
}
const ELLIPSIS = '\u2026';
// Similar to speedscope's implementation, utility fn to trim text in the center with a small bias towards prefixes.
function trimTextCenter(text, low) {
  if (low >= text.length) {
    return {
      text,
      start: 0,
      end: 0,
      length: 0
    };
  }

  const prefixLength = Math.floor(low / 2); // Use 1 character less than the low value to account for ellipsis and favor displaying the prefix

  const postfixLength = low - prefixLength - 1;
  const start = prefixLength;
  const end = Math.floor(text.length - postfixLength + ELLIPSIS.length);
  const trimText = `${text.substring(0, start)}${ELLIPSIS}${text.substring(end)}`;
  return {
    text: trimText,
    start,
    end,
    length: end - start
  };
} // Utility function to compute a clamped view. This is essentially a bounds check
// to ensure that zoomed viewports stays in the bounds and does not escape the view.

function computeClampedConfigView(newConfigView, _ref2) {
  let {
    width,
    height
  } = _ref2;

  if (!newConfigView.isValid()) {
    throw new Error(newConfigView.toString());
  }

  const clampedWidth = (0,_colors_utils__WEBPACK_IMPORTED_MODULE_3__.clamp)(newConfigView.width, width.min, width.max);
  const clampedHeight = (0,_colors_utils__WEBPACK_IMPORTED_MODULE_3__.clamp)(newConfigView.height, height.min, height.max);
  const maxX = width.max - clampedWidth;
  const maxY = clampedHeight >= height.max ? 0 : height.max - clampedHeight;
  const clampedX = (0,_colors_utils__WEBPACK_IMPORTED_MODULE_3__.clamp)(newConfigView.x, 0, maxX);
  const clampedY = (0,_colors_utils__WEBPACK_IMPORTED_MODULE_3__.clamp)(newConfigView.y, 0, maxY);
  return new Rect(clampedX, clampedY, clampedWidth, clampedHeight);
}
/**
 * computeHighlightedBounds determines if a supplied boundary should be reduced in size
 * or shifted based on the results of a trim operation
 */

function computeHighlightedBounds(bounds, trim) {
  if (!trim.length) {
    return bounds;
  }

  const isStartBetweenTrim = bounds[0] >= trim.start && bounds[0] <= trim.end;
  const isEndBetweenTrim = bounds[1] >= trim.start && bounds[1] <= trim.end;
  const isFullyTruncated = isStartBetweenTrim && isEndBetweenTrim; // example:
  // -[UIScrollView _smoothScrollDisplayLink:]
  // "smooth" in "-[UIScrollView _…ScrollDisplayLink:]"
  //                              ^^

  if (isFullyTruncated) {
    return [trim.start, trim.start + 1];
  }

  if (bounds[0] < trim.start) {
    // "ScrollView" in '-[UIScrollView _sm…rollDisplayLink:]'
    //                      ^--------^
    if (bounds[1] < trim.start) {
      return [bounds[0], bounds[1]];
    } // "smoothScroll" in -[UIScrollView _smooth…DisplayLink:]'
    //                                   ^-----^


    if (isEndBetweenTrim) {
      return [bounds[0], trim.start + 1];
    } // "smoothScroll" in -[UIScrollView _sm…llDisplayLink:]'
    //                                   ^---^


    if (bounds[1] > trim.end) {
      return [bounds[0], bounds[1] - trim.length + 1];
    }
  } // "smoothScroll" in -[UIScrollView _…scrollDisplayLink:]'
  //                                   ^-----^


  if (isStartBetweenTrim && bounds[1] > trim.end) {
    return [trim.start, bounds[1] - trim.length + 1];
  } // "display" in -[UIScrollView _…scrollDisplayLink:]'
  //                                     ^-----^


  if (bounds[0] > trim.end) {
    return [bounds[0] - trim.length + 1, bounds[1] - trim.length + 1];
  }

  throw new Error(`Unhandled case: ${JSON.stringify(bounds)} ${trim}`);
} // Utility function to allow zooming into frames using a specific strategy. Supports
// min zooming and exact strategy. Min zooming means we will zoom into a frame by doing
// the minimal number of moves to get a frame into view - for example, if the view is large
// enough and the frame we are zooming to is just outside of the viewport to the right,
// we will only move the viewport to the right until the frame is in view. Exact strategy
// means we will zoom into the frame by moving the viewport to the exact location of the frame
// and setting the width of the view to that of the frame.

function computeConfigViewWithStategy(strategy, view, frame) {
  if (strategy === 'exact') {
    return frame.withHeight(view.height);
  }

  if (strategy === 'min') {
    if (view.width <= frame.width) {
      // If view width <= frame width, we need to zoom out, so the behavior is the
      // same as if we were using 'exact'
      return frame.withHeight(view.height);
    }

    if (view.containsRect(frame)) {
      // If frame is in view, do nothing
      return view;
    }

    let offset = view.clone();

    if (frame.left < view.left) {
      // If frame is to the left of the view, translate it left
      // to frame.x so that start of the frame is in the view
      offset = offset.withX(frame.x);
    } else if (frame.right > view.right) {
      // If the right boundary of a frame is outside of the view, translate the view
      // by the difference between the right edge of the frame and the right edge of the view
      offset = view.withX(offset.x + frame.right - offset.right);
    }

    if (frame.bottom < view.top) {
      // If frame is above the view, translate view to top of frame
      offset = offset.withY(frame.top);
    } else if (frame.bottom > view.bottom) {
      // If frame is below the view, translate view by the difference
      // of the bottom edge of the frame and the view
      offset = offset.translateY(offset.y + frame.bottom - offset.bottom);
    }

    return offset;
  }

  return frame.withHeight(view.height);
}

/***/ }),

/***/ "./app/utils/profiling/hooks/useContextMenu.tsx":
/*!******************************************************!*\
  !*** ./app/utils/profiling/hooks/useContextMenu.tsx ***!
  \******************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "computeBestContextMenuPosition": () => (/* binding */ computeBestContextMenuPosition),
/* harmony export */   "useContextMenu": () => (/* binding */ useContextMenu)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_utils_profiling_colors_utils__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/utils/profiling/colors/utils */ "./app/utils/profiling/colors/utils.tsx");
/* harmony import */ var sentry_utils_profiling_gl_utils__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/utils/profiling/gl/utils */ "./app/utils/profiling/gl/utils.ts");
/* harmony import */ var _useKeyboardNavigation__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ./useKeyboardNavigation */ "./app/utils/profiling/hooks/useKeyboardNavigation.tsx");





function computeBestContextMenuPosition(mouse, container, target) {
  const maxY = Math.floor(container.height - target.height);
  const minY = container.top;
  const minX = container.left;
  const maxX = Math.floor(container.right - target.width); // We add a tiny offset so that the menu is not directly where the user places their cursor.

  const OFFSET = 6;
  return {
    left: (0,sentry_utils_profiling_colors_utils__WEBPACK_IMPORTED_MODULE_2__.clamp)(mouse.x + OFFSET, minX, maxX),
    top: (0,sentry_utils_profiling_colors_utils__WEBPACK_IMPORTED_MODULE_2__.clamp)(mouse.y + OFFSET, minY, maxY)
  };
}
function useContextMenu(_ref) {
  let {
    container
  } = _ref;
  const [open, setOpen] = (0,react__WEBPACK_IMPORTED_MODULE_1__.useState)(false);
  const [menuCoordinates, setMenuCoordinates] = (0,react__WEBPACK_IMPORTED_MODULE_1__.useState)(null);
  const [contextMenuCoordinates, setContextMenuCoordinates] = (0,react__WEBPACK_IMPORTED_MODULE_1__.useState)(null);
  const [containerCoordinates, setContainerCoordinates] = (0,react__WEBPACK_IMPORTED_MODULE_1__.useState)(null);
  const itemProps = (0,_useKeyboardNavigation__WEBPACK_IMPORTED_MODULE_4__.useKeyboardNavigation)(); // We wrap the setOpen function in a useEffect so that we also clear the keyboard
  // tabIndex when a menu is closed. This prevents tabIndex from being persisted between render

  const wrapSetOpen = (0,react__WEBPACK_IMPORTED_MODULE_1__.useCallback)(newOpen => {
    if (!newOpen) {
      itemProps.setTabIndex(null);
    }

    setOpen(newOpen);
  }, [itemProps]);
  const getMenuProps = (0,react__WEBPACK_IMPORTED_MODULE_1__.useCallback)(() => {
    const menuProps = itemProps.getMenuProps();
    return { ...menuProps,
      onKeyDown: evt => {
        if (evt.key === 'Escape') {
          wrapSetOpen(false);
        }

        menuProps.onKeyDown(evt);
      }
    };
  }, [itemProps, wrapSetOpen]);
  const getMenuItemProps = (0,react__WEBPACK_IMPORTED_MODULE_1__.useCallback)(() => {
    const menuItemProps = itemProps.getItemProps();
    return { ...menuItemProps,
      onKeyDown: evt => {
        if (evt.key === 'Escape') {
          wrapSetOpen(false);
        }

        menuItemProps.onKeyDown(evt);
      }
    };
  }, [itemProps, wrapSetOpen]);
  const handleContextMenu = (0,react__WEBPACK_IMPORTED_MODULE_1__.useCallback)(evt => {
    if (!container) {
      return;
    }

    evt.preventDefault();
    evt.stopPropagation();
    const parentPosition = container.getBoundingClientRect();
    setContextMenuCoordinates(new sentry_utils_profiling_gl_utils__WEBPACK_IMPORTED_MODULE_3__.Rect(evt.clientX - parentPosition.left, evt.clientY - parentPosition.top, 0, 0));
    wrapSetOpen(true);
  }, [wrapSetOpen, container]);
  (0,react__WEBPACK_IMPORTED_MODULE_1__.useEffect)(() => {
    const listener = event => {
      // Do nothing if clicking ref's element or descendent elements
      if (!itemProps.menuRef || itemProps.menuRef.contains(event.target)) {
        return;
      }

      setOpen(false);
    };

    document.addEventListener('mousedown', listener);
    document.addEventListener('touchstart', listener);
    return () => {
      document.removeEventListener('mousedown', listener);
      document.removeEventListener('touchstart', listener);
    };
  }, [itemProps.menuRef]); // Observe the menu

  (0,react__WEBPACK_IMPORTED_MODULE_1__.useEffect)(() => {
    if (!itemProps.menuRef) {
      return undefined;
    }

    const resizeObserver = new window.ResizeObserver(entries => {
      const contentRect = entries[0].contentRect;
      setMenuCoordinates(new sentry_utils_profiling_gl_utils__WEBPACK_IMPORTED_MODULE_3__.Rect(0, 0, contentRect.width, contentRect.height));
    });
    resizeObserver.observe(itemProps.menuRef);
    return () => {
      resizeObserver.disconnect();
    };
  }, [itemProps.menuRef]); // Observe the container

  (0,react__WEBPACK_IMPORTED_MODULE_1__.useEffect)(() => {
    if (!container) {
      return undefined;
    }

    const resizeObserver = new window.ResizeObserver(entries => {
      const contentRect = entries[0].contentRect;
      setContainerCoordinates(new sentry_utils_profiling_gl_utils__WEBPACK_IMPORTED_MODULE_3__.Rect(0, 0, contentRect.width, contentRect.height));
    });
    resizeObserver.observe(container);
    return () => {
      resizeObserver.disconnect();
    };
  }, [container]);
  const position = contextMenuCoordinates && containerCoordinates && menuCoordinates ? computeBestContextMenuPosition(contextMenuCoordinates, containerCoordinates, menuCoordinates) : null;
  return {
    open,
    setOpen: wrapSetOpen,
    position,
    containerCoordinates,
    contextMenuCoordinates: position,
    menuRef: itemProps.menuRef,
    handleContextMenu,
    getMenuProps,
    getMenuItemProps
  };
}

/***/ }),

/***/ "./app/utils/profiling/hooks/useInternalFlamegraphDebugMode.ts":
/*!*********************************************************************!*\
  !*** ./app/utils/profiling/hooks/useInternalFlamegraphDebugMode.ts ***!
  \*********************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "useInternalFlamegraphDebugMode": () => (/* binding */ useInternalFlamegraphDebugMode)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");


const FLAMEGRAPH_DEBUG_MODE_KEY = '__fgdb__';
function useInternalFlamegraphDebugMode() {
  const [isEnabled, setIsEnabled] = (0,react__WEBPACK_IMPORTED_MODULE_1__.useState)(sessionStorage.getItem(FLAMEGRAPH_DEBUG_MODE_KEY) === '1');
  (0,react__WEBPACK_IMPORTED_MODULE_1__.useEffect)(() => {
    function handleKeyDown(evt) {
      const isCtrlOrMeta = evt.ctrlKey || evt.metaKey;

      if (isCtrlOrMeta && evt.shiftKey && evt.code === 'KeyI') {
        setIsEnabled(val => {
          const next = !val;

          if (next) {
            sessionStorage.setItem(FLAMEGRAPH_DEBUG_MODE_KEY, '1');
          } else {
            sessionStorage.removeItem(FLAMEGRAPH_DEBUG_MODE_KEY);
          }

          return next;
        });
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });
  return isEnabled;
}

/***/ }),

/***/ "./app/utils/profiling/hooks/useKeyboardNavigation.tsx":
/*!*************************************************************!*\
  !*** ./app/utils/profiling/hooks/useKeyboardNavigation.tsx ***!
  \*************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "useKeyboardNavigation": () => (/* binding */ useKeyboardNavigation),
/* harmony export */   "useRovingTabIndex": () => (/* binding */ useRovingTabIndex)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");


function useRovingTabIndex(items) {
  const [tabIndex, setTabIndex] = (0,react__WEBPACK_IMPORTED_MODULE_1__.useState)(null);
  const onKeyDown = (0,react__WEBPACK_IMPORTED_MODULE_1__.useCallback)(evt => {
    if (items.length === 0) {
      return;
    }

    if (evt.key === 'Escape') {
      setTabIndex(null);
    }

    if (evt.key === 'ArrowDown' || evt.key === 'Tab') {
      evt.preventDefault();

      if (tabIndex === items.length - 1 || tabIndex === null) {
        setTabIndex(0);
      } else {
        setTabIndex((tabIndex !== null && tabIndex !== void 0 ? tabIndex : 0) + 1);
      }
    }

    if (evt.key === 'ArrowUp' || evt.key === 'Tab' && evt.shiftKey) {
      evt.preventDefault();

      if (tabIndex === 0 || tabIndex === null) {
        setTabIndex(items.length - 1);
      } else {
        setTabIndex((tabIndex !== null && tabIndex !== void 0 ? tabIndex : 0) - 1);
      }
    }
  }, [tabIndex, items]);
  return {
    tabIndex,
    setTabIndex,
    onKeyDown
  };
}
function useKeyboardNavigation() {
  const [menuRef, setMenuRef] = (0,react__WEBPACK_IMPORTED_MODULE_1__.useState)(null);
  const items = [];
  const {
    tabIndex,
    setTabIndex,
    onKeyDown
  } = useRovingTabIndex(items);
  (0,react__WEBPACK_IMPORTED_MODULE_1__.useEffect)(() => {
    if (menuRef) {
      if (tabIndex === null) {
        menuRef.focus();
      }
    }
  }, [menuRef, tabIndex]);

  function getMenuProps() {
    return {
      tabIndex: -1,
      ref: setMenuRef,
      onKeyDown
    };
  }

  function getItemProps() {
    const idx = items.length;
    items.push({
      id: idx,
      node: null
    });
    return {
      tabIndex: tabIndex === idx ? 0 : -1,
      ref: node => {
        if (items[idx]) {
          if (tabIndex === idx) {
            node === null || node === void 0 ? void 0 : node.focus();
          }

          items[idx].node = node;
        }
      },
      onMouseEnter: () => {
        setTabIndex(idx);
      },
      onKeyDown
    };
  }

  return {
    menuRef,
    getItemProps,
    getMenuProps,
    tabIndex,
    setTabIndex
  };
}

/***/ }),

/***/ "./app/utils/profiling/hooks/useResizableDrawer.tsx":
/*!**********************************************************!*\
  !*** ./app/utils/profiling/hooks/useResizableDrawer.tsx ***!
  \**********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "useResizableDrawer": () => (/* binding */ useResizableDrawer)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");


function useResizableDrawer(options) {
  const rafIdRef = (0,react__WEBPACK_IMPORTED_MODULE_1__.useRef)(null);
  const startResizeVectorRef = (0,react__WEBPACK_IMPORTED_MODULE_1__.useRef)(null);
  const [dimensions, setDimensions] = (0,react__WEBPACK_IMPORTED_MODULE_1__.useState)([options.initialDimensions[0], options.initialDimensions[1]]); // We intentionally fire this once at mount to ensure the dimensions are set and
  // any potentional values set by CSS will be overriden.

  (0,react__WEBPACK_IMPORTED_MODULE_1__.useEffect)(() => {
    options.onResize(options.initialDimensions); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options.direction]);
  const dimensionsRef = (0,react__WEBPACK_IMPORTED_MODULE_1__.useRef)(dimensions);
  dimensionsRef.current = dimensions;
  const onMouseMove = (0,react__WEBPACK_IMPORTED_MODULE_1__.useCallback)(event => {
    document.body.style.pointerEvents = 'none';
    document.body.style.userSelect = 'none';

    if (rafIdRef.current !== null) {
      window.cancelAnimationFrame(rafIdRef.current);
    }

    rafIdRef.current = window.requestAnimationFrame(() => {
      var _options$min$;

      if (!startResizeVectorRef.current) {
        return;
      }

      const currentPositionVector = [event.clientX, event.clientY];
      const distance = [startResizeVectorRef.current[0] - currentPositionVector[0], startResizeVectorRef.current[1] - currentPositionVector[1]];
      startResizeVectorRef.current = currentPositionVector;
      const newDimensions = [// Round to 1px precision
      Math.round(Math.max(options.min[0], dimensionsRef.current[0] + distance[0] * (options.direction === 'horizontal-ltr' ? -1 : 1))), // Round to 1px precision
      Math.round(Math.max((_options$min$ = options.min[1]) !== null && _options$min$ !== void 0 ? _options$min$ : 0, dimensionsRef.current[1] + distance[1]))];
      options.onResize(newDimensions);
      setDimensions(newDimensions);
    });
  }, [options]);
  const onMouseUp = (0,react__WEBPACK_IMPORTED_MODULE_1__.useCallback)(() => {
    document.body.style.pointerEvents = '';
    document.body.style.userSelect = '';
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
  }, [onMouseMove]);
  const onMouseDown = (0,react__WEBPACK_IMPORTED_MODULE_1__.useCallback)(evt => {
    startResizeVectorRef.current = [evt.clientX, evt.clientY];
    document.addEventListener('mousemove', onMouseMove, {
      passive: true
    });
    document.addEventListener('mouseup', onMouseUp);
  }, [onMouseMove, onMouseUp]);
  (0,react__WEBPACK_IMPORTED_MODULE_1__.useEffect)(() => {
    return () => {
      if (rafIdRef.current !== null) {
        window.cancelAnimationFrame(rafIdRef.current);
      }
    };
  });
  return {
    dimensions,
    onMouseDown
  };
}

/***/ }),

/***/ "./app/utils/profiling/hooks/useVirtualizedTree/VirtualizedTree.tsx":
/*!**************************************************************************!*\
  !*** ./app/utils/profiling/hooks/useVirtualizedTree/VirtualizedTree.tsx ***!
  \**************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "VirtualizedTree": () => (/* binding */ VirtualizedTree)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var _VirtualizedTreeNode__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./VirtualizedTreeNode */ "./app/utils/profiling/hooks/useVirtualizedTree/VirtualizedTreeNode.tsx");



class VirtualizedTree {
  constructor(roots, flattenedList) {
    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "roots", []);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "flattened", []);

    this.roots = roots;
    this.flattened = flattenedList || VirtualizedTree.toExpandedList(this.roots);
  } // Rebuilds the tree


  static fromRoots(items) {
    let skipFn = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : () => false;
    let expandedNodes = arguments.length > 2 ? arguments[2] : undefined;
    const roots = [];

    function toTreeNode(node, parent, collection, depth) {
      const treeNode = new _VirtualizedTreeNode__WEBPACK_IMPORTED_MODULE_2__.VirtualizedTreeNode(node, parent, depth, expandedNodes ? expandedNodes.has(node) : false); // We cannot skip root nodes, so we check that the parent is not null.
      // If the node should be skipped, then we don't add it to the tree and descend
      // into its children without incrementing the depth.

      if (parent && skipFn(treeNode)) {
        for (let i = 0; i < node.children.length; i++) {
          toTreeNode(node.children[i], treeNode, parent.children, depth);
        }

        return;
      }

      if (collection) {
        collection.push(treeNode);
      }

      for (let i = 0; i < node.children.length; i++) {
        toTreeNode(node.children[i], treeNode, treeNode.children, depth + 1);
      }
    }

    for (let i = 0; i < items.length; i++) {
      toTreeNode(items[i], null, roots, 0);
    }

    return new VirtualizedTree(roots, undefined);
  } // Returns a list of nodes that are visible in the tree.


  static toExpandedList(nodes) {
    const list = [];

    function visit(node) {
      list.push(node);

      if (!node.expanded) {
        return;
      }

      for (let i = 0; i < node.children.length; i++) {
        visit(node.children[i]);
      }
    }

    for (let i = 0; i < nodes.length; i++) {
      visit(nodes[i]);
    }

    return list;
  }

  expandNode(node, value, opts) {
    // Because node.setExpanded handles toggling the node and all it's children, we still need to update the
    // flattened list. To do that w/o having to rebuild the entire tree, we can just remove the node and add them
    const removedOrAddedNodes = node.setExpanded(value, opts); // If toggling the node resulted in no changes to the actual tree, do nothing

    if (!removedOrAddedNodes.length) {
      return removedOrAddedNodes;
    } // If a node was expanded, we need to add all of its children to the flattened list.


    if (node.expanded) {
      this.flattened.splice(this.flattened.indexOf(node) + 1, 0, ...removedOrAddedNodes);
    } else {
      // If a node was collapsed, we need to remove all of its children from the flattened list.
      this.flattened.splice(this.flattened.indexOf(node) + 1, removedOrAddedNodes.length);
    }

    return removedOrAddedNodes;
  } // Sorts the entire tree and rebuilds the flattened list.


  sort(sortFn) {
    if (!this.roots.length) {
      return;
    }

    function visit(node) {
      const sortedChildren = node.children.sort(sortFn);

      for (let i = 0; i < sortedChildren.length; i++) {
        visit(sortedChildren[i]);
      }
    }

    const sortedRoots = this.roots.sort(sortFn);

    for (let i = 0; i < sortedRoots.length; i++) {
      visit(sortedRoots[i]);
    }

    this.flattened = VirtualizedTree.toExpandedList(this.roots);
  }

  getAllExpandedNodes(previouslyExpandedNodes) {
    const expandedNodes = new Set([...previouslyExpandedNodes]);

    function visit(node) {
      if (node.expanded) {
        expandedNodes.add(node.node);
      }

      for (let i = 0; i < node.children.length; i++) {
        visit(node.children[i]);
      }
    }

    for (let i = 0; i < this.roots.length; i++) {
      visit(this.roots[i]);
    }

    return expandedNodes;
  }

}

/***/ }),

/***/ "./app/utils/profiling/hooks/useVirtualizedTree/VirtualizedTreeNode.tsx":
/*!******************************************************************************!*\
  !*** ./app/utils/profiling/hooks/useVirtualizedTree/VirtualizedTreeNode.tsx ***!
  \******************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "VirtualizedTreeNode": () => (/* binding */ VirtualizedTreeNode)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/es.error.cause.js */ "../node_modules/core-js/modules/es.error.cause.js");
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_2__);



class VirtualizedTreeNode {
  constructor(node, parent, depth) {
    let expanded = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : false;

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "node", void 0);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "parent", void 0);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "children", void 0);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "expanded", void 0);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "depth", void 0);

    this.node = node;
    this.parent = parent;
    this.expanded = expanded !== null && expanded !== void 0 ? expanded : false;
    this.children = [];
    this.depth = depth;
  }

  getVisibleChildrenCount() {
    if (!this.expanded || !this.children.length) {
      return 0;
    }

    let count = 0;
    const queue = [...this.children];

    while (queue.length > 0) {
      const next = queue.pop();

      if (next === undefined) {
        throw new Error('Undefined queue node, this should never happen');
      }

      if (next.expanded) {
        for (let i = 0; i < next.children.length; i++) {
          queue.push(next.children[i]);
        }
      }

      count++;
    }

    return count;
  }

  setExpanded(value, opts) {
    if (value === this.expanded) {
      return [];
    } // We are closing a node, so we need to remove all of its children. To do that, we just get the
    // count of visible children and return it.


    if (!value) {
      const removedCount = this.getVisibleChildrenCount();
      this.expanded = value;
      return new Array(removedCount);
    } // If we are opening a node, we need to add all of its children to the list and insert it


    this.expanded = value; // Collect the newly visible children.

    const list = [];

    function visit(node) {
      if (opts !== null && opts !== void 0 && opts.expandChildren) {
        node.expanded = true;
      }

      list.push(node);

      if (!node.expanded) {
        return;
      }

      for (let i = 0; i < node.children.length; i++) {
        visit(node.children[i]);
      }
    }

    for (let i = 0; i < this.children.length; i++) {
      visit(this.children[i]);
    }

    return list;
  }

}

/***/ }),

/***/ "./app/utils/profiling/hooks/useVirtualizedTree/useVirtualizedTree.tsx":
/*!*****************************************************************************!*\
  !*** ./app/utils/profiling/hooks/useVirtualizedTree/useVirtualizedTree.tsx ***!
  \*****************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "VirtualizedTreeStateReducer": () => (/* binding */ VirtualizedTreeStateReducer),
/* harmony export */   "useVirtualizedTree": () => (/* binding */ useVirtualizedTree)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var _emotion_react__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! @emotion/react */ "../node_modules/@emotion/react/dist/emotion-element-cbed451f.browser.esm.js");
/* harmony import */ var sentry_utils_useEffectAfterFirstRender__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/utils/useEffectAfterFirstRender */ "./app/utils/useEffectAfterFirstRender.ts");
/* harmony import */ var _VirtualizedTree__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./VirtualizedTree */ "./app/utils/profiling/hooks/useVirtualizedTree/VirtualizedTree.tsx");






const cancelAnimationTimeout = frame => window.cancelAnimationFrame(frame.id);
/**
 * Recursively calls requestAnimationFrame until a specified delay has been met or exceeded.
 * When the delay time has been reached the function you're timing out will be called.
 * This was copied from react-virtualized, with credits to the original author.
 *
 * Credit: Joe Lambert (https://gist.github.com/joelambert/1002116#file-requesttimeout-js)
 */


const requestAnimationTimeout = (callback, delay) => {
  let start; // wait for end of processing current event handler, because event handler may be long

  Promise.resolve().then(() => {
    start = Date.now();
  });

  const timeout = () => {
    if (start === undefined) {
      frame.id = window.requestAnimationFrame(timeout);
      return;
    }

    if (Date.now() - start >= delay) {
      callback();
    } else {
      frame.id = window.requestAnimationFrame(timeout);
    }
  };

  const frame = {
    id: window.requestAnimationFrame(timeout)
  };
  return frame;
};

function VirtualizedTreeStateReducer(state, action) {
  switch (action.type) {
    case 'set tab index key':
      {
        return { ...state,
          tabIndexKey: action.payload
        };
      }

    case 'set scroll top':
      {
        return { ...state,
          scrollTop: action.payload
        };
      }

    case 'set scroll height':
      {
        return { ...state,
          scrollHeight: action.payload
        };
      }

    default:
      {
        return state;
      }
  }
}

function hideGhostRow(_ref) {
  let {
    ref
  } = _ref;

  if (ref.current) {
    ref.current.style.opacity = '0';
  }
}

function updateGhostRow(_ref2) {
  let {
    ref,
    tabIndexKey,
    rowHeight,
    scrollTop,
    interaction,
    theme
  } = _ref2;

  if (!ref.current) {
    return;
  }

  ref.current.style.left = '0';
  ref.current.style.right = '0';
  ref.current.style.height = `${rowHeight}px`;
  ref.current.style.position = 'absolute';
  ref.current.style.backgroundColor = interaction === 'active' ? theme.blue300 : theme.surface100;
  ref.current.style.pointerEvents = 'none';
  ref.current.style.willChange = 'transform, opacity';
  ref.current.style.transform = `translateY(${rowHeight * tabIndexKey - scrollTop}px)`;
  ref.current.style.opacity = '1';
}

function findOptimisticStartIndex(_ref3) {
  let {
    items,
    overscroll,
    rowHeight,
    scrollTop,
    viewport
  } = _ref3;

  if (!items.length || viewport.top === 0) {
    return 0;
  }

  return Math.max(Math.floor(scrollTop / rowHeight) - overscroll, 0);
}

function findVisibleItems(_ref4) {
  let {
    items,
    overscroll,
    rowHeight,
    scrollHeight,
    scrollTop
  } = _ref4;
  // This is overscroll height for single direction, when computing the total,
  // we need to multiply this by 2 because we overscroll in both directions.
  const OVERSCROLL_HEIGHT = overscroll * rowHeight;
  const visibleItems = []; // Clamp viewport to scrollHeight bounds [0, length * rowHeight] because some browsers may fire
  // scrollTop with negative values when the user scrolls up past the top of the list (overscroll behavior)

  const viewport = {
    top: Math.max(scrollTop - OVERSCROLL_HEIGHT, 0),
    bottom: Math.min(scrollTop + scrollHeight + OVERSCROLL_HEIGHT, items.length * rowHeight)
  }; // Points to the position inside the visible array

  let visibleItemIndex = 0; // Points to the currently iterated item

  let indexPointer = findOptimisticStartIndex({
    items,
    viewport,
    scrollTop,
    rowHeight,
    overscroll
  }); // Max number of visible items in our list

  const MAX_VISIBLE_ITEMS = Math.ceil((scrollHeight + OVERSCROLL_HEIGHT * 2) / rowHeight);
  const ALL_ITEMS = items.length; // While number of visible items is less than max visible items, and we haven't reached the end of the list

  while (visibleItemIndex < MAX_VISIBLE_ITEMS && indexPointer < ALL_ITEMS) {
    const elementTop = indexPointer * rowHeight;
    const elementBottom = elementTop + rowHeight; // An element is inside a viewport if the top of the element is below the top of the viewport
    // and the bottom of the element is above the bottom of the viewport

    if (elementTop >= viewport.top && elementBottom <= viewport.bottom) {
      visibleItems[visibleItemIndex] = {
        key: indexPointer,
        ref: null,
        styles: {
          position: 'absolute',
          top: elementTop
        },
        item: items[indexPointer]
      };
      visibleItemIndex++;
    }

    indexPointer++;
  }

  return visibleItems;
}

const DEFAULT_OVERSCROLL_ITEMS = 5;

function findCarryOverIndex(previousNode, newTree) {
  if (!newTree.flattened.length || !previousNode) {
    return null;
  }

  const newIndex = newTree.flattened.findIndex(n => n.node === previousNode.node);

  if (newIndex === -1) {
    return null;
  }

  return newIndex;
}

function useVirtualizedTree(props) {
  var _props$overscroll, _props$scrollContaine, _props$scrollContaine2, _props$scrollContaine3;

  const theme = (0,_emotion_react__WEBPACK_IMPORTED_MODULE_4__.a)();
  const clickedGhostRowRef = (0,react__WEBPACK_IMPORTED_MODULE_1__.useRef)(null);
  const hoveredGhostRowRef = (0,react__WEBPACK_IMPORTED_MODULE_1__.useRef)(null);
  const previousHoveredRow = (0,react__WEBPACK_IMPORTED_MODULE_1__.useRef)(null);
  const [state, dispatch] = (0,react__WEBPACK_IMPORTED_MODULE_1__.useReducer)(VirtualizedTreeStateReducer, {
    scrollTop: 0,
    roots: props.tree,
    tabIndexKey: null,
    overscroll: (_props$overscroll = props.overscroll) !== null && _props$overscroll !== void 0 ? _props$overscroll : DEFAULT_OVERSCROLL_ITEMS,
    scrollHeight: (_props$scrollContaine = (_props$scrollContaine2 = props.scrollContainer) === null || _props$scrollContaine2 === void 0 ? void 0 : (_props$scrollContaine3 = _props$scrollContaine2.getBoundingClientRect()) === null || _props$scrollContaine3 === void 0 ? void 0 : _props$scrollContaine3.height) !== null && _props$scrollContaine !== void 0 ? _props$scrollContaine : 0
  }); // Keep a ref to latest state to avoid re-rendering

  const latestStateRef = (0,react__WEBPACK_IMPORTED_MODULE_1__.useRef)(state);
  latestStateRef.current = state;
  const [tree, setTree] = (0,react__WEBPACK_IMPORTED_MODULE_1__.useState)(() => {
    const initialTree = _VirtualizedTree__WEBPACK_IMPORTED_MODULE_3__.VirtualizedTree.fromRoots(props.tree, props.skipFunction);

    if (props.sortFunction) {
      initialTree.sort(props.sortFunction);
    }

    return initialTree;
  });
  const cleanupAllHoveredRows = (0,react__WEBPACK_IMPORTED_MODULE_1__.useCallback)(() => {
    previousHoveredRow.current = null;

    for (const row of latestItemsRef.current) {
      if (row.ref && row.ref.dataset.hovered) {
        delete row.ref.dataset.hovered;
      }
    }
  }, []);
  const flattenedHistory = (0,react__WEBPACK_IMPORTED_MODULE_1__.useRef)(tree.flattened);
  const expandedHistory = (0,react__WEBPACK_IMPORTED_MODULE_1__.useRef)(tree.getAllExpandedNodes(new Set()));
  (0,sentry_utils_useEffectAfterFirstRender__WEBPACK_IMPORTED_MODULE_2__.useEffectAfterFirstRender)(() => {
    const newTree = _VirtualizedTree__WEBPACK_IMPORTED_MODULE_3__.VirtualizedTree.fromRoots(props.tree, props.skipFunction, expandedHistory.current);

    if (props.sortFunction) {
      newTree.sort(props.sortFunction);
    }

    const tabIndex = findCarryOverIndex(typeof latestStateRef.current.tabIndexKey === 'number' ? flattenedHistory.current[latestStateRef.current.tabIndexKey] : null, newTree);

    if (tabIndex) {
      updateGhostRow({
        ref: clickedGhostRowRef,
        tabIndexKey: tabIndex,
        rowHeight: props.rowHeight,
        scrollTop: latestStateRef.current.scrollTop,
        interaction: 'active',
        theme
      });
    } else {
      hideGhostRow({
        ref: clickedGhostRowRef
      });
    }

    cleanupAllHoveredRows();
    hideGhostRow({
      ref: hoveredGhostRowRef
    });
    dispatch({
      type: 'set tab index key',
      payload: tabIndex
    });
    setTree(newTree);
    expandedHistory.current = newTree.getAllExpandedNodes(expandedHistory.current);
    flattenedHistory.current = newTree.flattened;
  }, [props.tree, props.skipFunction, props.sortFunction, props.rowHeight, cleanupAllHoveredRows, theme]);
  const items = (0,react__WEBPACK_IMPORTED_MODULE_1__.useMemo)(() => {
    return findVisibleItems({
      items: tree.flattened,
      scrollHeight: state.scrollHeight,
      scrollTop: state.scrollTop,
      overscroll: state.overscroll,
      rowHeight: props.rowHeight
    });
  }, [tree, state.overscroll, state.scrollHeight, state.scrollTop, props.rowHeight]);
  const latestItemsRef = (0,react__WEBPACK_IMPORTED_MODULE_1__.useRef)(items);
  latestItemsRef.current = items; // On scroll, we update scrollTop position.
  // Keep a rafId reference in the unlikely event where component unmounts before raf is executed.

  const scrollEndTimeoutId = (0,react__WEBPACK_IMPORTED_MODULE_1__.useRef)(undefined);
  const previousScrollHeight = (0,react__WEBPACK_IMPORTED_MODULE_1__.useRef)(0);
  (0,react__WEBPACK_IMPORTED_MODULE_1__.useEffect)(() => {
    const scrollContainer = props.scrollContainer;

    if (!scrollContainer) {
      return undefined;
    }

    function handleScroll(evt) {
      const top = Math.max(evt.target.scrollTop, 0);

      if (previousScrollHeight.current === top) {
        return;
      }

      evt.target.firstChild.style.pointerEvents = 'none';

      if (scrollEndTimeoutId.current !== undefined) {
        cancelAnimationTimeout(scrollEndTimeoutId.current);
      }

      scrollEndTimeoutId.current = requestAnimationTimeout(() => {
        evt.target.firstChild.style.pointerEvents = 'auto';
      }, 150);
      dispatch({
        type: 'set scroll top',
        payload: top
      }); // On scroll, we need to update the selected ghost row and clear the hovered ghost row

      if (latestStateRef.current.tabIndexKey !== null) {
        updateGhostRow({
          ref: clickedGhostRowRef,
          tabIndexKey: latestStateRef.current.tabIndexKey,
          scrollTop: Math.max(evt.target.scrollTop, 0),
          interaction: 'active',
          rowHeight: props.rowHeight,
          theme
        });
      }

      cleanupAllHoveredRows();
      hideGhostRow({
        ref: hoveredGhostRowRef
      });
      previousScrollHeight.current = top;
    }

    scrollContainer.addEventListener('scroll', handleScroll, {
      passive: true
    });
    return () => {
      scrollContainer.removeEventListener('scroll', handleScroll);
    };
  }, [props.scrollContainer, props.rowHeight, cleanupAllHoveredRows, theme]);
  (0,react__WEBPACK_IMPORTED_MODULE_1__.useEffect)(() => {
    const scrollContainer = props.scrollContainer;

    if (!scrollContainer) {
      return undefined;
    } // Because nodes dont span the full width, it's possible for users to
    // click or hover on a node at the far right end which is outside of the row width.
    // In that case, we check if the cursor position overlaps with a row and select that row.


    const handleClick = evt => {
      if (evt.target !== scrollContainer) {
        // user clicked on an element inside the container, defer to onClick
        return;
      }

      const rect = evt.target.getBoundingClientRect();
      const index = Math.floor((latestStateRef.current.scrollTop + evt.clientY - rect.top) / props.rowHeight); // If a node exists at the index, select it

      if (tree.flattened[index]) {
        dispatch({
          type: 'set tab index key',
          payload: index
        });
        updateGhostRow({
          ref: clickedGhostRowRef,
          tabIndexKey: index,
          scrollTop: latestStateRef.current.scrollTop,
          rowHeight: props.rowHeight,
          interaction: 'active',
          theme
        });
      }
    }; // Because nodes dont span the full width, it's possible for users to
    // click on a node at the far right end which is outside of the row width.
    // In that case, check if the top position where the user clicked overlaps
    // with a row and select that row.


    const handleMouseMove = evt => {
      if (evt.target !== scrollContainer) {
        // user clicked on an element inside the container, defer to onClick
        return;
      }

      const rect = evt.target.getBoundingClientRect();
      const index = Math.floor((latestStateRef.current.scrollTop + evt.clientY - rect.top) / props.rowHeight);
      cleanupAllHoveredRows();
      const element = latestItemsRef.current.find(item => item.key === index);

      if (element !== null && element !== void 0 && element.ref) {
        element.ref.dataset.hovered = 'true';
      } // If a node exists at the index, select it, else clear whatever is selected


      if (tree.flattened[index] && index !== latestStateRef.current.tabIndexKey) {
        updateGhostRow({
          ref: hoveredGhostRowRef,
          tabIndexKey: index,
          scrollTop: latestStateRef.current.scrollTop,
          rowHeight: props.rowHeight,
          interaction: 'hover',
          theme
        });
      } else {
        hideGhostRow({
          ref: hoveredGhostRowRef
        });
      }
    };

    scrollContainer.addEventListener('click', handleClick);
    scrollContainer.addEventListener('mousemove', handleMouseMove);
    return () => {
      scrollContainer.removeEventListener('click', handleClick);
      scrollContainer.removeEventListener('mousemove', handleMouseMove);
    };
  }, [props.rowHeight, props.scrollContainer, tree.flattened, cleanupAllHoveredRows, theme]); // When mouseleave is triggered on the contianer,
  // we need to hide the ghost row to avoid an orphaned row

  (0,react__WEBPACK_IMPORTED_MODULE_1__.useEffect)(() => {
    const container = props.scrollContainer;

    if (!container) {
      return undefined;
    }

    function onMouseLeave() {
      cleanupAllHoveredRows();
      hideGhostRow({
        ref: hoveredGhostRowRef
      });
    }

    container.addEventListener('mouseleave', onMouseLeave, {
      passive: true
    });
    return () => {
      container.removeEventListener('mouseleave', onMouseLeave);
    };
  }, [cleanupAllHoveredRows, props.scrollContainer]); // When a node is expanded, the underlying tree is recomputed (the flattened tree is updated)
  // We copy the properties of the old tree by creating a new instance of VirtualizedTree
  // and passing in the roots and its flattened representation so that no extra work is done.

  const handleExpandTreeNode = (0,react__WEBPACK_IMPORTED_MODULE_1__.useCallback)((node, opts) => {
    var _tree$flattened$lates;

    // When we expand nodes, tree.expand will mutate the underlying tree which then
    // gets copied to the new tree instance. To get the right index, we need to read
    // it before any mutations are made
    const previousNode = latestStateRef.current.tabIndexKey ? (_tree$flattened$lates = tree.flattened[latestStateRef.current.tabIndexKey]) !== null && _tree$flattened$lates !== void 0 ? _tree$flattened$lates : null : null;
    tree.expandNode(node, !node.expanded, opts);
    const newTree = new _VirtualizedTree__WEBPACK_IMPORTED_MODULE_3__.VirtualizedTree(tree.roots, tree.flattened);
    expandedHistory.current = newTree.getAllExpandedNodes(new Set()); // Hide or update the ghost if necessary

    const tabIndex = findCarryOverIndex(previousNode, newTree);

    if (tabIndex === null) {
      hideGhostRow({
        ref: clickedGhostRowRef
      });
    } else {
      updateGhostRow({
        ref: clickedGhostRowRef,
        tabIndexKey: tabIndex,
        scrollTop: Math.max(latestStateRef.current.scrollTop, 0),
        interaction: 'active',
        rowHeight: props.rowHeight,
        theme
      });
    }

    dispatch({
      type: 'set tab index key',
      payload: tabIndex
    });
    setTree(newTree);
  }, [tree, props.rowHeight, theme]); // When a tree is sorted, we sort all of the nodes in the tree and not just the visible ones
  // We could probably optimize this to lazily sort as we scroll, but since we want the least amount
  // of work during scrolling, we just sort the entire tree every time.

  const handleSortingChange = (0,react__WEBPACK_IMPORTED_MODULE_1__.useCallback)(sortFn => {
    var _tree$flattened$lates2;

    // When we sort nodes, tree.sort will mutate the underlying tree which then
    // gets copied to the new tree instance. To get the right index, we need to read
    // it before any mutations are made
    const previousNode = latestStateRef.current.tabIndexKey ? (_tree$flattened$lates2 = tree.flattened[latestStateRef.current.tabIndexKey]) !== null && _tree$flattened$lates2 !== void 0 ? _tree$flattened$lates2 : null : null;
    tree.sort(sortFn);
    const newTree = new _VirtualizedTree__WEBPACK_IMPORTED_MODULE_3__.VirtualizedTree(tree.roots, tree.flattened); // Hide or update the ghost if necessary

    const tabIndex = findCarryOverIndex(previousNode, newTree);

    if (tabIndex === null) {
      hideGhostRow({
        ref: clickedGhostRowRef
      });
    } else {
      updateGhostRow({
        ref: clickedGhostRowRef,
        tabIndexKey: tabIndex,
        scrollTop: Math.max(latestStateRef.current.scrollTop, 0),
        interaction: 'active',
        rowHeight: props.rowHeight,
        theme
      });
    }

    dispatch({
      type: 'set tab index key',
      payload: tabIndex
    });
    setTree(newTree);
  }, [tree, props.rowHeight, theme]); // When a row is clicked, we update the selected node

  const handleRowClick = (0,react__WEBPACK_IMPORTED_MODULE_1__.useCallback)(tabIndexKey => {
    return _evt => {
      dispatch({
        type: 'set tab index key',
        payload: tabIndexKey
      });
      updateGhostRow({
        ref: clickedGhostRowRef,
        tabIndexKey,
        scrollTop: state.scrollTop,
        rowHeight: props.rowHeight,
        interaction: 'active',
        theme
      });
    };
  }, [state.scrollTop, props.rowHeight, theme]); // Keyboard navigation for row

  const handleRowKeyDown = (0,react__WEBPACK_IMPORTED_MODULE_1__.useCallback)(event => {
    if (latestStateRef.current.tabIndexKey === null) {
      return;
    } // Cant move anywhere if there are no nodes


    if (!tree.flattened.length) {
      return;
    }

    if (event.key === 'Enter') {
      handleExpandTreeNode(tree.flattened[latestStateRef.current.tabIndexKey], {
        expandChildren: true
      });
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();

      if (event.metaKey || event.ctrlKey) {
        const index = tree.flattened.length - 1;
        props.scrollContainer.scrollTo({
          // We need to offset for the scrollMargin
          top: index * props.rowHeight + props.rowHeight
        });
        dispatch({
          type: 'set tab index key',
          payload: index
        });
        updateGhostRow({
          ref: clickedGhostRowRef,
          tabIndexKey: index,
          scrollTop: latestStateRef.current.scrollTop,
          rowHeight: props.rowHeight,
          interaction: 'active',
          theme
        });
        return;
      } // This is fine because we are only searching visible items
      // and not the entire tree of nodes


      const indexInVisibleItems = items.findIndex(i => i.key === latestStateRef.current.tabIndexKey);

      if (indexInVisibleItems !== -1) {
        var _items$nextIndex$ref, _items$nextIndex$ref2;

        const nextIndex = indexInVisibleItems + 1; // Bounds check if we are at end of list

        if (nextIndex > tree.flattened.length - 1) {
          return;
        }

        dispatch({
          type: 'set tab index key',
          payload: items[nextIndex].key
        });
        updateGhostRow({
          ref: clickedGhostRowRef,
          tabIndexKey: items[nextIndex].key,
          scrollTop: latestStateRef.current.scrollTop,
          rowHeight: props.rowHeight,
          interaction: 'active',
          theme
        });
        (_items$nextIndex$ref = items[nextIndex].ref) === null || _items$nextIndex$ref === void 0 ? void 0 : _items$nextIndex$ref.focus({
          preventScroll: true
        });
        (_items$nextIndex$ref2 = items[nextIndex].ref) === null || _items$nextIndex$ref2 === void 0 ? void 0 : _items$nextIndex$ref2.scrollIntoView({
          block: 'nearest'
        });
      }
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();

      if (event.metaKey || event.ctrlKey) {
        props.scrollContainer.scrollTo({
          top: 0
        });
        dispatch({
          type: 'set tab index key',
          payload: 0
        });
        updateGhostRow({
          ref: clickedGhostRowRef,
          tabIndexKey: 0,
          scrollTop: latestStateRef.current.scrollTop,
          rowHeight: props.rowHeight,
          interaction: 'active',
          theme
        });
        return;
      } // This is fine because we are only searching visible items
      // and not the entire tree of nodes


      const indexInVisibleItems = items.findIndex(i => i.key === latestStateRef.current.tabIndexKey);

      if (indexInVisibleItems !== -1) {
        var _items$nextIndex$ref3, _items$nextIndex$ref4;

        const nextIndex = indexInVisibleItems - 1; // Bound check if we are at start of list

        if (nextIndex < 0) {
          return;
        }

        dispatch({
          type: 'set tab index key',
          payload: items[nextIndex].key
        });
        updateGhostRow({
          ref: clickedGhostRowRef,
          tabIndexKey: items[nextIndex].key,
          scrollTop: latestStateRef.current.scrollTop,
          rowHeight: props.rowHeight,
          interaction: 'active',
          theme
        });
        (_items$nextIndex$ref3 = items[nextIndex].ref) === null || _items$nextIndex$ref3 === void 0 ? void 0 : _items$nextIndex$ref3.focus({
          preventScroll: true
        });
        (_items$nextIndex$ref4 = items[nextIndex].ref) === null || _items$nextIndex$ref4 === void 0 ? void 0 : _items$nextIndex$ref4.scrollIntoView({
          block: 'nearest'
        });
      }
    }
  }, [handleExpandTreeNode, items, tree.flattened, props.rowHeight, props.scrollContainer, theme]); // When a row is hovered, we update the ghost row

  const handleRowMouseEnter = (0,react__WEBPACK_IMPORTED_MODULE_1__.useCallback)(key => {
    return _evt => {
      if (previousHoveredRow.current !== key) {
        cleanupAllHoveredRows();
        _evt.currentTarget.dataset.hovered = 'true';
        previousHoveredRow.current = key;
      }

      updateGhostRow({
        ref: hoveredGhostRowRef,
        tabIndexKey: key,
        scrollTop: state.scrollTop,
        rowHeight: props.rowHeight,
        interaction: 'hover',
        theme
      });
    };
  }, [state.scrollTop, props.rowHeight, cleanupAllHoveredRows, theme]); // Register a resize observer for when the scroll container is resized.
  // When the container is resized, update the scroll height in our state.
  // Similarly to handleScroll, we use requestAnimationFrame to avoid overupdating the UI

  (0,react__WEBPACK_IMPORTED_MODULE_1__.useEffect)(() => {
    if (!props.scrollContainer) {
      return undefined;
    }

    let rafId;
    const resizeObserver = new window.ResizeObserver(elements => {
      rafId = window.requestAnimationFrame(() => {
        var _elements$0$contentRe, _elements$, _elements$$contentRec;

        dispatch({
          type: 'set scroll height',
          payload: (_elements$0$contentRe = (_elements$ = elements[0]) === null || _elements$ === void 0 ? void 0 : (_elements$$contentRec = _elements$.contentRect) === null || _elements$$contentRec === void 0 ? void 0 : _elements$$contentRec.height) !== null && _elements$0$contentRe !== void 0 ? _elements$0$contentRe : 0
        });
        cleanupAllHoveredRows();
        hideGhostRow({
          ref: hoveredGhostRowRef
        });
      });
    });
    resizeObserver.observe(props.scrollContainer);
    return () => {
      if (typeof rafId === 'number') {
        window.cancelAnimationFrame(rafId);
      }

      resizeObserver.disconnect();
    };
  }, [props.scrollContainer, cleanupAllHoveredRows]); // Basic required styles for the scroll container

  const scrollContainerStyles = (0,react__WEBPACK_IMPORTED_MODULE_1__.useMemo)(() => {
    return {
      height: '100%',
      overflow: 'auto',
      position: 'relative',
      willChange: 'transform'
    };
  }, []); // Basic styles for the element container. We fake the height so that the
  // scrollbar is sized according to the number of items in the list.

  const containerStyles = (0,react__WEBPACK_IMPORTED_MODULE_1__.useMemo)(() => {
    const height = tree.flattened.length * props.rowHeight;
    return {
      height,
      maxHeight: height
    };
  }, [tree.flattened.length, props.rowHeight]);
  const renderRow = props.renderRow;
  const renderedItems = (0,react__WEBPACK_IMPORTED_MODULE_1__.useMemo)(() => {
    const renderered = []; // It is important that we do not create a copy of item
    // because refs will assign the dom node to the item.
    // If we map, we get a new object that our internals will not be able to access.

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      renderered.push(renderRow(item, {
        handleRowClick: handleRowClick(item.key),
        handleExpandTreeNode,
        handleRowKeyDown,
        handleRowMouseEnter: handleRowMouseEnter(item.key),
        tabIndexKey: state.tabIndexKey
      }));
    }

    return renderered;
  }, [items, handleRowClick, handleRowKeyDown, state.tabIndexKey, handleRowMouseEnter, handleExpandTreeNode, renderRow]); // Register a resize observer for when the scroll container is resized.
  // When the container is resized, update the scroll height in our state.
  // Similarly to handleScroll, we use requestAnimationFrame to avoid overupdating the UI

  (0,react__WEBPACK_IMPORTED_MODULE_1__.useEffect)(() => {
    if (!props.scrollContainer) {
      return undefined;
    }

    let rafId;
    const resizeObserver = new window.ResizeObserver(elements => {
      rafId = window.requestAnimationFrame(() => {
        var _elements$0$contentRe2, _elements$2, _elements$2$contentRe;

        dispatch({
          type: 'set scroll height',
          payload: (_elements$0$contentRe2 = (_elements$2 = elements[0]) === null || _elements$2 === void 0 ? void 0 : (_elements$2$contentRe = _elements$2.contentRect) === null || _elements$2$contentRe === void 0 ? void 0 : _elements$2$contentRe.height) !== null && _elements$0$contentRe2 !== void 0 ? _elements$0$contentRe2 : 0
        });
      });
    });
    resizeObserver.observe(props.scrollContainer);
    return () => {
      if (typeof rafId === 'number') {
        window.cancelAnimationFrame(rafId);
      }

      resizeObserver.disconnect();
    };
  }, [props.scrollContainer]);
  return {
    tree,
    items,
    renderedItems,
    tabIndexKey: state.tabIndexKey,
    dispatch,
    handleRowClick,
    handleRowKeyDown,
    handleRowMouseEnter,
    handleExpandTreeNode,
    handleSortingChange,
    scrollContainerStyles,
    containerStyles,
    clickedGhostRowRef,
    hoveredGhostRowRef
  };
}

/***/ }),

/***/ "./app/utils/profiling/renderers/flamegraphRenderer.tsx":
/*!**************************************************************!*\
  !*** ./app/utils/profiling/renderers/flamegraphRenderer.tsx ***!
  \**************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "FlamegraphRenderer": () => (/* binding */ FlamegraphRenderer)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/es.error.cause.js */ "../node_modules/core-js/modules/es.error.cause.js");
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var core_js_modules_es_typed_array_float32_array_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! core-js/modules/es.typed-array.float32-array.js */ "../node_modules/core-js/modules/es.typed-array.float32-array.js");
/* harmony import */ var core_js_modules_es_typed_array_float32_array_js__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_typed_array_float32_array_js__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var core_js_modules_es_typed_array_at_js__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! core-js/modules/es.typed-array.at.js */ "../node_modules/core-js/modules/es.typed-array.at.js");
/* harmony import */ var core_js_modules_es_typed_array_at_js__WEBPACK_IMPORTED_MODULE_4___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_typed_array_at_js__WEBPACK_IMPORTED_MODULE_4__);
/* harmony import */ var core_js_modules_es_typed_array_fill_js__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! core-js/modules/es.typed-array.fill.js */ "../node_modules/core-js/modules/es.typed-array.fill.js");
/* harmony import */ var core_js_modules_es_typed_array_fill_js__WEBPACK_IMPORTED_MODULE_5___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_typed_array_fill_js__WEBPACK_IMPORTED_MODULE_5__);
/* harmony import */ var core_js_modules_es_typed_array_set_js__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! core-js/modules/es.typed-array.set.js */ "../node_modules/core-js/modules/es.typed-array.set.js");
/* harmony import */ var core_js_modules_es_typed_array_set_js__WEBPACK_IMPORTED_MODULE_6___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_typed_array_set_js__WEBPACK_IMPORTED_MODULE_6__);
/* harmony import */ var core_js_modules_es_typed_array_sort_js__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! core-js/modules/es.typed-array.sort.js */ "../node_modules/core-js/modules/es.typed-array.sort.js");
/* harmony import */ var core_js_modules_es_typed_array_sort_js__WEBPACK_IMPORTED_MODULE_7___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_typed_array_sort_js__WEBPACK_IMPORTED_MODULE_7__);
/* harmony import */ var gl_matrix__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! gl-matrix */ "../node_modules/gl-matrix/esm/mat3.js");
/* harmony import */ var _flamegraphFrame__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! ../flamegraphFrame */ "./app/utils/profiling/flamegraphFrame.tsx");
/* harmony import */ var _gl_utils__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! ../gl/utils */ "./app/utils/profiling/gl/utils.ts");
/* harmony import */ var _shaders__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! ./shaders */ "./app/utils/profiling/renderers/shaders.tsx");













class FlamegraphRenderer {
  // Vertex and color buffer
  constructor(canvas, flamegraph, theme) {
    let options = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : {
      draw_border: false
    };

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "canvas", void 0);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "flamegraph", void 0);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "gl", null);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "program", null);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "theme", void 0);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "frames", []);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "roots", []);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "positions", []);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "bounds", []);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "colors", []);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "colorMap", new Map());

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "lastDragPosition", null);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "attributes", {
      a_position: null,
      a_color: null,
      a_bounds: null
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "uniforms", {
      u_border_width: null,
      u_draw_border: null,
      u_is_search_result: null,
      u_model: null,
      u_projection: null
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "options", void 0);

    this.flamegraph = flamegraph;
    this.canvas = canvas;
    this.theme = theme;
    this.options = options;
    this.init();
  }

  init() {
    const VERTICES = 6;
    const COLOR_COMPONENTS = 4;
    this.colors = new Array(VERTICES * COLOR_COMPONENTS);
    this.frames = [...this.flamegraph.frames];
    this.roots = [...this.flamegraph.root.children]; // Generate colors for the flamegraph

    const {
      colorBuffer,
      colorMap
    } = this.theme.COLORS.STACK_TO_COLOR(this.frames, this.theme.COLORS.COLOR_MAP, this.theme.COLORS.COLOR_BUCKET);
    this.colorMap = colorMap;
    this.colors = colorBuffer;
    this.initCanvasContext();
    this.initVertices();
    this.initShaders();
  }

  initVertices() {
    const POSITIONS_PER_PASS = 2;
    const BOUNDS_PER_PASS = 4;
    const VERTICES = 6;
    this.bounds = new Array(VERTICES * BOUNDS_PER_PASS * this.frames.length);
    this.positions = new Array(VERTICES * POSITIONS_PER_PASS * this.frames.length);
    const length = this.frames.length;

    for (let index = 0; index < length; index++) {
      const frame = this.frames[index];
      const x1 = frame.start;
      const x2 = frame.end;
      const y1 = frame.depth;
      const y2 = frame.depth + 1; // top left -> top right -> bottom left ->
      // bottom left -> top right -> bottom right

      const positionOffset = index * 12;
      this.positions[positionOffset] = x1;
      this.positions[positionOffset + 1] = y1;
      this.positions[positionOffset + 2] = x2;
      this.positions[positionOffset + 3] = y1;
      this.positions[positionOffset + 4] = x1;
      this.positions[positionOffset + 5] = y2;
      this.positions[positionOffset + 6] = x1;
      this.positions[positionOffset + 7] = y2;
      this.positions[positionOffset + 8] = x2;
      this.positions[positionOffset + 9] = y1;
      this.positions[positionOffset + 10] = x2;
      this.positions[positionOffset + 11] = y2; // @TODO check if we can pack bounds across vertex calls,
      // we are allocating 6x the amount of memory here

      const boundsOffset = index * VERTICES * BOUNDS_PER_PASS;

      for (let i = 0; i < VERTICES; i++) {
        const offset = boundsOffset + i * BOUNDS_PER_PASS;
        this.bounds[offset] = x1;
        this.bounds[offset + 1] = y1;
        this.bounds[offset + 2] = x2;
        this.bounds[offset + 3] = y2;
      }
    }
  }

  initCanvasContext() {
    if (!this.canvas) {
      throw new Error('Cannot initialize context from null canvas');
    } // Setup webgl canvas context


    this.gl = (0,_gl_utils__WEBPACK_IMPORTED_MODULE_9__.getContext)(this.canvas, 'webgl');

    if (!this.gl) {
      throw new Error('Uninitialized WebGL context');
    }

    this.gl.enable(this.gl.BLEND);
    this.gl.blendFuncSeparate(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA, this.gl.ONE, this.gl.ONE_MINUS_SRC_ALPHA);
    (0,_gl_utils__WEBPACK_IMPORTED_MODULE_9__.resizeCanvasToDisplaySize)(this.canvas);
  }

  initShaders() {
    if (!this.gl) {
      throw new Error('Uninitialized WebGL context');
    } // @ts-ignore


    this.uniforms = {}; // @ts-ignore

    this.attributes = {};
    const vertexShader = (0,_gl_utils__WEBPACK_IMPORTED_MODULE_9__.createShader)(this.gl, this.gl.VERTEX_SHADER, (0,_shaders__WEBPACK_IMPORTED_MODULE_10__.vertex)());
    const fragmentShader = (0,_gl_utils__WEBPACK_IMPORTED_MODULE_9__.createShader)(this.gl, this.gl.FRAGMENT_SHADER, (0,_shaders__WEBPACK_IMPORTED_MODULE_10__.fragment)(this.theme)); // create program

    this.program = (0,_gl_utils__WEBPACK_IMPORTED_MODULE_9__.createProgram)(this.gl, vertexShader, fragmentShader);
    const uProjectionMatrix = this.gl.getUniformLocation(this.program, 'u_projection');
    const uModelMatrix = this.gl.getUniformLocation(this.program, 'u_model');
    const uIsSearchResult = this.gl.getUniformLocation(this.program, 'u_is_search_result');
    const uBorderWidth = this.gl.getUniformLocation(this.program, 'u_border_width');
    const uDrawBorder = this.gl.getUniformLocation(this.program, 'u_draw_border');

    if (!uProjectionMatrix) {
      throw new Error('Could not locate u_projection in shader');
    }

    if (!uModelMatrix) {
      throw new Error('Could not locate u_model in shader');
    }

    if (!uIsSearchResult) {
      throw new Error('Could not locate u_is_search_result in shader');
    }

    if (!uBorderWidth) {
      throw new Error('Could not locate u_border_width in shader');
    }

    if (!uDrawBorder) {
      throw new Error('Could not locate u_draw_border in shader');
    }

    this.uniforms.u_projection = uProjectionMatrix;
    this.uniforms.u_model = uModelMatrix;
    this.uniforms.u_is_search_result = uIsSearchResult;
    this.uniforms.u_border_width = uBorderWidth;
    this.uniforms.u_draw_border = uDrawBorder;
    {
      const aColorAttributeLocation = this.gl.getAttribLocation(this.program, 'a_color');

      if (aColorAttributeLocation === -1) {
        throw new Error('Could not locate a_color in shader');
      } // attributes get data from buffers


      this.attributes.a_color = aColorAttributeLocation; // Init color buffer

      const colorBuffer = this.gl.createBuffer(); // Bind it to ARRAY_BUFFER (think of it as ARRAY_BUFFER = colorBuffer)

      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, colorBuffer);
      this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(this.colors), this.gl.STATIC_DRAW);
      const size = 4;
      const type = this.gl.FLOAT;
      const normalize = false;
      const stride = 0;
      const offset = 0;
      this.gl.vertexAttribPointer(aColorAttributeLocation, size, type, normalize, stride, offset); // Point to attribute location

      this.gl.enableVertexAttribArray(aColorAttributeLocation);
    }
    {
      // look up where the vertex data needs to go.
      const aPositionAttributeLocation = this.gl.getAttribLocation(this.program, 'a_position');

      if (aPositionAttributeLocation === -1) {
        throw new Error('Could not locate a_color in shader');
      } // attributes get data from buffers


      this.attributes.a_position = aPositionAttributeLocation; // Init position buffer

      const positionBuffer = this.gl.createBuffer(); // Bind it to ARRAY_BUFFER (think of it as ARRAY_BUFFER = positionBuffer)

      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, positionBuffer);
      this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(this.positions), this.gl.STATIC_DRAW);
      const size = 2;
      const type = this.gl.FLOAT;
      const normalize = false;
      const stride = 0;
      const offset = 0;
      this.gl.vertexAttribPointer(aPositionAttributeLocation, size, type, normalize, stride, offset); // Point to attribute location

      this.gl.enableVertexAttribArray(aPositionAttributeLocation);
    }
    {
      // look up where the bounds vertices needs to go.
      const aBoundsAttributeLocation = this.gl.getAttribLocation(this.program, 'a_bounds');

      if (aBoundsAttributeLocation === -1) {
        throw new Error('Could not locate a_color in shader');
      } // attributes get data from buffers


      this.attributes.a_bounds = aBoundsAttributeLocation; // Init bounds buffer

      const boundsBuffer = this.gl.createBuffer(); // Bind it to ARRAY_BUFFER (think of it as ARRAY_BUFFER = boundsBuffer)

      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, boundsBuffer);
      this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(this.bounds), this.gl.STATIC_DRAW);
      const size = 4;
      const type = this.gl.FLOAT;
      const normalize = false;
      const stride = 0;
      const offset = 0;
      this.gl.vertexAttribPointer(aBoundsAttributeLocation, size, type, normalize, stride, offset); // Point to attribute location

      this.gl.enableVertexAttribArray(aBoundsAttributeLocation);
    } // Use shader program

    this.gl.useProgram(this.program);
  }

  getColorForFrame(frame) {
    var _this$colorMap$get;

    return (_this$colorMap$get = this.colorMap.get(frame.key)) !== null && _this$colorMap$get !== void 0 ? _this$colorMap$get : this.theme.COLORS.FRAME_FALLBACK_COLOR;
  }

  getHoveredNode(configSpaceCursor) {
    let hoveredNode = null;

    const findHoveredNode = (frame, depth) => {
      // This is outside
      if (hoveredNode) {
        return;
      }

      const frameRect = new _gl_utils__WEBPACK_IMPORTED_MODULE_9__.Rect(frame.start, frame.depth, frame.end - frame.start, 1); // We treat entire flamegraph as a segment tree, this allows us to query in O(log n) time by
      // only looking at the nodes that are relevant to the current cursor position. We discard any values
      // on x axis that do not overlap the cursor, and descend until we find a node that overlaps at cursor y position

      if (!frameRect.containsX(configSpaceCursor)) {
        return;
      } // If our frame depth overlaps cursor y position, we have found our node


      if (frameRect.containsY(configSpaceCursor)) {
        hoveredNode = frame;
        return;
      } // Descend into the rest of the children


      for (let i = 0; i < frame.children.length; i++) {
        findHoveredNode(frame.children[i], depth + 1);
      }
    };

    for (let i = 0; i < this.roots.length; i++) {
      findHoveredNode(this.roots[i], 0);
    }

    return hoveredNode;
  }

  draw(configViewToPhysicalSpace, searchResults) {
    if (!this.gl) {
      throw new Error('Uninitialized WebGL context');
    }

    this.gl.clearColor(0, 0, 0, 0);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT); // We have no frames to draw

    if (!this.positions.length) {
      return;
    }

    this.gl.useProgram(this.program);
    const projectionMatrix = (0,_gl_utils__WEBPACK_IMPORTED_MODULE_9__.makeProjectionMatrix)(this.gl.canvas.width, this.gl.canvas.height); // Projection matrix

    this.gl.uniformMatrix3fv(this.uniforms.u_projection, false, projectionMatrix); // Model to projection

    this.gl.uniformMatrix3fv(this.uniforms.u_model, false, configViewToPhysicalSpace); // Check if we should draw border

    this.gl.uniform1i(this.uniforms.u_draw_border, this.options.draw_border ? 1 : 0); // Tell webgl to convert clip space to px

    this.gl.viewport(0, 0, this.gl.canvas.width, this.gl.canvas.height);
    const physicalSpacePixel = new _gl_utils__WEBPACK_IMPORTED_MODULE_9__.Rect(0, 0, 1, 1);
    const physicalToConfig = gl_matrix__WEBPACK_IMPORTED_MODULE_11__.invert(gl_matrix__WEBPACK_IMPORTED_MODULE_11__.create(), configViewToPhysicalSpace);
    const configSpacePixel = physicalSpacePixel.transformRect(physicalToConfig);
    this.gl.uniform2f(this.uniforms.u_border_width, configSpacePixel.width, configSpacePixel.height);
    const VERTICES = 6;
    const length = this.frames.length;
    let frame; // This is an optimization to avoid setting uniform1i for each draw call when user is not searching

    if (searchResults.size > 0) {
      for (let i = 0; i < length; i++) {
        frame = this.frames[i];
        const vertexOffset = i * VERTICES;
        this.gl.uniform1i(this.uniforms.u_is_search_result, searchResults.has((0,_flamegraphFrame__WEBPACK_IMPORTED_MODULE_8__.getFlamegraphFrameSearchId)(frame)) ? 1 : 0);
        this.gl.drawArrays(this.gl.TRIANGLES, vertexOffset, VERTICES);
      }
    } else {
      this.gl.uniform1i(this.uniforms.u_is_search_result, 0);

      for (let i = 0; i < length; i++) {
        const vertexOffset = i * VERTICES;
        this.gl.drawArrays(this.gl.TRIANGLES, vertexOffset, VERTICES);
      }
    }
  }

}



/***/ }),

/***/ "./app/utils/profiling/renderers/gridRenderer.tsx":
/*!********************************************************!*\
  !*** ./app/utils/profiling/renderers/gridRenderer.tsx ***!
  \********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "GridRenderer": () => (/* binding */ GridRenderer),
/* harmony export */   "computeInterval": () => (/* binding */ computeInterval),
/* harmony export */   "getIntervalTimeAtX": () => (/* binding */ getIntervalTimeAtX)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var _gl_utils__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../gl/utils */ "./app/utils/profiling/gl/utils.ts");


function getIntervalTimeAtX(logicalSpaceToConfigView, x) {
  const vector = logicalSpaceToConfigView[0] * x + logicalSpaceToConfigView[6];

  if (vector > 1) {
    return Math.round(vector);
  }

  return Math.round(vector * 10) / 10;
}
function computeInterval(configView, logicalSpaceToConfigView) {
  // We want to draw an interval every 200px, this is similar to how speedscope draws it and it works well
  // (both visually pleasing and precise enough). It is pretty much identical to what speedscope does with
  // the safeguards for the intervals being too small.
  const target = 200; // Compute x at 200 and subtract left, so we have the interval

  const targetInterval = getIntervalTimeAtX(logicalSpaceToConfigView, target) - configView.left;
  const minInterval = Math.pow(10, Math.floor(Math.log10(targetInterval)));
  let interval = minInterval;

  if (targetInterval / interval > 5) {
    interval *= 5;
  } else if (targetInterval / interval > 2) {
    interval *= 2;
  }

  let x = Math.ceil(configView.left / interval) * interval;
  const intervals = [];

  while (x <= configView.right) {
    intervals.push(x);
    x += interval;
  }

  return intervals;
}

class GridRenderer {
  constructor(canvas, theme, formatter) {
    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "canvas", void 0);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "context", void 0);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "theme", void 0);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "formatter", void 0);

    this.canvas = canvas;
    this.theme = theme;
    this.formatter = formatter;
    this.context = (0,_gl_utils__WEBPACK_IMPORTED_MODULE_1__.getContext)(canvas, '2d');
  }

  draw(configViewSpace, physicalViewRect, configViewToPhysicalSpace, logicalSpaceToConfigView) {
    let context = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : this.context;
    context.font = `${this.theme.SIZES.LABEL_FONT_SIZE * window.devicePixelRatio}px ${this.theme.FONTS.FONT}`;
    context.textBaseline = 'top';
    context.lineWidth = this.theme.SIZES.GRID_LINE_WIDTH / 2; // Draw the background of the top timeline

    context.fillStyle = this.theme.COLORS.GRID_FRAME_BACKGROUND_COLOR;
    context.fillRect(0, this.theme.SIZES.GRID_LINE_WIDTH, physicalViewRect.width, this.theme.SIZES.LABEL_FONT_SIZE * window.devicePixelRatio + this.theme.SIZES.LABEL_FONT_PADDING * window.devicePixelRatio * 2 - this.theme.SIZES.LABEL_FONT_PADDING); // Draw top timeline lines

    context.fillStyle = this.theme.COLORS.GRID_LINE_COLOR;
    context.fillRect(0, 0, physicalViewRect.width, this.theme.SIZES.GRID_LINE_WIDTH / 2);
    context.fillRect(0, this.theme.SIZES.TIMELINE_HEIGHT * window.devicePixelRatio, physicalViewRect.width, this.theme.SIZES.GRID_LINE_WIDTH / 2);
    const intervals = computeInterval(configViewSpace, logicalSpaceToConfigView);

    for (let i = 0; i < intervals.length; i++) {
      // Compute the x position of our interval from config space to physical
      const physicalIntervalPosition = Math.round(intervals[i] * configViewToPhysicalSpace[0] + configViewToPhysicalSpace[6]); // Format the label text

      const labelText = this.formatter(intervals[i]);
      context.fillStyle = this.theme.COLORS.LABEL_FONT_COLOR; // Subtract width of the text and padding so that the text is align to the left of our interval

      context.fillText(labelText, physicalIntervalPosition - (0,_gl_utils__WEBPACK_IMPORTED_MODULE_1__.measureText)(labelText, context).width - this.theme.SIZES.LABEL_FONT_PADDING * window.devicePixelRatio, this.theme.SIZES.LABEL_FONT_PADDING * window.devicePixelRatio); // Draw the vertical grid line

      context.strokeStyle = this.theme.COLORS.GRID_LINE_COLOR;
      context.strokeRect(physicalIntervalPosition - this.theme.SIZES.GRID_LINE_WIDTH / 2, physicalViewRect.y, this.theme.SIZES.GRID_LINE_WIDTH / 2, physicalViewRect.height);
    }
  }

}



/***/ }),

/***/ "./app/utils/profiling/renderers/positionIndicatorRenderer.tsx":
/*!*********************************************************************!*\
  !*** ./app/utils/profiling/renderers/positionIndicatorRenderer.tsx ***!
  \*********************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "PositionIndicatorRenderer": () => (/* binding */ PositionIndicatorRenderer)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var _gl_utils__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../gl/utils */ "./app/utils/profiling/gl/utils.ts");




class PositionIndicatorRenderer {
  constructor(canvas, theme) {
    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "canvas", void 0);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "context", void 0);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "theme", void 0);

    this.canvas = canvas;
    this.theme = theme;
    this.context = (0,_gl_utils__WEBPACK_IMPORTED_MODULE_2__.getContext)(this.canvas, '2d');
  }

  draw(configView, configSpace, configSpaceToPhysicalSpace) {
    if (configView.equals(configSpace)) {
      // User is not zoomed in or entire chart fits in view,
      // then we dont need to draw anything.
      return;
    } // Transform both views to their respective physical spaces


    const physicalConfigViewRect = _gl_utils__WEBPACK_IMPORTED_MODULE_2__.Rect.From(configView).transformRect(configSpaceToPhysicalSpace);
    const physicalConfigRect = _gl_utils__WEBPACK_IMPORTED_MODULE_2__.Rect.From(configSpace).transformRect(configSpaceToPhysicalSpace);
    const offsetRectForBorderWidth = [physicalConfigViewRect.x - this.theme.SIZES.MINIMAP_POSITION_OVERLAY_BORDER_WIDTH, physicalConfigViewRect.y, physicalConfigViewRect.width + this.theme.SIZES.MINIMAP_POSITION_OVERLAY_BORDER_WIDTH, physicalConfigViewRect.height]; // What we do to draw the "window" that the user is currently watching is we draw two rectangles, the
    // zoomed in view and the zoomed out view. The zoomed out view is the full view of the flamegraph, and the zoom
    // in view is whatever the user is currently looking at. Because the zoomed in view is a subset of the zoomed,
    // we just need to use the evenodd fill rule to paint inbetween the two rectangles.

    this.context.fillStyle = this.theme.COLORS.MINIMAP_POSITION_OVERLAY_COLOR;
    this.context.strokeStyle = this.theme.COLORS.MINIMAP_POSITION_OVERLAY_BORDER_COLOR;
    this.context.lineWidth = this.theme.SIZES.MINIMAP_POSITION_OVERLAY_BORDER_WIDTH;
    this.context.beginPath();
    this.context.rect(0, 0, physicalConfigRect.width, physicalConfigRect.height);
    this.context.rect(...offsetRectForBorderWidth);
    this.context.fill('evenodd');
    this.context.strokeRect(...offsetRectForBorderWidth);
  }

}



/***/ }),

/***/ "./app/utils/profiling/renderers/sampleTickRenderer.tsx":
/*!**************************************************************!*\
  !*** ./app/utils/profiling/renderers/sampleTickRenderer.tsx ***!
  \**************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "SampleTickRenderer": () => (/* binding */ SampleTickRenderer)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var _gl_utils__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../gl/utils */ "./app/utils/profiling/gl/utils.ts");



function computeAbsoluteSampleTimestamps(startedAt, weights) {
  const timeline = [startedAt + weights[0]];

  for (let i = 1; i < weights.length; i++) {
    timeline.push(timeline[i - 1] + weights[i]);
  }

  return timeline;
}

class SampleTickRenderer {
  constructor(canvas, flamegraph, configSpace, theme) {
    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "canvas", void 0);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "context", void 0);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "theme", void 0);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "flamegraph", void 0);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "intervals", void 0);

    this.canvas = canvas;
    this.flamegraph = flamegraph;
    this.theme = theme;
    this.intervals = computeAbsoluteSampleTimestamps(configSpace.x, this.flamegraph.profile.weights);
    this.context = (0,_gl_utils__WEBPACK_IMPORTED_MODULE_1__.getContext)(canvas, '2d');
  }

  draw(configViewToPhysicalSpace, configView) {
    let context = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : this.context;

    if (this.intervals.length === 0) {
      return;
    }

    const height = this.theme.SIZES.LABEL_FONT_SIZE * window.devicePixelRatio + this.theme.SIZES.LABEL_FONT_PADDING * window.devicePixelRatio * 2 - this.theme.SIZES.LABEL_FONT_PADDING;
    context.strokeStyle = `rgba(${this.theme.COLORS.SAMPLE_TICK_COLOR.join(',')})`;
    context.lineWidth = this.theme.SIZES.INTERNAL_SAMPLE_TICK_LINE_WIDTH;

    for (let i = 0; i < this.intervals.length; i++) {
      const interval = this.intervals[i];

      if (interval < configView.left) {
        continue;
      }

      if (interval > configView.right) {
        break;
      } // Compute the x position of our interval from config space to physical


      const physicalIntervalPosition = Math.round(interval * configViewToPhysicalSpace[0] + configViewToPhysicalSpace[6]);
      context.strokeRect(physicalIntervalPosition, 0, 0, height);
    }
  }

}



/***/ }),

/***/ "./app/utils/profiling/renderers/selectedFrameRenderer.tsx":
/*!*****************************************************************!*\
  !*** ./app/utils/profiling/renderers/selectedFrameRenderer.tsx ***!
  \*****************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "SelectedFrameRenderer": () => (/* binding */ SelectedFrameRenderer)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var _gl_utils__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../gl/utils */ "./app/utils/profiling/gl/utils.ts");



class SelectedFrameRenderer {
  constructor(canvas) {
    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "canvas", void 0);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "context", void 0);

    this.canvas = canvas;
    this.context = (0,_gl_utils__WEBPACK_IMPORTED_MODULE_1__.getContext)(canvas, '2d');
  } // We allow for passing of different contexts, this allows us to use a
  // single instance of the renderer to draw overlays on multiple canvases


  draw(frames, style, configViewToPhysicalSpace) {
    let context = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : this.context;
    context.strokeStyle = style.BORDER_COLOR;
    context.lineWidth = style.BORDER_WIDTH;

    for (let i = 0; i < frames.length; i++) {
      const frameInPhysicalSpace = frames[i].transformRect(configViewToPhysicalSpace); // We draw the border in the center of the flamegraph, so we need to increase
      // the width by border width and negatively offset it by half the border width

      const borderRect = frameInPhysicalSpace.withWidth(frameInPhysicalSpace.width - style.BORDER_WIDTH).withHeight(frameInPhysicalSpace.height - style.BORDER_WIDTH).translate(frameInPhysicalSpace.x + style.BORDER_WIDTH / 2, frameInPhysicalSpace.y + style.BORDER_WIDTH / 2);
      context.beginPath();
      context.strokeRect(borderRect.x, borderRect.y, borderRect.width, borderRect.height);
    }
  }

}



/***/ }),

/***/ "./app/utils/profiling/renderers/shaders.tsx":
/*!***************************************************!*\
  !*** ./app/utils/profiling/renderers/shaders.tsx ***!
  \***************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "fragment": () => (/* binding */ fragment),
/* harmony export */   "vertex": () => (/* binding */ vertex)
/* harmony export */ });
const vertex = () => `
attribute vec2 a_position;
attribute vec4 a_color;
attribute vec4 a_bounds;

uniform mat3 u_model;
uniform mat3 u_projection;

varying lowp vec4 v_color;
varying vec2 v_pos;
varying vec4 v_bounds;

void main() {
  vec2 scaled = (u_model * vec3(a_position.xy, 1)).xy;
  vec2 pos = (u_projection * vec3(scaled.xy, 1)).xy;

  gl_Position = vec4(pos, 0.0, 1.0);

  v_color = a_color;
  v_pos = a_position.xy;
  v_bounds = a_bounds;
}
`;
const fragment = theme => `
// fragment shaders don't have a default precision so we need
// to pick one. mediump is a good default
precision mediump float;

uniform bool u_is_search_result;
uniform vec2 u_border_width;
uniform bool u_draw_border;

varying lowp vec4 v_color;
varying vec4 v_bounds;
varying vec2 v_pos;

void main() {
  float minX = v_bounds.x + u_border_width.x;
  float maxX = v_bounds.z - u_border_width.x;

  float minY = v_bounds.y + u_border_width.y;
  float maxY = v_bounds.y + 1.0 - u_border_width.y;

  float width = maxX - minX;

  if (u_is_search_result) {
    gl_FragColor = ${theme.COLORS.SEARCH_RESULT_FRAME_COLOR};
  } else if (u_draw_border) {
    if(width <= u_border_width.x) {
      if(v_pos.y > minY && v_pos.y < maxY){
        gl_FragColor = vec4(v_color);
      } else {
        gl_FragColor = vec4(0.0, 0.0, 0.0, 0.0);
      }
    } else if (v_pos.x > minX && v_pos.x < maxX && v_pos.y > minY && v_pos.y < maxY) {
      gl_FragColor = vec4(v_color);
    } else {
      gl_FragColor = vec4(0.0, 0.0, 0.0, 0.0);
    }
  } else {
    gl_FragColor = vec4(v_color);
  }
}
`;

/***/ }),

/***/ "./app/utils/profiling/renderers/textRenderer.tsx":
/*!********************************************************!*\
  !*** ./app/utils/profiling/renderers/textRenderer.tsx ***!
  \********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "TextRenderer": () => (/* binding */ TextRenderer)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var _flamegraphFrame__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../flamegraphFrame */ "./app/utils/profiling/flamegraphFrame.tsx");
/* harmony import */ var _gl_utils__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ../gl/utils */ "./app/utils/profiling/gl/utils.ts");




const TEST_STRING = 'Who knows if this changed, font-display: swap wont tell me';

class TextRenderer {
  constructor(canvas, flamegraph, theme) {
    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "canvas", void 0);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "theme", void 0);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "flamegraph", void 0);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "context", void 0);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "textCache", void 0);

    this.canvas = canvas;
    this.theme = theme;
    this.flamegraph = flamegraph;
    this.context = (0,_gl_utils__WEBPACK_IMPORTED_MODULE_3__.getContext)(canvas, '2d');
    this.textCache = {};
    (0,_gl_utils__WEBPACK_IMPORTED_MODULE_3__.resizeCanvasToDisplaySize)(canvas);
  }

  measureAndCacheText(text) {
    if (this.textCache[text]) {
      return this.textCache[text];
    }

    this.textCache[text] = this.context.measureText(text);
    return this.textCache[text];
  }

  maybeInvalidateCache() {
    if (this.textCache[TEST_STRING] === undefined) {
      this.measureAndCacheText(TEST_STRING);
      return;
    }

    const newMeasuredSize = this.context.measureText(TEST_STRING);

    if (newMeasuredSize !== this.textCache[TEST_STRING]) {
      this.textCache = {
        [TEST_STRING]: newMeasuredSize
      };
    }
  }

  draw(configView, configViewToPhysicalSpace, flamegraphSearchResults) {
    // Make sure we set font size before we measure text for the first draw
    const FONT_SIZE = this.theme.SIZES.BAR_FONT_SIZE * window.devicePixelRatio;
    this.context.font = `${FONT_SIZE}px ${this.theme.FONTS.FRAME_FONT}`;
    this.context.textBaseline = 'alphabetic';
    this.maybeInvalidateCache();
    const MIN_WIDTH = this.measureAndCacheText(_gl_utils__WEBPACK_IMPORTED_MODULE_3__.ELLIPSIS).width;
    const SIDE_PADDING = 2 * this.theme.SIZES.BAR_PADDING * window.devicePixelRatio;
    const HALF_SIDE_PADDING = SIDE_PADDING / 2;
    const BASELINE_OFFSET = (this.theme.SIZES.BAR_HEIGHT - this.theme.SIZES.BAR_FONT_SIZE / 2) * window.devicePixelRatio;
    const HIGHLIGHT_BACKGROUND_COLOR = `rgb(${this.theme.COLORS.HIGHLIGHTED_LABEL_COLOR.join(', ')})`;
    const TOP_BOUNDARY = configView.top - 1;
    const BOTTOM_BOUNDARY = configView.bottom + 1;
    const HAS_SEARCH_RESULTS = flamegraphSearchResults.size > 0; // We start by iterating over root frames, so we draw the call stacks top-down.
    // This allows us to do a couple optimizations that improve our best case performance.
    // 1. We can skip drawing the entire tree if the root frame is not visible
    // 2. We can skip drawing and

    const frames = [...this.flamegraph.root.children];

    while (frames.length > 0) {
      const frame = frames.pop(); // Check if our rect overlaps with the current viewport and skip it

      if (frame.end < configView.left || frame.start > configView.right) {
        continue;
      } // We pin the start and end of the frame, so scrolling around keeps text pinned to the left or right side of the viewport


      const pinnedStart = Math.max(frame.start, configView.left);
      const pinnedEnd = Math.min(frame.end, configView.right); // Transform frame to physical space coordinates. This does the same operation as
      // Rect.transformRect, but without allocating a new Rect object.

      const frameWidth = (pinnedEnd - pinnedStart) * configViewToPhysicalSpace[0] + configViewToPhysicalSpace[3]; // Since the text is not exactly aligned to the left/right bounds of the frame, we need to subtract the padding
      // from the total width, so that we can truncate the center of the text accurately.

      const paddedRectangleWidth = frameWidth - SIDE_PADDING; // Since children of a frame cannot be wider than the frame itself, we can exit early and discard the entire subtree

      if (paddedRectangleWidth <= MIN_WIDTH) {
        continue;
      }

      if (frame.depth > BOTTOM_BOUNDARY) {
        continue;
      }

      for (let i = 0; i < frame.children.length; i++) {
        frames.push(frame.children[i]);
      } // If a frame is lower than the top, we can skip drawing its text, however
      // we can only do so after we have pushed it's children into the queue or else
      // those children will never be drawn and the entire sub-tree will be skipped.


      if (frame.depth < TOP_BOUNDARY) {
        continue;
      } // Transform frame to physical space coordinates. This does the same operation as
      // Rect.transformRect, but without allocating a new Rect object.


      const frameHeight = (pinnedEnd - pinnedStart) * configViewToPhysicalSpace[1] + configViewToPhysicalSpace[4];
      const frameX = pinnedStart * configViewToPhysicalSpace[0] + frame.depth * configViewToPhysicalSpace[3] + configViewToPhysicalSpace[6];
      const frameY = pinnedStart * configViewToPhysicalSpace[1] + frame.depth * configViewToPhysicalSpace[4] + configViewToPhysicalSpace[7]; // We want to draw the text in the vertical center of the frame, so we substract half the height of the text.
      // Since the origin of the rect in the inverted view is also inverted, we need to add the height.

      const y = frameY + (frameHeight < 0 ? frameHeight : 0) + BASELINE_OFFSET;
      const x = frameX + (frameWidth < 0 ? frameWidth : 0) + HALF_SIDE_PADDING;
      const trim = (0,_gl_utils__WEBPACK_IMPORTED_MODULE_3__.trimTextCenter)(frame.frame.name, (0,_gl_utils__WEBPACK_IMPORTED_MODULE_3__.findRangeBinarySearch)({
        low: 0,
        high: paddedRectangleWidth
      }, n => this.measureAndCacheText(frame.frame.name.substring(0, n)).width, paddedRectangleWidth)[0]);

      if (HAS_SEARCH_RESULTS) {
        const frameId = (0,_flamegraphFrame__WEBPACK_IMPORTED_MODULE_2__.getFlamegraphFrameSearchId)(frame);
        const frameResults = flamegraphSearchResults.get(frameId);

        if (frameResults) {
          this.context.fillStyle = HIGHLIGHT_BACKGROUND_COLOR;
          const highlightedBounds = (0,_gl_utils__WEBPACK_IMPORTED_MODULE_3__.computeHighlightedBounds)(frameResults.match, trim);
          const frontMatter = trim.text.slice(0, highlightedBounds[0]);
          const highlightWidth = this.measureAndCacheText(trim.text.substring(highlightedBounds[0], highlightedBounds[1])).width;
          this.context.fillRect(x + this.measureAndCacheText(frontMatter).width, y + FONT_SIZE / 2 - BASELINE_OFFSET, highlightWidth, FONT_SIZE);
        }
      }

      this.context.fillStyle = this.theme.COLORS.LABEL_FONT_COLOR;
      this.context.fillText(trim.text, x, y);
    }
  }

}



/***/ }),

/***/ "./app/utils/profiling/units/units.ts":
/*!********************************************!*\
  !*** ./app/utils/profiling/units/units.ts ***!
  \********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "makeFormatter": () => (/* binding */ makeFormatter),
/* harmony export */   "makeTimelineFormatter": () => (/* binding */ makeTimelineFormatter),
/* harmony export */   "relativeChange": () => (/* binding */ relativeChange)
/* harmony export */ });
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/es.error.cause.js */ "../node_modules/core-js/modules/es.error.cause.js");
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_0__);

function relativeChange(final, initial) {
  return (final - initial) / initial;
}
const durationMappings = {
  nanoseconds: 1e-9,
  microseconds: 1e-6,
  milliseconds: 1e-3,
  seconds: 1
};

const format = (v, abbrev, precision) => {
  return v.toFixed(precision) + abbrev;
};

function makeFormatter(from) {
  const multiplier = durationMappings[from];

  if (multiplier === undefined) {
    throw new Error(`Cannot format from unit ${from}, duration mapping is not defined`);
  }

  return value => {
    const duration = value * multiplier;

    if (duration >= 1) {
      return format(duration, 's', 2);
    }

    if (duration / 1e-3 >= 1) {
      return format(duration / 1e-3, 'ms', 2);
    }

    if (duration / 1e-6 >= 1) {
      return format(duration / 1e-6, 'μs', 2);
    }

    return format(duration / 1e-9, 'ns', 2);
  };
}

function pad(n, slots) {
  return Math.floor(n).toString().padStart(slots, '0');
}

function makeTimelineFormatter(from) {
  const multiplier = durationMappings[from];

  if (multiplier === undefined) {
    throw new Error(`Cannot format from unit ${from}, duration mapping is not defined`);
  }

  return value => {
    const s = value * multiplier;
    const m = s / 60;
    const ms = s * 1e3;
    return `${pad(m, 2)}:${pad(s % 60, 2)}.${pad(ms % 1e3, 3)}`;
  };
}

/***/ }),

/***/ "./app/utils/profiling/validators/regExp.tsx":
/*!***************************************************!*\
  !*** ./app/utils/profiling/validators/regExp.tsx ***!
  \***************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "isRegExpString": () => (/* binding */ isRegExpString),
/* harmony export */   "parseRegExp": () => (/* binding */ parseRegExp)
/* harmony export */ });
const REG_EXP = /(.*)\/([dgimsuy])/;
const parseRegExp = string => {
  return string.match(REG_EXP);
};
const isRegExpString = string => {
  if (!(string !== null && string !== void 0 && string.trim().length)) {
    return false;
  }

  return REG_EXP.test(string);
};

/***/ }),

/***/ "./app/utils/useCombinedReducer.tsx":
/*!******************************************!*\
  !*** ./app/utils/useCombinedReducer.tsx ***!
  \******************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "makeCombinedReducers": () => (/* binding */ makeCombinedReducers),
/* harmony export */   "useCombinedReducer": () => (/* binding */ useCombinedReducer)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");


function makeCombinedReducers(reducers) {
  const keys = Object.keys(reducers);
  return (state, action) => {
    const nextState = {};

    for (const key of keys) {
      nextState[key] = reducers[key](state[key], action);
    }

    return nextState;
  };
}
function useCombinedReducer(reducers, initialState) {
  return (0,react__WEBPACK_IMPORTED_MODULE_1__.useReducer)(makeCombinedReducers(reducers), initialState);
}

/***/ }),

/***/ "./app/utils/useDevicePixelRatio.tsx":
/*!*******************************************!*\
  !*** ./app/utils/useDevicePixelRatio.tsx ***!
  \*******************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "useDevicePixelRatio": () => (/* binding */ useDevicePixelRatio)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");


/**
 * Hook to retrieve dpr value of the device and monitor for changes
 * (e.g. if user drags window to a screen with different dpr, we want to be notified).
 * @returns dpr of the device
 */

function useDevicePixelRatio() {
  const [devicePixelRatio, setDevicePixelRatio] = (0,react__WEBPACK_IMPORTED_MODULE_1__.useState)(window.devicePixelRatio);
  const updateDevicePixelRatio = (0,react__WEBPACK_IMPORTED_MODULE_1__.useCallback)(() => {
    setDevicePixelRatio(window.devicePixelRatio);
  }, []);
  (0,react__WEBPACK_IMPORTED_MODULE_1__.useLayoutEffect)(() => {
    window.matchMedia(`(resolution: ${devicePixelRatio}dppx)`).addEventListener('change', updateDevicePixelRatio, {
      once: true
    });
    return () => {
      window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`).removeEventListener('change', updateDevicePixelRatio);
    };
  }, [devicePixelRatio, updateDevicePixelRatio]);
  return devicePixelRatio;
}



/***/ }),

/***/ "./app/utils/useEffectAfterFirstRender.ts":
/*!************************************************!*\
  !*** ./app/utils/useEffectAfterFirstRender.ts ***!
  \************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "useEffectAfterFirstRender": () => (/* binding */ useEffectAfterFirstRender)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");


const useEffectAfterFirstRender = (cb, deps) => {
  const firstRender = (0,react__WEBPACK_IMPORTED_MODULE_0__.useRef)(true);
  (0,react__WEBPACK_IMPORTED_MODULE_0__.useEffect)(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }

    cb(); // Dependencies are explicitly managed and the deps warning is enabled for the custom hook.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
};



/***/ }),

/***/ "./app/utils/useLocalStorageState.ts":
/*!*******************************************!*\
  !*** ./app/utils/useLocalStorageState.ts ***!
  \*******************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "useLocalStorageState": () => (/* binding */ useLocalStorageState)
/* harmony export */ });
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/es.error.cause.js */ "../node_modules/core-js/modules/es.error.cause.js");
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_utils_localStorage__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/utils/localStorage */ "./app/utils/localStorage.tsx");




const SUPPORTS_QUEUE_MICROTASK = window && 'queueMicrotask' in window;
const SUPPORTS_LOCAL_STORAGE = window && 'localStorage' in window;

function scheduleMicroTask(callback) {
  if (SUPPORTS_QUEUE_MICROTASK) {
    window.queueMicrotask(callback);
  } else {
    Promise.resolve().then(callback).catch(e => {
      // Escape the promise and throw the error so it gets reported
      if (window) {
        window.setTimeout(() => {
          throw e;
        });
      } else {
        // Best effort and just rethrow
        throw e;
      }
    });
  }
} // Attempt to parse JSON. If it fails, swallow the error and return null.
// As an improvement, we should maybe allow users to intercept here or possibly use
// a different parsing function from JSON.parse


function tryParseStorage(jsonEncodedValue) {
  try {
    return JSON.parse(jsonEncodedValue);
  } catch (e) {
    return null;
  }
}

function makeTypeExceptionString(instance) {
  return `useLocalStorage: Native serialization of ${instance} is not supported. You are attempting to serialize a ${instance} instance this data will be lost. For more info, see how ${instance.toLowerCase()}s are serialized https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify#examples`;
}

function strictReplacer(_key, value) {
  if (typeof BigInt !== 'undefined' && typeof value === 'bigint') {
    throw new TypeError(makeTypeExceptionString('BigInt'));
  }

  if (value instanceof RegExp) {
    throw new TypeError(makeTypeExceptionString('RegExp'));
  }

  if (typeof Map !== 'undefined' && value instanceof Map) {
    throw new TypeError(makeTypeExceptionString('Map'));
  }

  if (typeof Set !== 'undefined' && value instanceof Set) {
    throw new TypeError(makeTypeExceptionString('Set'));
  }

  if (typeof WeakMap !== 'undefined' && value instanceof WeakMap) {
    throw new TypeError(makeTypeExceptionString('WeakMap'));
  }

  if (typeof WeakSet !== 'undefined' && value instanceof WeakSet) {
    throw new TypeError(makeTypeExceptionString('WeakSet'));
  }

  return value;
}

function stringifyForStorage(value) {
  return JSON.stringify(value, strictReplacer, 0);
}

function defaultOrInitializer(defaultValueOrInitializeFn, value, rawValue) {
  if (typeof defaultValueOrInitializeFn === 'function') {
    // https://github.com/microsoft/TypeScript/issues/37663#issuecomment-759728342
    // @ts-expect-error
    return defaultValueOrInitializeFn(value, rawValue);
  }

  return value === undefined ? defaultValueOrInitializeFn : value;
} // Initialize state with default value or value from localStorage.
// If window is not defined uses the default value and **does not** throw an error


function initializeStorage(key, defaultValueOrInitializeFn) {
  if (typeof key !== 'string') {
    throw new TypeError('useLocalStorage: key must be a string');
  } // Return default if env does not support localStorage. Passing null to initializer
  // to mimick not having any previously stored value there.


  if (!SUPPORTS_LOCAL_STORAGE) {
    return defaultOrInitializer(defaultValueOrInitializeFn, undefined, null);
  } // getItem and try and decode it, if null is returned use default initializer


  const jsonEncodedValue = sentry_utils_localStorage__WEBPACK_IMPORTED_MODULE_3__["default"].getItem(key);

  if (jsonEncodedValue === null) {
    return defaultOrInitializer(defaultValueOrInitializeFn, undefined, null);
  } // We may have failed to parse the value, so just pass it down raw to the initializer


  const decodedValue = tryParseStorage(jsonEncodedValue);

  if (decodedValue === null) {
    return defaultOrInitializer(defaultValueOrInitializeFn, undefined, jsonEncodedValue);
  } // We managed to decode the value, so use it


  return defaultOrInitializer(defaultValueOrInitializeFn, decodedValue, jsonEncodedValue);
} // Mimicks the behavior of React.useState but keeps state synced with localStorage.
// The only difference from React is that when a state initializer fn is passed,
// the first argument to that function will be the value that we decoded from localStorage
// and the second argument will be the raw value from localStorage. This is useful for cases where you may
// want to recover the error, apply a transformation or use an alternative parsing function.


function useLocalStorageState(key, initialState) {
  const [value, setValue] = (0,react__WEBPACK_IMPORTED_MODULE_2__.useState)(() => {
    return initializeStorage(key, initialState);
  }); // We want to avoid a blinking state with the old value when props change, so we reinitialize the state
  // before the screen updates using useLayoutEffect vs useEffect. The ref prevents this from firing on mount
  // as the value will already be initialized from the initialState and it would be unnecessary to re-initialize

  const renderRef = (0,react__WEBPACK_IMPORTED_MODULE_2__.useRef)(false);
  (0,react__WEBPACK_IMPORTED_MODULE_2__.useLayoutEffect)(() => {
    if (!renderRef.current) {
      renderRef.current = true;
      return;
    }

    setValue(initializeStorage(key, initialState)); // We only want to update the value when the key changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const setStoredValue = (0,react__WEBPACK_IMPORTED_MODULE_2__.useCallback)(newValue => {
    if (typeof key !== 'string') {
      throw new TypeError('useLocalStorage: key must be a string');
    }

    setValue(newValue); // Not critical and we dont want to block anything after this, so fire microtask
    // and allow this to eventually be in sync.

    scheduleMicroTask(() => {
      sentry_utils_localStorage__WEBPACK_IMPORTED_MODULE_3__["default"].setItem(key, stringifyForStorage(newValue));
    });
  }, [key]);
  return [value, setStoredValue];
}

/***/ }),

/***/ "./app/utils/useMemoWithPrevious.ts":
/*!******************************************!*\
  !*** ./app/utils/useMemoWithPrevious.ts ***!
  \******************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "useMemoWithPrevious": () => (/* binding */ useMemoWithPrevious)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var _useEffectAfterFirstRender__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./useEffectAfterFirstRender */ "./app/utils/useEffectAfterFirstRender.ts");
/* harmony import */ var _usePrevious__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./usePrevious */ "./app/utils/usePrevious.tsx");





const useMemoWithPrevious = (factory, deps) => {
  const [value, setValue] = (0,react__WEBPACK_IMPORTED_MODULE_1__.useState)(() => factory(null));
  const previous = (0,_usePrevious__WEBPACK_IMPORTED_MODULE_3__["default"])(value);
  (0,_useEffectAfterFirstRender__WEBPACK_IMPORTED_MODULE_2__.useEffectAfterFirstRender)(() => {
    setValue(factory(previous)); // Dependencies are explicitly managed and the deps warning is enabled for the custom hook.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return value;
};



/***/ }),

/***/ "./app/utils/useUndoableReducer.tsx":
/*!******************************************!*\
  !*** ./app/utils/useUndoableReducer.tsx ***!
  \******************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "makeUndoableReducer": () => (/* binding */ makeUndoableReducer),
/* harmony export */   "useUndoableReducer": () => (/* binding */ useUndoableReducer)
/* harmony export */ });
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/es.error.cause.js */ "../node_modules/core-js/modules/es.error.cause.js");
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");




function isUndoOrRedoAction(action) {
  if (action.type) {
    return action.type === 'undo' || action.type === 'redo';
  }

  return false;
}

function undoableReducer(state, action) {
  if (action.type === 'undo') {
    return state.previous === undefined ? state : state.previous;
  }

  if (action.type === 'redo') {
    return state.next === undefined ? state : state.next;
  }

  throw new Error('Unreachable case');
}

function makeUndoableReducer(reducer) {
  return (state, action) => {
    if (isUndoOrRedoAction(action)) {
      return undoableReducer(state, action);
    }

    const newState = {
      next: undefined,
      previous: state,
      current: reducer(state.current, action)
    };
    state.next = newState;
    return newState;
  };
}
function useUndoableReducer(reducer, initialState) {
  var _state$previous, _state$next;

  const [state, dispatch] = (0,react__WEBPACK_IMPORTED_MODULE_2__.useReducer)(makeUndoableReducer(reducer), {
    current: initialState,
    previous: undefined,
    next: undefined
  });
  return [state.current, dispatch, {
    previousState: (_state$previous = state.previous) === null || _state$previous === void 0 ? void 0 : _state$previous.current,
    nextState: (_state$next = state.next) === null || _state$next === void 0 ? void 0 : _state$next.current
  }];
}

/***/ }),

/***/ "./app/views/profiling/profileFlamechart.tsx":
/*!***************************************************!*\
  !*** ./app/views/profiling/profileFlamechart.tsx ***!
  \***************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_alert__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/alert */ "./app/components/alert.tsx");
/* harmony import */ var sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/loadingIndicator */ "./app/components/loadingIndicator.tsx");
/* harmony import */ var sentry_components_profiling_flamegraph__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/profiling/flamegraph */ "./app/components/profiling/flamegraph.tsx");
/* harmony import */ var sentry_components_sentryDocumentTitle__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/sentryDocumentTitle */ "./app/components/sentryDocumentTitle.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/utils/analytics/trackAdvancedAnalyticsEvent */ "./app/utils/analytics/trackAdvancedAnalyticsEvent.tsx");
/* harmony import */ var sentry_utils_profiling_flamegraph_flamegraphStateProvider_index__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/utils/profiling/flamegraph/flamegraphStateProvider/index */ "./app/utils/profiling/flamegraph/flamegraphStateProvider/index.tsx");
/* harmony import */ var sentry_utils_profiling_flamegraph_flamegraphThemeProvider__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/utils/profiling/flamegraph/flamegraphThemeProvider */ "./app/utils/profiling/flamegraph/flamegraphThemeProvider.tsx");
/* harmony import */ var sentry_utils_profiling_profile_profile__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/utils/profiling/profile/profile */ "./app/utils/profiling/profile/profile.tsx");
/* harmony import */ var sentry_utils_useLocalStorageState__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/utils/useLocalStorageState */ "./app/utils/useLocalStorageState.ts");
/* harmony import */ var sentry_utils_useLocation__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/utils/useLocation */ "./app/utils/useLocation.tsx");
/* harmony import */ var sentry_utils_useOrganization__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/utils/useOrganization */ "./app/utils/useOrganization.tsx");
/* harmony import */ var _profileGroupProvider__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! ./profileGroupProvider */ "./app/views/profiling/profileGroupProvider.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");



function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }

















const LoadingGroup = {
  name: 'Loading',
  traceID: '',
  activeProfileIndex: 0,
  profiles: [sentry_utils_profiling_profile_profile__WEBPACK_IMPORTED_MODULE_11__.Profile.Empty()]
};

function ProfileFlamegraph() {
  const location = (0,sentry_utils_useLocation__WEBPACK_IMPORTED_MODULE_13__.useLocation)();
  const organization = (0,sentry_utils_useOrganization__WEBPACK_IMPORTED_MODULE_14__["default"])();
  const [profileGroup, setProfileGroup] = (0,_profileGroupProvider__WEBPACK_IMPORTED_MODULE_15__.useProfileGroup)();
  const [storedPreferences] = (0,sentry_utils_useLocalStorageState__WEBPACK_IMPORTED_MODULE_12__.useLocalStorageState)(sentry_utils_profiling_flamegraph_flamegraphStateProvider_index__WEBPACK_IMPORTED_MODULE_9__.FLAMEGRAPH_LOCALSTORAGE_PREFERENCES_KEY, {
    preferences: {
      layout: sentry_utils_profiling_flamegraph_flamegraphStateProvider_index__WEBPACK_IMPORTED_MODULE_9__.DEFAULT_FLAMEGRAPH_STATE.preferences.layout
    }
  });
  (0,react__WEBPACK_IMPORTED_MODULE_2__.useEffect)(() => {
    (0,sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_8__["default"])('profiling_views.profile_flamegraph', {
      organization
    });
  }, [organization]);

  const onImport = profiles => {
    setProfileGroup({
      type: 'resolved',
      data: profiles
    });
  };

  const initialFlamegraphPreferencesState = (0,react__WEBPACK_IMPORTED_MODULE_2__.useMemo)(() => {
    var _ref, _storedPreferences$pr, _storedPreferences$pr2, _queryStringState$pre;

    const queryStringState = (0,sentry_utils_profiling_flamegraph_flamegraphStateProvider_index__WEBPACK_IMPORTED_MODULE_9__.decodeFlamegraphStateFromQueryParams)(location.query);
    return { ...queryStringState,
      preferences: { ...storedPreferences.preferences,
        ...queryStringState.preferences,
        layout: (_ref = (_storedPreferences$pr = storedPreferences === null || storedPreferences === void 0 ? void 0 : (_storedPreferences$pr2 = storedPreferences.preferences) === null || _storedPreferences$pr2 === void 0 ? void 0 : _storedPreferences$pr2.layout) !== null && _storedPreferences$pr !== void 0 ? _storedPreferences$pr : (_queryStringState$pre = queryStringState.preferences) === null || _queryStringState$pre === void 0 ? void 0 : _queryStringState$pre.layout) !== null && _ref !== void 0 ? _ref : sentry_utils_profiling_flamegraph_flamegraphStateProvider_index__WEBPACK_IMPORTED_MODULE_9__.DEFAULT_FLAMEGRAPH_STATE.preferences.layout
      }
    }; // We only want to decode this when our component mounts
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_components_sentryDocumentTitle__WEBPACK_IMPORTED_MODULE_6__["default"], {
    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Profiling \u2014 Flamechart'),
    orgSlug: organization.slug,
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_utils_profiling_flamegraph_flamegraphStateProvider_index__WEBPACK_IMPORTED_MODULE_9__.FlamegraphStateProvider, {
      initialState: initialFlamegraphPreferencesState,
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsxs)(sentry_utils_profiling_flamegraph_flamegraphThemeProvider__WEBPACK_IMPORTED_MODULE_10__.FlamegraphThemeProvider, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_utils_profiling_flamegraph_flamegraphStateProvider_index__WEBPACK_IMPORTED_MODULE_9__.FlamegraphStateQueryParamSync, {}), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_utils_profiling_flamegraph_flamegraphStateProvider_index__WEBPACK_IMPORTED_MODULE_9__.FlamegraphStateLocalStorageSync, {}), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(FlamegraphContainer, {
          children: profileGroup.type === 'errored' ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_components_alert__WEBPACK_IMPORTED_MODULE_3__["default"], {
            type: "error",
            showIcon: true,
            children: profileGroup.error
          }) : profileGroup.type === 'loading' ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsxs)(react__WEBPACK_IMPORTED_MODULE_2__.Fragment, {
            children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_components_profiling_flamegraph__WEBPACK_IMPORTED_MODULE_5__.Flamegraph, {
              onImport: onImport,
              profiles: LoadingGroup
            }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(LoadingIndicatorContainer, {
              children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_4__["default"], {})
            })]
          }) : profileGroup.type === 'resolved' ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_components_profiling_flamegraph__WEBPACK_IMPORTED_MODULE_5__.Flamegraph, {
            onImport: onImport,
            profiles: profileGroup.data
          }) : null
        })]
      })
    })
  });
}

ProfileFlamegraph.displayName = "ProfileFlamegraph";

const LoadingIndicatorContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e10jp3o01"
} : 0)( true ? {
  name: "1sjqn6p",
  styles: "position:absolute;display:flex;flex-direction:column;justify-content:center;width:100%;height:100%"
} : 0);

const FlamegraphContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e10jp3o00"
} : 0)( true ? {
  name: "1dfu8fu",
  styles: "display:flex;flex-direction:column;flex:1 1 100%;~footer{display:none;}"
} : 0);

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (ProfileFlamegraph);

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_views_profiling_profileFlamechart_tsx.527a5e881420b09dfa70d3ea55055901.js.map