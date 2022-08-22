"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_components_gridEditable_sortLink_tsx-app_views_eventsV2_table_cellAction_tsx"],{

/***/ "./app/components/gridEditable/sortLink.tsx":
/*!**************************************************!*\
  !*** ./app/components/gridEditable/sortLink.tsx ***!
  \**************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var lodash_omit__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! lodash/omit */ "../node_modules/lodash/omit.js");
/* harmony import */ var lodash_omit__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(lodash_omit__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var sentry_components_links_link__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/links/link */ "./app/components/links/link.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }







function SortLink(_ref) {
  let {
    align,
    title,
    canSort,
    generateSortLink,
    onClick,
    direction
  } = _ref;
  const target = generateSortLink();

  if (!target || !canSort) {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(StyledNonLink, {
      align: align,
      children: title
    });
  }

  const arrow = !direction ? null : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(StyledIconArrow, {
    size: "xs",
    direction: direction === 'desc' ? 'down' : 'up'
  });
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)(StyledLink, {
    align: align,
    to: target,
    onClick: onClick,
    children: [title, " ", arrow]
  });
}

SortLink.displayName = "SortLink";

const StyledLink = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(props => {
  const forwardProps = lodash_omit__WEBPACK_IMPORTED_MODULE_1___default()(props, ['align']);
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(sentry_components_links_link__WEBPACK_IMPORTED_MODULE_2__["default"], { ...forwardProps
  });
},  true ? {
  target: "e1xb2te62"
} : 0)("display:block;width:100%;white-space:nowrap;color:inherit;&:hover,&:active,&:focus,&:visited{color:inherit;}", p => p.align ? `text-align: ${p.align};` : '', ";" + ( true ? "" : 0));

const StyledNonLink = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1xb2te61"
} : 0)("display:block;width:100%;white-space:nowrap;", p => p.align ? `text-align: ${p.align};` : '', ";" + ( true ? "" : 0));

const StyledIconArrow = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_icons__WEBPACK_IMPORTED_MODULE_3__.IconArrow,  true ? {
  target: "e1xb2te60"
} : 0)( true ? {
  name: "40f4ru",
  styles: "vertical-align:top"
} : 0);

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (SortLink);

/***/ }),

/***/ "./app/views/eventsV2/table/cellAction.tsx":
/*!*************************************************!*\
  !*** ./app/views/eventsV2/table/cellAction.tsx ***!
  \*************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "Actions": () => (/* binding */ Actions),
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__),
/* harmony export */   "updateQuery": () => (/* binding */ updateQuery)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! core-js/modules/es.error.cause.js */ "../node_modules/core-js/modules/es.error.cause.js");
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_4___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_4__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var react_dom__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! react-dom */ "../node_modules/react-dom/profiling.js");
/* harmony import */ var react_popper__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! react-popper */ "../node_modules/react-popper/lib/esm/Popper.js");
/* harmony import */ var react_popper__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! react-popper */ "../node_modules/react-popper/lib/esm/Manager.js");
/* harmony import */ var react_popper__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! react-popper */ "../node_modules/react-popper/lib/esm/Reference.js");
/* harmony import */ var color__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! color */ "../node_modules/color/index.js");
/* harmony import */ var color__WEBPACK_IMPORTED_MODULE_17___default = /*#__PURE__*/__webpack_require__.n(color__WEBPACK_IMPORTED_MODULE_17__);
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");
/* harmony import */ var sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/utils/discover/fields */ "./app/utils/discover/fields.tsx");
/* harmony import */ var sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/utils/formatters */ "./app/utils/formatters.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");






function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }













let Actions;

(function (Actions) {
  Actions["ADD"] = "add";
  Actions["EXCLUDE"] = "exclude";
  Actions["SHOW_GREATER_THAN"] = "show_greater_than";
  Actions["SHOW_LESS_THAN"] = "show_less_than";
  Actions["TRANSACTION"] = "transaction";
  Actions["RELEASE"] = "release";
  Actions["DRILLDOWN"] = "drilldown";
  Actions["EDIT_THRESHOLD"] = "edit_threshold";
})(Actions || (Actions = {}));

