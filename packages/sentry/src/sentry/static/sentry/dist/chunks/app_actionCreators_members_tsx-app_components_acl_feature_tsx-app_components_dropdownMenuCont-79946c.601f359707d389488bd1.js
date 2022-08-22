"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_actionCreators_members_tsx-app_components_acl_feature_tsx-app_components_dropdownMenuCont-79946c"],{

/***/ "./app/actionCreators/members.tsx":
/*!****************************************!*\
  !*** ./app/actionCreators/members.tsx ***!
  \****************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "fetchOrgMembers": () => (/* binding */ fetchOrgMembers),
/* harmony export */   "getCurrentMember": () => (/* binding */ getCurrentMember),
/* harmony export */   "indexMembersByProject": () => (/* binding */ indexMembersByProject),
/* harmony export */   "resendMemberInvite": () => (/* binding */ resendMemberInvite),
/* harmony export */   "updateMember": () => (/* binding */ updateMember)
/* harmony export */ });
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/es.error.cause.js */ "../node_modules/core-js/modules/es.error.cause.js");
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var _sentry_react__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! @sentry/react */ "../node_modules/@sentry/hub/esm/exports.js");
/* harmony import */ var sentry_actions_memberActions__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/actions/memberActions */ "./app/actions/memberActions.tsx");
/* harmony import */ var sentry_stores_memberListStore__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/stores/memberListStore */ "./app/stores/memberListStore.tsx");






function getMemberUser(member) {
  return { ...member.user,
    role: member.role
  };
}

async function fetchOrgMembers(api, orgId) {
  let projectIds = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : null;
  const endpoint = `/organizations/${orgId}/users/`;
  const query = projectIds ? {
    project: projectIds
  } : {};

  try {
    const members = await api.requestPromise(endpoint, {
      method: 'GET',
      query
    });

    if (!members) {
      // This shouldn't happen if the request was successful
      // It should at least be an empty list
      _sentry_react__WEBPACK_IMPORTED_MODULE_4__.withScope(scope => {
        scope.setExtras({
          orgId,
          projectIds
        });
        _sentry_react__WEBPACK_IMPORTED_MODULE_4__.captureException(new Error('Members is undefined'));
      });
    }

    const memberUsers = members === null || members === void 0 ? void 0 : members.filter(_ref => {
      let {
        user
      } = _ref;
      return user;
    });

    if (!memberUsers) {
      return [];
    } // Update the store with just the users, as avatars rely on them.


    sentry_stores_memberListStore__WEBPACK_IMPORTED_MODULE_3__["default"].loadInitialData(memberUsers.map(getMemberUser));
    return members;
  } catch (err) {
    _sentry_react__WEBPACK_IMPORTED_MODULE_4__.setExtras({
      resp: err
    });
    _sentry_react__WEBPACK_IMPORTED_MODULE_4__.captureException(err);
  }

  return [];
}

/**
 * Convert a list of members with user & project data
 * into a object that maps project slugs : users in that project.
 */
function indexMembersByProject(members) {
  return members.reduce((acc, member) => {
    for (const project of member.projects) {
      if (!acc.hasOwnProperty(project)) {
        acc[project] = [];
      }

      acc[project].push(member.user);
    }

    return acc;
  }, {});
}
async function updateMember(api, _ref2) {
  let {
    orgId,
    memberId,
    data
  } = _ref2;
  sentry_actions_memberActions__WEBPACK_IMPORTED_MODULE_2__["default"].update(memberId, data);
  const endpoint = `/organizations/${orgId}/members/${memberId}/`;

  try {
    const resp = await api.requestPromise(endpoint, {
      method: 'PUT',
      data
    });
    sentry_actions_memberActions__WEBPACK_IMPORTED_MODULE_2__["default"].updateSuccess(resp);
    return resp;
  } catch (err) {
    sentry_actions_memberActions__WEBPACK_IMPORTED_MODULE_2__["default"].updateError(err);
    throw err;
  }
}
async function resendMemberInvite(api, _ref3) {
  let {
    orgId,
    memberId,
    regenerate,
    data
  } = _ref3;
  sentry_actions_memberActions__WEBPACK_IMPORTED_MODULE_2__["default"].resendMemberInvite(orgId, data);
  const endpoint = `/organizations/${orgId}/members/${memberId}/`;

  try {
    const resp = await api.requestPromise(endpoint, {
      method: 'PUT',
      data: {
        regenerate,
        reinvite: true
      }
    });
    sentry_actions_memberActions__WEBPACK_IMPORTED_MODULE_2__["default"].resendMemberInviteSuccess(resp);
    return resp;
  } catch (err) {
    sentry_actions_memberActions__WEBPACK_IMPORTED_MODULE_2__["default"].resendMemberInviteError(err);
    throw err;
  }
}
function getCurrentMember(api, orgId) {
  return api.requestPromise(`/organizations/${orgId}/members/me/`);
}

/***/ }),

/***/ "./app/actions/memberActions.tsx":
/*!***************************************!*\
  !*** ./app/actions/memberActions.tsx ***!
  \***************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var reflux__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! reflux */ "../node_modules/reflux/src/index.js");
/* harmony import */ var reflux__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(reflux__WEBPACK_IMPORTED_MODULE_0__);

const MemberActions = (0,reflux__WEBPACK_IMPORTED_MODULE_0__.createActions)(['createSuccess', 'update', 'updateError', 'updateSuccess', 'resendMemberInvite', 'resendMemberInviteSuccess', 'resendMemberInviteError']);
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (MemberActions);

/***/ }),

/***/ "./app/components/acl/comingSoon.tsx":
/*!*******************************************!*\
  !*** ./app/components/acl/comingSoon.tsx ***!
  \*******************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var sentry_components_alert__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/components/alert */ "./app/components/alert.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




const ComingSoon = () => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)(sentry_components_alert__WEBPACK_IMPORTED_MODULE_0__["default"], {
  type: "info",
  showIcon: true,
  children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('This feature is coming soon!')
});

ComingSoon.displayName = "ComingSoon";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (ComingSoon);

/***/ }),

/***/ "./app/components/acl/feature.tsx":
/*!****************************************!*\
  !*** ./app/components/acl/feature.tsx ***!
  \****************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_stores_hookStore__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/stores/hookStore */ "./app/stores/hookStore.tsx");
/* harmony import */ var sentry_utils_isRenderFunc__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/utils/isRenderFunc */ "./app/utils/isRenderFunc.tsx");
/* harmony import */ var sentry_utils_withConfig__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/utils/withConfig */ "./app/utils/withConfig.tsx");
/* harmony import */ var sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/utils/withOrganization */ "./app/utils/withOrganization.tsx");
/* harmony import */ var sentry_utils_withProject__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/utils/withProject */ "./app/utils/withProject.tsx");
/* harmony import */ var _comingSoon__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! ./comingSoon */ "./app/components/acl/comingSoon.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");











/**
 * Component to handle feature flags.
 */
class Feature extends react__WEBPACK_IMPORTED_MODULE_2__.Component {
  getAllFeatures() {
    const {
      organization,
      project,
      config
    } = this.props;
    return {
      configFeatures: config.features ? Array.from(config.features) : [],
      organization: organization && organization.features || [],
      project: project && project.features || []
    };
  }

  hasFeature(feature, features) {
    const shouldMatchOnlyProject = feature.match(/^projects:(.+)/);
    const shouldMatchOnlyOrg = feature.match(/^organizations:(.+)/); // Array of feature strings

    const {
      configFeatures,
      organization,
      project
    } = features; // Check config store first as this overrides features scoped to org or
    // project contexts.

    if (configFeatures.includes(feature)) {
      return true;
    }

    if (shouldMatchOnlyProject) {
      return project.includes(shouldMatchOnlyProject[1]);
    }

    if (shouldMatchOnlyOrg) {
      return organization.includes(shouldMatchOnlyOrg[1]);
    } // default, check all feature arrays


    return organization.includes(feature) || project.includes(feature);
  }

  render() {
    const {
      children,
      features,
      renderDisabled,
      hookName,
      organization,
      project,
      requireAll
    } = this.props;
    const allFeatures = this.getAllFeatures();
    const method = requireAll ? 'every' : 'some';
    const hasFeature = !features || features[method](feat => this.hasFeature(feat, allFeatures)); // Default renderDisabled to the ComingSoon component

    let customDisabledRender = renderDisabled === false ? false : typeof renderDisabled === 'function' ? renderDisabled : () => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(_comingSoon__WEBPACK_IMPORTED_MODULE_8__["default"], {}); // Override the renderDisabled function with a hook store function if there
    // is one registered for the feature.

    if (hookName) {
      const hooks = sentry_stores_hookStore__WEBPACK_IMPORTED_MODULE_3__["default"].get(hookName);

      if (hooks.length > 0) {
        customDisabledRender = hooks[0];
      }
    }

    const renderProps = {
      organization,
      project,
      features,
      hasFeature
    };

    if (!hasFeature && customDisabledRender !== false) {
      return customDisabledRender({
        children,
        ...renderProps
      });
    }

    if ((0,sentry_utils_isRenderFunc__WEBPACK_IMPORTED_MODULE_4__.isRenderFunc)(children)) {
      return children({
        renderDisabled,
        ...renderProps
      });
    }

    return hasFeature && children ? children : null;
  }

}

Feature.displayName = "Feature";

(0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(Feature, "defaultProps", {
  renderDisabled: false,
  requireAll: true
});

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_6__["default"])((0,sentry_utils_withProject__WEBPACK_IMPORTED_MODULE_7__["default"])((0,sentry_utils_withConfig__WEBPACK_IMPORTED_MODULE_5__["default"])(Feature))));

/***/ }),

/***/ "./app/components/circleIndicator.tsx":
/*!********************************************!*\
  !*** ./app/components/circleIndicator.tsx ***!
  \********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");

const defaultProps = {
  enabled: true,
  size: 14
};

const getBackgroundColor = p => {
  if (p.color) {
    return `background: ${p.color};`;
  }

  return `background: ${p.enabled ? p.theme.success : p.theme.error};`;
};

const getSize = p => `
  height: ${p.size}px;
  width: ${p.size}px;
`;

const CircleIndicator = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e13rus8i0"
} : 0)("display:inline-block;position:relative;border-radius:50%;", getSize, ";", getBackgroundColor, ";" + ( true ? "" : 0));

CircleIndicator.defaultProps = defaultProps;
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (CircleIndicator);

/***/ }),

/***/ "./app/components/dropdownMenuControl.tsx":
/*!************************************************!*\
  !*** ./app/components/dropdownMenuControl.tsx ***!
  \************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var _react_aria_button__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! @react-aria/button */ "../node_modules/@react-aria/button/dist/module.js");