function updateQuery(results, action, column, value) {
  const key = column.name;

  if (column.type === 'duration' && typeof value === 'number') {
    // values are assumed to be in milliseconds
    value = (0,sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_12__.getDuration)(value / 1000, 2, true);
  } // De-duplicate array values


  if (Array.isArray(value)) {
    value = [...new Set(value)];

    if (value.length === 1) {
      value = value[0];
    }
  }

  switch (action) {
    case Actions.ADD:
      // If the value is null/undefined create a has !has condition.
      if (value === null || value === undefined) {
        // Adding a null value is the same as excluding truthy values.
        // Remove inclusion if it exists.
        results.removeFilterValue('has', key);
        results.addFilterValues('!has', [key]);
      } else {
        // Remove exclusion if it exists.
        results.removeFilter(`!${key}`);

        if (Array.isArray(value)) {
          // For array values, add to existing filters
          const currentFilters = results.getFilterValues(key);
          value = [...new Set([...currentFilters, ...value])];
        } else {
          value = [String(value)];
        }

        results.setFilterValues(key, value);
      }

      break;

    case Actions.EXCLUDE:
      if (value === null || value === undefined) {
        // Excluding a null value is the same as including truthy values.
        // Remove exclusion if it exists.
        results.removeFilterValue('!has', key);
        results.addFilterValues('has', [key]);
      } else {
        // Remove positive if it exists.
        results.removeFilter(key); // Negations should stack up.

        const negation = `!${key}`;
        value = Array.isArray(value) ? value : [String(value)];
        const currentNegations = results.getFilterValues(negation);
        value = [...new Set([...currentNegations, ...value])];
        results.setFilterValues(negation, value);
      }

      break;

    case Actions.SHOW_GREATER_THAN:
      {
        // Remove query token if it already exists
        results.setFilterValues(key, [`>${value}`]);
        break;
      }

    case Actions.SHOW_LESS_THAN:
      {
        // Remove query token if it already exists
        results.setFilterValues(key, [`<${value}`]);
        break;
      }
    // these actions do not modify the query in any way,
    // instead they have side effects

    case Actions.TRANSACTION:
    case Actions.RELEASE:
    case Actions.DRILLDOWN:
      break;

    default:
      throw new Error(`Unknown action type. ${action}`);
  }
}