/* harmony import */ var _react_aria_menu__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! @react-aria/menu */ "../node_modules/@react-aria/menu/dist/module.js");
/* harmony import */ var _react_aria_utils__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! @react-aria/utils */ "../node_modules/@react-aria/utils/dist/module.js");
/* harmony import */ var _react_stately_collections__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! @react-stately/collections */ "../node_modules/@react-stately/collections/dist/module.js");
/* harmony import */ var _react_stately_menu__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! @react-stately/menu */ "../node_modules/@react-stately/menu/dist/module.js");
/* harmony import */ var sentry_components_dropdownButton__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/dropdownButton */ "./app/components/dropdownButton.tsx");
/* harmony import */ var sentry_components_dropdownMenuV2__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/dropdownMenuV2 */ "./app/components/dropdownMenuV2.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");



function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }












/**
 * A menu component that renders both the trigger button and the dropdown
 * menu. See: https://react-spectrum.adobe.com/react-aria/useMenuTrigger.html
 */
function MenuControl(_ref) {
  let {
    items,
    trigger,
    triggerLabel,
    triggerProps = {},
    isDisabled: disabledProp,
    isSubmenu = false,
    closeRootMenu,
    closeCurrentSubmenu,
    renderWrapAs = 'div',
    size = 'md',
    className,
    ...props
  } = _ref;
  const ref = (0,react__WEBPACK_IMPORTED_MODULE_2__.useRef)(null);
  const isDisabled = disabledProp !== null && disabledProp !== void 0 ? disabledProp : !items || items.length === 0; // Control the menu open state. See:
  // https://react-spectrum.adobe.com/react-aria/useMenuTrigger.html

  const state = (0,_react_stately_menu__WEBPACK_IMPORTED_MODULE_5__.useMenuTriggerState)(props);
  const {
    menuTriggerProps,
    menuProps
  } = (0,_react_aria_menu__WEBPACK_IMPORTED_MODULE_6__.useMenuTrigger)({
    type: 'menu',
    isDisabled
  }, state, ref);
  const {
    buttonProps
  } = (0,_react_aria_button__WEBPACK_IMPORTED_MODULE_7__.useButton)({
    isDisabled,
    ...menuTriggerProps,
    ...(isSubmenu && {
      onKeyUp: e => e.continuePropagation(),
      onKeyDown: e => e.continuePropagation(),
      onPress: () => null,
      onPressStart: () => null,
      onPressEnd: () => null
    })
  }, ref); // Calculate the current trigger element's width. This will be used as
  // the min width for the menu.

  const [triggerWidth, setTriggerWidth] = (0,react__WEBPACK_IMPORTED_MODULE_2__.useState)(); // Update triggerWidth when its size changes using useResizeObserver

  const updateTriggerWidth = (0,react__WEBPACK_IMPORTED_MODULE_2__.useCallback)(async () => {
    var _ref$current;

    // Wait until the trigger element finishes rendering, otherwise
    // ResizeObserver might throw an infinite loop error.
    await new Promise(resolve => window.setTimeout(resolve));
    const newTriggerWidth = (_ref$current = ref.current) === null || _ref$current === void 0 ? void 0 : _ref$current.offsetWidth;
    !isSubmenu && newTriggerWidth && setTriggerWidth(newTriggerWidth);
  }, [isSubmenu]);
  (0,_react_aria_utils__WEBPACK_IMPORTED_MODULE_8__.useResizeObserver)({
    ref,
    onResize: updateTriggerWidth
  }); // If ResizeObserver is not available, manually update the width
  // when any of [trigger, triggerLabel, triggerProps] changes.

  (0,react__WEBPACK_IMPORTED_MODULE_2__.useEffect)(() => {
    if (typeof window.ResizeObserver !== 'undefined') {
      return;
    }

    updateTriggerWidth();
  }, [updateTriggerWidth]); // Recursively remove hidden items, including those nested in submenus

  function removeHiddenItems(source) {
    return source.filter(item => !item.hidden).map(item => ({ ...item,
      ...(item.children ? {
        children: removeHiddenItems(item.children)
      } : {})
    }));
  }

  function renderTrigger() {
    if (trigger) {
      return trigger({
        props: {
          size,
          isOpen: state.isOpen,
          ...triggerProps,
          ...buttonProps
        },
        ref
      });
    }

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(sentry_components_dropdownButton__WEBPACK_IMPORTED_MODULE_3__["default"], {
      ref: ref,
      size: size,
      isOpen: state.isOpen,
      ...triggerProps,
      ...buttonProps,
      children: triggerLabel
    });
  }

  function renderMenu() {
    if (!state.isOpen) {
      return null;
    }

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(sentry_components_dropdownMenuV2__WEBPACK_IMPORTED_MODULE_4__["default"], { ...props,
      ...menuProps,
      triggerRef: ref,
      triggerWidth: triggerWidth,
      size: size,
      isSubmenu: isSubmenu,
      isDismissable: !isSubmenu && props.isDismissable,
      shouldCloseOnBlur: !isSubmenu && props.shouldCloseOnBlur,
      closeRootMenu: closeRootMenu !== null && closeRootMenu !== void 0 ? closeRootMenu : state.close,
      closeCurrentSubmenu: closeCurrentSubmenu,
      items: removeHiddenItems(items),
      children: item => {
        if (item.children && item.children.length > 0 && !item.isSubmenu) {
          return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(_react_stately_collections__WEBPACK_IMPORTED_MODULE_10__.Section, {
            title: item.label,
            items: item.children,
            children: sectionItem => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(_react_stately_collections__WEBPACK_IMPORTED_MODULE_10__.Item, {
              size: size,
              ...sectionItem,
              children: sectionItem.label
            })
          }, item.key);
        }

        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(_react_stately_collections__WEBPACK_IMPORTED_MODULE_10__.Item, {
          size: size,
          ...item,
          children: item.label
        });
      }
    });
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsxs)(MenuControlWrap, {
    className: className,
    as: renderWrapAs,
    role: "presentation",
    children: [renderTrigger(), renderMenu()]
  });
}

MenuControl.displayName = "MenuControl";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (MenuControl);

const MenuControlWrap = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1xefvzy0"
} : 0)( true ? {
  name: "ffhm6p",
  styles: "list-style-type:none"
} : 0);

/***/ }),

/***/ "./app/components/dropdownMenuItem.tsx":
/*!*********************************************!*\
  !*** ./app/components/dropdownMenuItem.tsx ***!
  \*********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var _react_aria_interactions__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! @react-aria/interactions */ "../node_modules/@react-aria/interactions/dist/module.js");
/* harmony import */ var _react_aria_menu__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! @react-aria/menu */ "../node_modules/@react-aria/menu/dist/module.js");
/* harmony import */ var _react_aria_utils__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! @react-aria/utils */ "../node_modules/@react-aria/utils/dist/module.js");
/* harmony import */ var sentry_components_links_link__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/links/link */ "./app/components/links/link.tsx");
/* harmony import */ var sentry_components_menuListItem__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/menuListItem */ "./app/components/menuListItem.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_utils_usePrevious__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/utils/usePrevious */ "./app/utils/usePrevious.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");












/**
 * A menu item with a label, optional details, leading and trailing elements.
 * Can also be used as a trigger button for a submenu. See:
 * https://react-spectrum.adobe.com/react-aria/useMenu.html
 */
const MenuItem = _ref => {
  var _node$rendered;

  let {
    node,
    isLastNode,
    state,
    onClose,
    closeOnSelect,
    isSubmenuTrigger = false,
    submenuTriggerRef,
    renderAs = 'li',
    ...submenuTriggerProps
  } = _ref;
  const ourRef = (0,react__WEBPACK_IMPORTED_MODULE_1__.useRef)(null);
  const isDisabled = state.disabledKeys.has(node.key);
  const isFocused = state.selectionManager.focusedKey === node.key;
  const {
    key,
    onAction,
    to,
    label,
    showDividers,
    ...itemProps
  } = node.value;
  const {
    size
  } = node.props;
  const ref = submenuTriggerRef !== null && submenuTriggerRef !== void 0 ? submenuTriggerRef : ourRef;

  const actionHandler = () => {
    if (to) {
      return;
    }

    if (isSubmenuTrigger) {
      state.selectionManager.select(node.key);
      return;
    }

    onAction === null || onAction === void 0 ? void 0 : onAction(key);
  }; // Open submenu on hover


  const [isHovering, setIsHovering] = (0,react__WEBPACK_IMPORTED_MODULE_1__.useState)(false);
  const {
    hoverProps
  } = (0,_react_aria_interactions__WEBPACK_IMPORTED_MODULE_6__.useHover)({
    onHoverChange: setIsHovering
  });
  const prevIsHovering = (0,sentry_utils_usePrevious__WEBPACK_IMPORTED_MODULE_5__["default"])(isHovering);
  const prevIsFocused = (0,sentry_utils_usePrevious__WEBPACK_IMPORTED_MODULE_5__["default"])(isFocused);
  (0,react__WEBPACK_IMPORTED_MODULE_1__.useEffect)(() => {
    if (isHovering === prevIsHovering && isFocused === prevIsFocused) {
      return;
    }

    if (isHovering && isFocused) {
      if (isSubmenuTrigger) {
        state.selectionManager.select(node.key);
        return;
      }

      state.selectionManager.clearSelection();
    }
  }, [isHovering, isFocused, prevIsHovering, prevIsFocused, isSubmenuTrigger, node.key, state.selectionManager]); // Open submenu on arrow right key press

  const {
    keyboardProps
  } = (0,_react_aria_interactions__WEBPACK_IMPORTED_MODULE_6__.useKeyboard)({
    onKeyDown: e => {
      if (e.key === 'Enter' && to) {
        var _ref$current, _ref$current$querySel;

        const mouseEvent = new MouseEvent('click', {
          ctrlKey: e.ctrlKey,
          metaKey: e.metaKey
        });
        (_ref$current = ref.current) === null || _ref$current === void 0 ? void 0 : (_ref$current$querySel = _ref$current.querySelector(`${sentry_components_menuListItem__WEBPACK_IMPORTED_MODULE_3__.InnerWrap}`)) === null || _ref$current$querySel === void 0 ? void 0 : _ref$current$querySel.dispatchEvent(mouseEvent);
        onClose();
        return;
      }

      if (e.key === 'ArrowRight' && isSubmenuTrigger) {
        state.selectionManager.select(node.key);
        return;
      }

      e.continuePropagation();
    }
  }); // Manage interactive events & create aria attributes

  const {
    menuItemProps,
    labelProps,
    descriptionProps
  } = (0,_react_aria_menu__WEBPACK_IMPORTED_MODULE_7__.useMenuItem)({
    key: node.key,
    onAction: actionHandler,
    closeOnSelect: to ? false : closeOnSelect,
    onClose,
    isDisabled
  }, state, ref); // Merged menu item props, class names are combined, event handlers chained,
  // etc. See: https://react-spectrum.adobe.com/react-aria/mergeProps.html

  const props = (0,_react_aria_utils__WEBPACK_IMPORTED_MODULE_8__.mergeProps)(submenuTriggerProps, menuItemProps, hoverProps, keyboardProps);
  const itemLabel = (_node$rendered = node.rendered) !== null && _node$rendered !== void 0 ? _node$rendered : label;
  const showDivider = showDividers && !isLastNode;
  const innerWrapProps = {
    as: to ? sentry_components_links_link__WEBPACK_IMPORTED_MODULE_2__["default"] : 'div',
    to
  };
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(sentry_components_menuListItem__WEBPACK_IMPORTED_MODULE_3__["default"], {
    ref: ref,
    as: renderAs,
    "data-test-id": key,
    label: itemLabel,
    disabled: isDisabled,
    isFocused: isFocused,
    showDivider: showDivider,
    innerWrapProps: innerWrapProps,
    labelProps: labelProps,
    detailsProps: descriptionProps,
    size: size,
    ...props,
    ...itemProps,
    ...(isSubmenuTrigger && {
      role: 'menuitemradio',
      trailingItems: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsxs)(react__WEBPACK_IMPORTED_MODULE_1__.Fragment, {
        children: [itemProps.trailingItems, (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_4__.IconChevron, {
          size: "xs",
          direction: "right",
          "aria-hidden": "true"
        })]
      })
    })
  });
};