function makeCellActions(_ref) {
  let {
    dataRow,
    column,
    handleCellAction,
    allowActions
  } = _ref;

  // Do not render context menu buttons for the span op breakdown field.
  if ((0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_11__.isRelativeSpanOperationBreakdownField)(column.name)) {
    return null;
  } // Do not render context menu buttons for the equation fields until we can query on them


  if ((0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_11__.isEquationAlias)(column.name)) {
    return null;
  }

  let value = dataRow[column.name]; // error.handled is a strange field where null = true.

  if (Array.isArray(value) && value[0] === null && column.column.kind === 'field' && column.column.field === 'error.handled') {
    value = 1;
  }

  const actions = [];

  function addMenuItem(action, menuItem) {
    if (Array.isArray(allowActions) && allowActions.includes(action) || !allowActions) {
      actions.push(menuItem);
    }
  }

  if (!['duration', 'number', 'percentage'].includes(column.type) || value === null && column.column.kind === 'field') {
    addMenuItem(Actions.ADD, (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(ActionItem, {
      "data-test-id": "add-to-filter",
      onClick: () => handleCellAction(Actions.ADD, value),
      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('Add to filter')
    }, "add-to-filter"));

    if (column.type !== 'date') {
      addMenuItem(Actions.EXCLUDE, (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(ActionItem, {
        "data-test-id": "exclude-from-filter",
        onClick: () => handleCellAction(Actions.EXCLUDE, value),
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('Exclude from filter')
      }, "exclude-from-filter"));
    }
  }

  if (['date', 'duration', 'integer', 'number', 'percentage'].includes(column.type) && value !== null) {
    addMenuItem(Actions.SHOW_GREATER_THAN, (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(ActionItem, {
      "data-test-id": "show-values-greater-than",
      onClick: () => handleCellAction(Actions.SHOW_GREATER_THAN, value),
      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('Show values greater than')
    }, "show-values-greater-than"));
    addMenuItem(Actions.SHOW_LESS_THAN, (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(ActionItem, {
      "data-test-id": "show-values-less-than",
      onClick: () => handleCellAction(Actions.SHOW_LESS_THAN, value),
      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('Show values less than')
    }, "show-values-less-than"));
  }

  if (column.column.kind === 'field' && column.column.field === 'transaction') {
    addMenuItem(Actions.TRANSACTION, (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(ActionItem, {
      "data-test-id": "transaction-summary",
      onClick: () => handleCellAction(Actions.TRANSACTION, value),
      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('Go to summary')
    }, "transaction-summary"));
  }

  if (column.column.kind === 'field' && column.column.field === 'release' && value) {
    addMenuItem(Actions.RELEASE, (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(ActionItem, {
      "data-test-id": "release",
      onClick: () => handleCellAction(Actions.RELEASE, value),
      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('Go to release')
    }, "release"));
  }

  if (column.column.kind === 'function' && column.column.function[0] === 'count_unique') {
    addMenuItem(Actions.DRILLDOWN, (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(ActionItem, {
      "data-test-id": "per-cell-drilldown",
      onClick: () => handleCellAction(Actions.DRILLDOWN, value),
      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('View Stacks')
    }, "drilldown"));
  }

  if (column.column.kind === 'function' && column.column.function[0] === 'user_misery' && (0,sentry_utils__WEBPACK_IMPORTED_MODULE_10__.defined)(dataRow.project_threshold_config)) {
    addMenuItem(Actions.EDIT_THRESHOLD, (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(ActionItem, {
      "data-test-id": "edit-threshold",
      onClick: () => handleCellAction(Actions.EDIT_THRESHOLD, value),
      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.tct)('Edit threshold ([threshold]ms)', {
        threshold: dataRow.project_threshold_config[1]
      })
    }, "edit_threshold"));
  }

  if (actions.length === 0) {
    return null;
  }

  return actions;
}

class CellAction extends react__WEBPACK_IMPORTED_MODULE_5__.Component {
  constructor(props) {
    super(props);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", {
      isHovering: false,
      isOpen: false
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "portalEl", void 0);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "menuEl", void 0);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleClickOutside", event => {
      if (!this.menuEl) {
        return;
      }

      if (!(event.target instanceof Element)) {
        return;
      }

      if (this.menuEl.contains(event.target)) {
        return;
      }

      this.setState({
        isOpen: false,
        isHovering: false
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleMouseEnter", () => {
      this.setState({
        isHovering: true
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleMouseLeave", () => {
      this.setState(state => {
        // Don't hide the button if the menu is open.
        if (state.isOpen) {
          return state;
        }

        return { ...state,
          isHovering: false
        };
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleMenuToggle", event => {
      event.preventDefault();
      this.setState({
        isOpen: !this.state.isOpen
      });
    });

    let portal = document.getElementById('cell-action-portal');

    if (!portal) {
      portal = document.createElement('div');
      portal.setAttribute('id', 'cell-action-portal');
      document.body.appendChild(portal);
    }

    this.portalEl = portal;
    this.menuEl = null;
  }

  componentDidUpdate(_props, prevState) {
    if (this.state.isOpen && prevState.isOpen === false) {
      document.addEventListener('click', this.handleClickOutside, true);
    }

    if (this.state.isOpen === false && prevState.isOpen) {
      document.removeEventListener('click', this.handleClickOutside, true);
    }
  }

  componentWillUnmount() {
    document.removeEventListener('click', this.handleClickOutside, true);
  }

  renderMenu() {
    const {
      isOpen
    } = this.state;
    const actions = makeCellActions(this.props);

    if (actions === null) {
      // do not render the menu if there are no per cell actions
      return null;
    }

    const modifiers = [{
      name: 'hide',
      enabled: false
    }, {
      name: 'preventOverflow',
      enabled: true,
      options: {
        padding: 10,
        altAxis: true
      }
    }, {
      name: 'offset',
      options: {
        offset: [0, ARROW_SIZE / 2]
      }
    }, {
      name: 'computeStyles',
      options: {
        // Using the `transform` attribute causes our borders to get blurry
        // in chrome. See [0]. This just causes it to use `top` / `left`
        // positions, which should be fine.
        //
        // [0]: https://stackoverflow.com/questions/29543142/css3-transformation-blurry-borders
        gpuAcceleration: false
      }
    }];
    const menu = !isOpen ? null : /*#__PURE__*/(0,react_dom__WEBPACK_IMPORTED_MODULE_6__.createPortal)((0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(react_popper__WEBPACK_IMPORTED_MODULE_14__.Popper, {
      placement: "top",
      modifiers: modifiers,
      children: _ref2 => {
        let {
          ref: popperRef,
          style,
          placement,
          arrowProps
        } = _ref2;
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsxs)(Menu, {
          ref: ref => {
            popperRef(ref);
            this.menuEl = ref;
          },
          style: style,
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(MenuArrow, {
            ref: arrowProps.ref,
            "data-placement": placement,
            style: arrowProps.style
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(MenuButtons, {
            onClick: event => event.stopPropagation(),
            children: actions
          })]
        });
      }
    }), this.portalEl);
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(MenuRoot, {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsxs)(react_popper__WEBPACK_IMPORTED_MODULE_15__.Manager, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(react_popper__WEBPACK_IMPORTED_MODULE_16__.Reference, {
          children: _ref3 => {
            let {
              ref
            } = _ref3;
            return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(MenuButton, {
              ref: ref,
              onClick: this.handleMenuToggle,
              children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_7__.IconEllipsis, {
                size: "sm",
                "data-test-id": "cell-action",
                color: "blue300"
              })
            });
          }
        }), menu]
      })
    });
  }

  render() {
    const {
      children
    } = this.props;
    const {
      isHovering
    } = this.state;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsxs)(Container, {
      onMouseEnter: this.handleMouseEnter,
      onMouseLeave: this.handleMouseLeave,
      children: [children, isHovering && this.renderMenu()]
    });
  }

}

CellAction.displayName = "CellAction";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (CellAction);

const Container = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e18g1e9m6"
} : 0)( true ? {
  name: "nwytwd",
  styles: "position:relative;width:100%;height:100%;display:flex;flex-direction:column;justify-content:center"
} : 0);

const MenuRoot = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e18g1e9m5"
} : 0)( true ? {
  name: "1lby940",
  styles: "position:absolute;top:0;right:0"
} : 0);

const Menu = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e18g1e9m4"
} : 0)("z-index:", p => p.theme.zIndex.tooltip, ";" + ( true ? "" : 0));