MenuItem.displayName = "MenuItem";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (MenuItem);

/***/ }),

/***/ "./app/components/dropdownMenuSection.tsx":
/*!************************************************!*\
  !*** ./app/components/dropdownMenuSection.tsx ***!
  \************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var _react_aria_menu__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @react-aria/menu */ "../node_modules/@react-aria/menu/dist/module.js");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }






/**
 * A wrapper component for menu sections. See:
 * https://react-spectrum.adobe.com/react-aria/useMenu.html
 */
function MenuSection(_ref) {
  let {
    node,
    children
  } = _ref;
  const {
    itemProps,
    headingProps,
    groupProps
  } = (0,_react_aria_menu__WEBPACK_IMPORTED_MODULE_2__.useMenuSection)({
    heading: node.rendered,
    'aria-label': node['aria-label']
  });
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsxs)(MenuSectionWrap, { ...itemProps,
    children: [node.rendered && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(Heading, { ...headingProps,
      children: node.rendered
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(Group, { ...groupProps,
      children: children
    })]
  });
}

MenuSection.displayName = "MenuSection";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (MenuSection);

const MenuSectionWrap = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('li',  true ? {
  target: "enwb5272"
} : 0)( true ? {
  name: "ffhm6p",
  styles: "list-style-type:none"
} : 0);

const Heading = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('span',  true ? {
  target: "enwb5271"
} : 0)("display:inline-block;font-weight:600;font-size:", p => p.theme.fontSizeSmall, ";color:", p => p.theme.subText, ";text-transform:uppercase;white-space:nowrap;margin:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_1__["default"])(1), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_1__["default"])(1.5), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_1__["default"])(0.5), ";padding-right:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_1__["default"])(1), ";",
/* sc-selector */
MenuSectionWrap, ":first-of-type &{margin-top:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_1__["default"])(0.5), ";}" + ( true ? "" : 0));

const Group = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('ul',  true ? {
  target: "enwb5270"
} : 0)( true ? {
  name: "1kz5jpr",
  styles: "list-style-type:none;padding:0;margin:0"
} : 0);

/***/ }),

/***/ "./app/components/dropdownMenuV2.tsx":
/*!*******************************************!*\
  !*** ./app/components/dropdownMenuV2.tsx ***!
  \*******************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var _react_aria_focus__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! @react-aria/focus */ "../node_modules/@react-aria/focus/dist/module.js");
/* harmony import */ var _react_aria_interactions__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! @react-aria/interactions */ "../node_modules/@react-aria/interactions/dist/module.js");
/* harmony import */ var _react_aria_menu__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! @react-aria/menu */ "../node_modules/@react-aria/menu/dist/module.js");
/* harmony import */ var _react_aria_overlays__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! @react-aria/overlays */ "../node_modules/@react-aria/overlays/dist/module.js");
/* harmony import */ var _react_aria_separator__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! @react-aria/separator */ "../node_modules/@react-aria/separator/dist/module.js");
/* harmony import */ var _react_aria_utils__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! @react-aria/utils */ "../node_modules/@react-aria/utils/dist/module.js");
/* harmony import */ var _react_stately_tree__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! @react-stately/tree */ "../node_modules/@react-stately/tree/dist/module.js");
/* harmony import */ var sentry_components_dropdownMenuControl__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/dropdownMenuControl */ "./app/components/dropdownMenuControl.tsx");
/* harmony import */ var sentry_components_dropdownMenuItem__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/dropdownMenuItem */ "./app/components/dropdownMenuItem.tsx");
/* harmony import */ var sentry_components_dropdownMenuSection__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/dropdownMenuSection */ "./app/components/dropdownMenuSection.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");

















function Menu(_ref) {
  var _document$querySelect, _positionProps$style;

  let {
    offset = 8,
    crossOffset = 0,
    containerPadding = 0,
    placement = 'bottom left',
    closeOnSelect = true,
    triggerRef,
    triggerWidth,
    size,
    isSubmenu,
    menuTitle,
    closeRootMenu,
    closeCurrentSubmenu,
    isDismissable = true,
    shouldCloseOnBlur = true,
    ...props
  } = _ref;
  const state = (0,_react_stately_tree__WEBPACK_IMPORTED_MODULE_7__.useTreeState)({ ...props,
    selectionMode: 'single'
  });
  const stateCollection = (0,react__WEBPACK_IMPORTED_MODULE_2__.useMemo)(() => [...state.collection], [state.collection]); // Implement focus states, keyboard navigation, aria-label,...

  const menuRef = (0,react__WEBPACK_IMPORTED_MODULE_2__.useRef)(null);
  const {
    menuProps
  } = (0,_react_aria_menu__WEBPACK_IMPORTED_MODULE_8__.useMenu)({ ...props,
    selectionMode: 'single'
  }, state, menuRef);
  const {
    separatorProps
  } = (0,_react_aria_separator__WEBPACK_IMPORTED_MODULE_9__.useSeparator)({
    elementType: 'li'
  }); // If this is a submenu, pressing arrow left should close it (but not the
  // root menu).

  const {
    keyboardProps
  } = (0,_react_aria_interactions__WEBPACK_IMPORTED_MODULE_10__.useKeyboard)({
    onKeyDown: e => {
      if (isSubmenu && e.key === 'ArrowLeft') {
        closeCurrentSubmenu === null || closeCurrentSubmenu === void 0 ? void 0 : closeCurrentSubmenu();
        return;
      }

      e.continuePropagation();
    }
  }); // Close the menu on outside interaction, blur, or Esc key press, and
  // control its position relative to the trigger button. See:
  // https://react-spectrum.adobe.com/react-aria/useOverlay.html
  // https://react-spectrum.adobe.com/react-aria/useOverlayPosition.html

  const overlayRef = (0,react__WEBPACK_IMPORTED_MODULE_2__.useRef)(null);
  const {
    overlayProps
  } = (0,_react_aria_overlays__WEBPACK_IMPORTED_MODULE_11__.useOverlay)({
    onClose: closeRootMenu,
    shouldCloseOnBlur,
    isDismissable,
    isOpen: true,
    shouldCloseOnInteractOutside: target => {
      var _triggerRef$current;

      return target && triggerRef.current !== target && !((_triggerRef$current = triggerRef.current) !== null && _triggerRef$current !== void 0 && _triggerRef$current.contains(target));
    }
  }, overlayRef);
  const {
    overlayProps: positionProps,
    placement: placementProp
  } = (0,_react_aria_overlays__WEBPACK_IMPORTED_MODULE_11__.useOverlayPosition)({
    targetRef: triggerRef,
    overlayRef,
    offset,
    crossOffset,
    placement,
    containerPadding,
    isOpen: true,
    // useOverlayPosition's algorithm doesn't work well for submenus on viewport
    // scroll. Changing the boundary element (document.body by default) seems to
    // fix this.
    boundaryElement: (_document$querySelect = document.querySelector('.app')) !== null && _document$querySelect !== void 0 ? _document$querySelect : undefined
  }); // Store whether this menu/submenu is the current focused one, which in a
  // nested, tree-like menu system should be the leaf submenu. This
  // information is used for controlling keyboard events. See:
  // modifiedMenuProps below.

  const [hasFocus, setHasFocus] = (0,react__WEBPACK_IMPORTED_MODULE_2__.useState)(true);
  (0,react__WEBPACK_IMPORTED_MODULE_2__.useEffect)(() => {
    // A submenu is a leaf when it does not contain any expanded submenu. This
    // logically follows from the tree-like structure and single-selection
    // nature of menus.
    const isLeafSubmenu = !stateCollection.some(node => {
      const isSection = node.hasChildNodes && !node.value.isSubmenu; // A submenu with key [key] is expanded if
      // state.selectionManager.isSelected([key]) = true

      return isSection ? [...node.childNodes].some(child => state.selectionManager.isSelected(`${child.key}`)) : state.selectionManager.isSelected(`${node.key}`);
    });
    setHasFocus(isLeafSubmenu);
  }, [stateCollection, state.selectionManager]); // Menu props from useMenu, modified to disable keyboard events if the
  // current menu does not have focus.

  const modifiedMenuProps = { ...menuProps,
    ...(!hasFocus && {
      onKeyUp: () => null,
      onKeyDown: () => null
    })
  }; // Render a single menu item

  const renderItem = (node, isLastNode) => {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(sentry_components_dropdownMenuItem__WEBPACK_IMPORTED_MODULE_4__["default"], {
      node: node,
      isLastNode: isLastNode,
      state: state,
      onClose: closeRootMenu,
      closeOnSelect: closeOnSelect
    });
  }; // Render a submenu whose trigger button is a menu item


  const renderItemWithSubmenu = (node, isLastNode) => {
    const trigger = _ref2 => {
      let {
        props: submenuTriggerProps,
        ref: submenuTriggerRef
      } = _ref2;
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(sentry_components_dropdownMenuItem__WEBPACK_IMPORTED_MODULE_4__["default"], {
        renderAs: "div",
        node: node,
        isLastNode: isLastNode,
        state: state,
        isSubmenuTrigger: true,
        submenuTriggerRef: submenuTriggerRef,
        ...submenuTriggerProps
      });
    };

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(sentry_components_dropdownMenuControl__WEBPACK_IMPORTED_MODULE_3__["default"], {
      items: node.value.children,
      trigger: trigger,
      menuTitle: node.value.submenuTitle,
      placement: "right top",
      offset: -4,
      crossOffset: -8,
      closeOnSelect: closeOnSelect,
      isOpen: state.selectionManager.isSelected(node.key),
      size: size,
      isSubmenu: true,
      closeRootMenu: closeRootMenu,
      closeCurrentSubmenu: () => state.selectionManager.clearSelection(),
      renderWrapAs: "li"
    });
  }; // Render a collection of menu items


  const renderCollection = collection => collection.map((node, i) => {
    var _collection;

    const isLastNode = collection.length - 1 === i;
    const showSeparator = !isLastNode && (node.type === 'section' || ((_collection = collection[i + 1]) === null || _collection === void 0 ? void 0 : _collection.type) === 'section');
    let itemToRender;

    if (node.type === 'section') {
      itemToRender = (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(sentry_components_dropdownMenuSection__WEBPACK_IMPORTED_MODULE_5__["default"], {
        node: node,
        children: renderCollection([...node.childNodes])
      });
    } else {
      itemToRender = node.value.isSubmenu ? renderItemWithSubmenu(node, isLastNode) : renderItem(node, isLastNode);
    }

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsxs)(react__WEBPACK_IMPORTED_MODULE_2__.Fragment, {
      children: [itemToRender, showSeparator && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(Separator, { ...separatorProps
      })]
    }, node.key);
  });

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(_react_aria_focus__WEBPACK_IMPORTED_MODULE_13__.FocusScope, {
    restoreFocus: true,
    autoFocus: true,
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(Overlay, {
      ref: overlayRef,
      placementProp: placementProp,
      ...(0,_react_aria_utils__WEBPACK_IMPORTED_MODULE_14__.mergeProps)(overlayProps, positionProps, keyboardProps),
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsxs)(MenuWrap, {
        ref: menuRef,
        ...modifiedMenuProps,
        style: {
          maxHeight: (_positionProps$style = positionProps.style) === null || _positionProps$style === void 0 ? void 0 : _positionProps$style.maxHeight,
          minWidth: triggerWidth
        },
        children: [menuTitle && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(MenuTitle, {
          children: menuTitle
        }), renderCollection(stateCollection)]
      })
    })
  });
}