const MenuButtons = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e18g1e9m3"
} : 0)("background:", p => p.theme.background, ";border:1px solid ", p => p.theme.border, ";border-radius:", p => p.theme.borderRadius, ";box-shadow:", p => p.theme.dropShadowHeavy, ";overflow:hidden;" + ( true ? "" : 0));

const ARROW_SIZE = 12;

const MenuArrow = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('span',  true ? {
  target: "e18g1e9m2"
} : 0)("pointer-events:none;position:absolute;width:", ARROW_SIZE, "px;height:", ARROW_SIZE, "px;&::before,&::after{content:'';display:block;position:absolute;height:", ARROW_SIZE, "px;width:", ARROW_SIZE, "px;border:solid 6px transparent;}&[data-placement|='bottom']{top:-", ARROW_SIZE, "px;&::before{bottom:1px;border-bottom-color:", p => p.theme.translucentBorder, ";}&::after{border-bottom-color:", p => p.theme.backgroundElevated, ";}}&[data-placement|='top']{bottom:-", ARROW_SIZE, "px;&::before{top:1px;border-top-color:", p => p.theme.translucentBorder, ";}&::after{border-top-color:", p => p.theme.backgroundElevated, ";}}&[data-placement|='right']{left:-", ARROW_SIZE, "px;&::before{right:1px;border-right-color:", p => p.theme.translucentBorder, ";}&::after{border-right-color:", p => p.theme.backgroundElevated, ";}}&[data-placement|='left']{right:-", ARROW_SIZE, "px;&::before{left:1px;border-left-color:", p => p.theme.translucentBorder, ";}&::after{border-left-color:", p => p.theme.backgroundElevated, ";}}" + ( true ? "" : 0));

const ActionItem = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('button',  true ? {
  target: "e18g1e9m1"
} : 0)("display:block;width:100%;padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__["default"])(1), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__["default"])(2), ";background:transparent;outline:none;border:0;border-bottom:1px solid ", p => p.theme.innerBorder, ";font-size:", p => p.theme.fontSizeMedium, ";text-align:left;line-height:1.2;&:hover{background:", p => p.theme.backgroundSecondary, ";}&:last-child{border-bottom:0;}" + ( true ? "" : 0));

const MenuButton = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('button',  true ? {
  target: "e18g1e9m0"
} : 0)("display:flex;width:24px;height:24px;padding:0;justify-content:center;align-items:center;background:", p => color__WEBPACK_IMPORTED_MODULE_17___default()(p.theme.background).alpha(0.85).string(), ";border-radius:", p => p.theme.borderRadius, ";border:1px solid ", p => p.theme.border, ";cursor:pointer;outline:none;" + ( true ? "" : 0));

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_components_gridEditable_sortLink_tsx-app_views_eventsV2_table_cellAction_tsx.bf3734f6f2e3d059edb0ee2e02d22065.js.map