Menu.displayName = "Menu";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (Menu);

const Overlay = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1747fp53"
} : 0)("max-width:24rem;border-radius:", p => p.theme.borderRadius, ";background:", p => p.theme.backgroundElevated, ";box-shadow:0 0 0 1px ", p => p.theme.translucentBorder, ",", p => p.theme.dropShadowHeavy, ";font-size:", p => p.theme.fontSizeMedium, ";margin:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_6__["default"])(1), " 0;", p => p.placementProp === 'top' && `margin-bottom: 0;`, " ", p => p.placementProp === 'bottom' && `margin-top: 0;`, "z-index:", p => p.theme.zIndex.dropdown, "!important;" + ( true ? "" : 0));

const MenuWrap = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('ul',  true ? {
  target: "e1747fp52"
} : 0)("margin:0;padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_6__["default"])(0.5), " 0;font-size:", p => p.theme.fontSizeMedium, ";overflow-x:hidden;overflow-y:auto;&:focus{outline:none;}" + ( true ? "" : 0));

const MenuTitle = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1747fp51"
} : 0)("font-weight:600;font-size:", p => p.theme.fontSizeSmall, ";color:", p => p.theme.headingColor, ";white-space:nowrap;padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_6__["default"])(0.25), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_6__["default"])(1.5), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_6__["default"])(0.75), ";margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_6__["default"])(0.5), ";border-bottom:solid 1px ", p => p.theme.innerBorder, ";" + ( true ? "" : 0));

const Separator = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('li',  true ? {
  target: "e1747fp50"
} : 0)("list-style-type:none;border-top:solid 1px ", p => p.theme.innerBorder, ";margin:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_6__["default"])(0.5), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_6__["default"])(1.5), ";" + ( true ? "" : 0));

/***/ }),

/***/ "./app/components/featureBadge.tsx":
/*!*****************************************!*\
  !*** ./app/components/featureBadge.tsx ***!
  \*****************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/es.error.cause.js */ "../node_modules/core-js/modules/es.error.cause.js");
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var _emotion_react__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! @emotion/react */ "../node_modules/@emotion/react/dist/emotion-element-cbed451f.browser.esm.js");
/* harmony import */ var _sentry_react__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! @sentry/react */ "../node_modules/@sentry/hub/esm/exports.js");
/* harmony import */ var sentry_components_circleIndicator__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/circleIndicator */ "./app/components/circleIndicator.tsx");
/* harmony import */ var sentry_components_tagDeprecated__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/tagDeprecated */ "./app/components/tagDeprecated.tsx");
/* harmony import */ var sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/tooltip */ "./app/components/tooltip.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");












const defaultTitles = {
  alpha: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('This feature is internal and available for QA purposes'),
  beta: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('This feature is available for early adopters and may change'),
  new: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('This feature is new! Try it out and let us know what you think')
};
const labels = {
  alpha: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('alpha'),
  beta: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('beta'),
  new: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('new')
};

function BaseFeatureBadge(_ref) {
  let {
    type,
    variant = 'badge',
    title,
    noTooltip,
    expiresAt,
    ...props
  } = _ref;
  const theme = (0,_emotion_react__WEBPACK_IMPORTED_MODULE_8__.a)();

  if (expiresAt && expiresAt.valueOf() < Date.now()) {
    // Only get 1% of events as we don't need many to know that a badge needs to be cleaned up.
    if (Math.random() < 0.01) {
      (0,_sentry_react__WEBPACK_IMPORTED_MODULE_9__.withScope)(scope => {
        scope.setTag('title', title);
        scope.setTag('type', type);
        scope.setLevel('warning');
        (0,_sentry_react__WEBPACK_IMPORTED_MODULE_9__.captureException)(new Error('Expired Feature Badge'));
      });
    }

    return null;
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)("div", { ...props,
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_5__["default"], {
      title: title !== null && title !== void 0 ? title : defaultTitles[type],
      disabled: noTooltip,
      position: "right",
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsxs)(react__WEBPACK_IMPORTED_MODULE_2__.Fragment, {
        children: [variant === 'badge' && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(StyledTag, {
          priority: type,
          children: labels[type]
        }), variant === 'indicator' && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(sentry_components_circleIndicator__WEBPACK_IMPORTED_MODULE_3__["default"], {
          color: theme.badge[type].indicatorColor,
          size: 8
        })]
      })
    })
  });
}

BaseFeatureBadge.displayName = "BaseFeatureBadge";

const StyledTag = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_tagDeprecated__WEBPACK_IMPORTED_MODULE_4__["default"],  true ? {
  target: "e1g6bd531"
} : 0)("padding:3px ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_7__["default"])(0.75), ";" + ( true ? "" : 0));

const FeatureBadge = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(BaseFeatureBadge,  true ? {
  target: "e1g6bd530"
} : 0)("display:inline-flex;align-items:center;margin-left:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_7__["default"])(0.75), ";position:relative;top:-1px;" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (FeatureBadge);

/***/ }),

/***/ "./app/components/tagDeprecated.tsx":
/*!******************************************!*\
  !*** ./app/components/tagDeprecated.tsx ***!
  \******************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");






/**
 * Get priority from alerts or badge styles
 */
const getPriority = p => {
  if (p.priority) {
    var _ref, _p$theme$alert$p$prio;

    return (_ref = (_p$theme$alert$p$prio = p.theme.alert[p.priority]) !== null && _p$theme$alert$p$prio !== void 0 ? _p$theme$alert$p$prio : p.theme.badge[p.priority]) !== null && _ref !== void 0 ? _ref : null;
  }

  return null;
};

const getMarginLeft = p => p.inline ? `margin-left: ${p.size === 'small' ? '0.25em' : '0.5em'};` : '';

const getBorder = p => {
  var _getPriority$border, _getPriority;

  return p.border ? `border: 1px solid ${(_getPriority$border = (_getPriority = getPriority(p)) === null || _getPriority === void 0 ? void 0 : _getPriority.border) !== null && _getPriority$border !== void 0 ? _getPriority$border : p.theme.border};` : '';
};

const Tag = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(_ref2 => {
  let {
    children,
    icon,
    inline: _inline,
    priority: _priority,
    size: _size,
    border: _border,
    ...props
  } = _ref2;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsxs)("div", { ...props,
    children: [icon && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(IconWrapper, {
      children: /*#__PURE__*/(0,react__WEBPACK_IMPORTED_MODULE_1__.isValidElement)(icon) && /*#__PURE__*/(0,react__WEBPACK_IMPORTED_MODULE_1__.cloneElement)(icon, {
        size: 'xs'
      })
    }), children]
  });
},  true ? {
  target: "ewer3pn1"
} : 0)("display:inline-flex;box-sizing:border-box;padding:", p => p.size === 'small' ? '0.1em 0.4em 0.2em' : '0.35em 0.8em 0.4em', ";font-size:", p => p.theme.fontSizeExtraSmall, ";line-height:1;color:", p => p.priority ? p.theme.background : p.theme.textColor, ";text-align:center;white-space:nowrap;vertical-align:middle;align-items:center;border-radius:", p => p.size === 'small' ? '0.25em' : '2em', ";text-transform:lowercase;font-weight:", p => p.size === 'small' ? 'bold' : 'normal', ";background:", p => {
  var _getPriority$backgrou, _getPriority2;

  return (_getPriority$backgrou = (_getPriority2 = getPriority(p)) === null || _getPriority2 === void 0 ? void 0 : _getPriority2.background) !== null && _getPriority$backgrou !== void 0 ? _getPriority$backgrou : p.theme.gray100;
}, ";", p => getBorder(p), ";", p => getMarginLeft(p), ";" + ( true ? "" : 0));

const IconWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('span',  true ? {
  target: "ewer3pn0"
} : 0)("margin-right:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_2__["default"])(0.5), ";" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (Tag);

/***/ }),

/***/ "./app/utils/usePrevious.tsx":
/*!***********************************!*\
  !*** ./app/utils/usePrevious.tsx ***!
  \***********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");

/**
 * Provides previous prop or state inside of function components.
 * It’s possible that in the future React will provide a usePrevious Hook out of the box since it’s a relatively common use case.
 * @see {@link https://reactjs.org/docs/hooks-faq.html#how-to-get-the-previous-props-or-state}
 *
 * @returns 'ref.current' and therefore should not be used as a dependency of useEffect.
 * Mutable values like 'ref.current' are not valid dependencies of useEffect because changing them does not re-render the component.
 */

function usePrevious(value) {
  // The ref object is a generic container whose current property is mutable ...
  // ... and can hold any value, similar to an instance property on a class
  const ref = (0,react__WEBPACK_IMPORTED_MODULE_0__.useRef)(value); // Store current value in ref

  (0,react__WEBPACK_IMPORTED_MODULE_0__.useEffect)(() => {
    ref.current = value;
  }, [value]); // Only re-run if value changes
  // Return previous value (happens before update in useEffect above)

  return ref.current;
}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (usePrevious);

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_actionCreators_members_tsx-app_components_acl_feature_tsx-app_components_dropdownMenuCont-79946c.5d848eba702cfec0da5f3d2ec820604c.js.map