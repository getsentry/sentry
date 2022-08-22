"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_views_organizationGroupDetails_groupTagValues_tsx"],{

/***/ "./app/components/dataExport.tsx":
/*!***************************************!*\
  !*** ./app/components/dataExport.tsx ***!
  \***************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "DataExport": () => (/* binding */ DataExport),
/* harmony export */   "ExportQueryType": () => (/* binding */ ExportQueryType),
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var lodash_debounce__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! lodash/debounce */ "../node_modules/lodash/debounce.js");
/* harmony import */ var lodash_debounce__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(lodash_debounce__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/actionCreators/indicator */ "./app/actionCreators/indicator.tsx");
/* harmony import */ var sentry_components_acl_feature__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/acl/feature */ "./app/components/acl/feature.tsx");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/utils/withApi */ "./app/utils/withApi.tsx");
/* harmony import */ var sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/utils/withOrganization */ "./app/utils/withOrganization.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");








 // NOTE: Coordinate with other ExportQueryType (src/sentry/data_export/base.py)


let ExportQueryType;

(function (ExportQueryType) {
  ExportQueryType["IssuesByTag"] = "Issues-by-Tag";
  ExportQueryType["Discover"] = "Discover";
})(ExportQueryType || (ExportQueryType = {}));

function DataExport(_ref) {
  let {
    api,
    children,
    disabled,
    organization,
    payload,
    icon
  } = _ref;
  const unmountedRef = (0,react__WEBPACK_IMPORTED_MODULE_1__.useRef)(false);
  const [inProgress, setInProgress] = (0,react__WEBPACK_IMPORTED_MODULE_1__.useState)(false); // We clear the indicator if export props change so that the user
  // can fire another export without having to wait for the previous one to finish.

  (0,react__WEBPACK_IMPORTED_MODULE_1__.useEffect)(() => {
    if (inProgress) {
      setInProgress(false);
    } // We are skipping the inProgress dependency because it would have fired on each handleDataExport
    // call and would have immediately turned off the value giving users no feedback on their click action.
    // An alternative way to handle this would have probably been to key the component by payload/queryType,
    // but that seems like it can be a complex object so tracking changes could result in very brittle behavior.
    // eslint-disable-next-line react-hooks/exhaustive-deps

  }, [payload.queryType, payload.queryInfo]); // Tracking unmounting of the component to prevent setState call on unmounted component

  (0,react__WEBPACK_IMPORTED_MODULE_1__.useEffect)(() => {
    return () => {
      unmountedRef.current = true;
    };
  }, []);
  const handleDataExport = (0,react__WEBPACK_IMPORTED_MODULE_1__.useCallback)(() => {
    setInProgress(true); // This is a fire and forget request.

    api.requestPromise(`/organizations/${organization.slug}/data-export/`, {
      includeAllArgs: true,
      method: 'POST',
      data: {
        query_type: payload.queryType,
        query_info: payload.queryInfo
      }
    }).then(_ref2 => {
      let [_data, _, response] = _ref2;

      // If component has unmounted, don't do anything
      if (unmountedRef.current) {
        return;
      }

      (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_3__.addSuccessMessage)((response === null || response === void 0 ? void 0 : response.status) === 201 ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)("Sit tight. We'll shoot you an email when your data is ready for download.") : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)("It looks like we're already working on it. Sit tight, we'll email you."));
    }).catch(err => {
      var _err$responseJSON$det, _err$responseJSON;

      // If component has unmounted, don't do anything
      if (unmountedRef.current) {
        return;
      }

      const message = (_err$responseJSON$det = err === null || err === void 0 ? void 0 : (_err$responseJSON = err.responseJSON) === null || _err$responseJSON === void 0 ? void 0 : _err$responseJSON.detail) !== null && _err$responseJSON$det !== void 0 ? _err$responseJSON$det : "We tried our hardest, but we couldn't export your data. Give it another go.";
      (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_3__.addErrorMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)(message));
      setInProgress(false);
    });
  }, [payload.queryInfo, payload.queryType, organization.slug, api]);
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(sentry_components_acl_feature__WEBPACK_IMPORTED_MODULE_4__["default"], {
    features: ['organizations:discover-query'],
    children: inProgress ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_5__["default"], {
      size: "sm",
      priority: "default",
      title: "You can get on with your life. We'll email you when your data's ready.",
      disabled: true,
      icon: icon,
      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)("We're working on it...")
    }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_5__["default"], {
      onClick: lodash_debounce__WEBPACK_IMPORTED_MODULE_2___default()(handleDataExport, 500),
      disabled: disabled || false,
      size: "sm",
      priority: "default",
      title: "Put your data to work. Start your export and we'll email you when it's finished.",
      icon: icon,
      children: children ? children : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Export All to CSV')
    })
  });
}

DataExport.displayName = "DataExport";

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_7__["default"])((0,sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_8__["default"])(DataExport)));

/***/ }),

/***/ "./app/components/deviceName.tsx":
/*!***************************************!*\
  !*** ./app/components/deviceName.tsx ***!
  \***************************************/
/***/ ((module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "DeviceName": () => (/* binding */ DeviceName),
/* harmony export */   "deviceNameMapper": () => (/* binding */ deviceNameMapper)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_constants_ios_device_list__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/constants/ios-device-list */ "./app/constants/ios-device-list.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");
/* module decorator */ module = __webpack_require__.hmd(module);




function deviceNameMapper(model) {
  // If we have no model, render nothing
  if (typeof model !== 'string') {
    return null;
  } // If module has not loaded yet, render the unparsed model


  if (module === null) {
    return model;
  }

  const [identifier, ...rest] = model.split(' ');
  const modelName = sentry_constants_ios_device_list__WEBPACK_IMPORTED_MODULE_2__.iOSDeviceMapping[identifier];
  return modelName === undefined ? model : `${modelName} ${rest.join(' ')}`;
}

/**
 * This is used to map iOS Device Names to model name.
 * This asynchronously loads the ios-device-list library because of its size
 */
function DeviceName(_ref) {
  let {
    value,
    children
  } = _ref;
  const deviceName = (0,react__WEBPACK_IMPORTED_MODULE_1__.useMemo)(() => deviceNameMapper(value), [value]);
  return deviceName ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)("span", {
    "data-test-id": "loaded-device-name",
    children: children ? children(deviceName) : deviceName
  }) : null;
}



/***/ }),

/***/ "./app/constants/ios-device-list.tsx":
/*!*******************************************!*\
  !*** ./app/constants/ios-device-list.tsx ***!
  \*******************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "iOSDeviceMapping": () => (/* binding */ iOSDeviceMapping)
/* harmony export */ });
// THIS IS AN AUTOGENERATED FILE. DO NOT EDIT THIS FILE DIRECTLY.
// generated using scripts/extract-ios-device-names.ts as part of build step.
// the purpose of the script is to extract only the iOS information that Sentry cares about
// and discard the rest of the JSON so we do not end up bloating bundle size.
const iOSDeviceMapping = {
  'iPod1,1': 'iPod touch',
  'iPod2,1': 'iPod touch (2nd generation)',
  'iPod3,1': 'iPod touch (3rd generation)',
  'iPod4,1': 'iPod touch (4th generation)',
  'iPod5,1': 'iPod touch (5th generation)',
  'iPod7,1': 'iPod touch (6th generation)',
  'iPod9,1': 'iPod touch (7th generation)',
  'iPhone1,1': 'iPhone',
  'iPhone1,2': 'iPhone 3G',
  'iPhone2,1': 'iPhone 3GS',
  'iPhone3,1': 'iPhone 4',
  'iPhone3,2': 'iPhone 4',
  'iPhone3,3': 'iPhone 4',
  'iPhone4,1': 'iPhone 4S',
  'iPhone5,1': 'iPhone 5',
  'iPhone5,2': 'iPhone 5',
  'iPhone5,3': 'iPhone 5c',
  'iPhone5,4': 'iPhone 5c',
  'iPhone6,1': 'iPhone 5s',
  'iPhone6,2': 'iPhone 5s',
  'iPhone8,4': 'iPhone SE (1st generation)',
  'iPhone7,2': 'iPhone 6',
  'iPhone7,1': 'iPhone 6 Plus',
  'iPhone8,1': 'iPhone 6s',
  'iPhone8,2': 'iPhone 6s Plus',
  'iPhone9,1': 'iPhone 7',
  'iPhone9,3': 'iPhone 7',
  'iPhone9,2': 'iPhone 7 Plus',
  'iPhone9,4': 'iPhone 7 Plus',
  'iPhone10,1': 'iPhone 8',
  'iPhone10,4': 'iPhone 8',
  'iPhone10,2': 'iPhone 8 Plus',
  'iPhone10,5': 'iPhone 8 Plus',
  'iPhone10,3': 'iPhone X',
  'iPhone10,6': 'iPhone X',
  'iPhone11,8': 'iPhone XR',
  'iPhone11,2': 'iPhone XS',
  'iPhone11,4': 'iPhone XS Max',
  'iPhone11,6': 'iPhone XS Max',
  'iPhone12,1': 'iPhone 11',
  'iPhone12,3': 'iPhone 11 Pro',
  'iPhone12,5': 'iPhone 11 Pro Max',
  'iPhone12,8': 'iPhone SE (2nd generation)',
  'iPhone13,1': 'iPhone 12 mini',
  'iPhone13,2': 'iPhone 12',
  'iPhone13,3': 'iPhone 12 Pro',
  'iPhone13,4': 'iPhone 12 Pro Max',
  'iPad6,7': 'iPad Pro (12.9-inch)',
  'iPad6,8': 'iPad Pro (12.9-inch)',
  'iPad6,3': 'iPad Pro (9.7-inch)',
  'iPad6,4': 'iPad Pro (9.7-inch)',
  'iPad7,1': 'iPad Pro (12.9-inch, 2nd generation)',
  'iPad7,2': 'iPad Pro (12.9-inch, 2nd generation)',
  'iPad7,3': 'iPad Pro (10.5-inch)',
  'iPad7,4': 'iPad Pro (10.5-inch)',
  'iPad8,1': 'iPad Pro (11-inch)',
  'iPad8,2': 'iPad Pro (11-inch)',
  'iPad8,3': 'iPad Pro (11-inch)',
  'iPad8,4': 'iPad Pro (11-inch)',
  'iPad8,5': 'iPad Pro (12.9-inch) (3rd generation)',
  'iPad8,6': 'iPad Pro (12.9-inch) (3rd generation)',
  'iPad8,7': 'iPad Pro (12.9-inch) (3rd generation)',
  'iPad8,8': 'iPad Pro (12.9-inch) (3rd generation)',
  'iPad8,9': 'iPad Pro (11-inch) (2nd generation)',
  'iPad8,10': 'iPad Pro (11-inch) (2nd generation)',
  'iPad8,11': 'iPad Pro (12.9-inch) (4th generation)',
  'iPad8,12': 'iPad Pro (12.9-inch) (4th generation)',
  'iPad2,5': 'iPad mini',
  'iPad2,6': 'iPad mini',
  'iPad2,7': 'iPad mini',
  'iPad4,4': 'iPad mini 2',
  'iPad4,5': 'iPad mini 2',
  'iPad4,6': 'iPad mini 2',
  'iPad4,7': 'iPad mini 3',
  'iPad4,8': 'iPad mini 3',
  'iPad4,9': 'iPad mini 3',
  'iPad5,1': 'iPad mini 4',
  'iPad5,2': 'iPad mini 4',
  'iPad11,1': 'iPad mini (5th generation)',
  'iPad11,2': 'iPad mini (5th generation)',
  'iPad4,1': 'iPad Air',
  'iPad4,2': 'iPad Air',
  'iPad4,3': 'iPad Air',
  'iPad5,3': 'iPad Air 2',
  'iPad5,4': 'iPad Air 2',
  'iPad11,3': 'iPad Air (3rd generation)',
  'iPad11,4': 'iPad Air (3rd generation)',
  'iPad13,1': 'iPad Air (4th generation)',
  'iPad13,2': 'iPad Air (4th generation)',
  'iPad1,1': 'iPad',
  'iPad2,1': 'iPad 2',
  'iPad2,2': 'iPad 2',
  'iPad2,3': 'iPad 2',
  'iPad2,4': 'iPad 2',
  'iPad3,1': 'iPad (3rd generation)',
  'iPad3,2': 'iPad (3rd generation)',
  'iPad3,3': 'iPad (3rd generation)',
  'iPad3,4': 'iPad (4th generation)',
  'iPad3,5': 'iPad (4th generation)',
  'iPad3,6': 'iPad (4th generation)',
  'iPad6,11': 'iPad (5th generation)',
  'iPad6,12': 'iPad (5th generation)',
  'iPad7,5': 'iPad (6th generation)',
  'iPad7,6': 'iPad (6th generation)',
  'iPad7,11': 'iPad (7th generation)',
  'iPad7,12': 'iPad (7th generation)',
  'iPad11,6': 'iPad (8th generation)',
  'iPad11,7': 'iPad (8th generation)',
  'AudioAccessory1,1': 'HomePod',
  'AudioAccessory1,2': 'HomePod',
  'AudioAccessory5,1': 'HomePod mini',
  'Watch1,1': 'Apple Watch (1st generation)',
  'Watch1,2': 'Apple Watch (1st generation)',
  'Watch2,6': 'Apple Watch Series 1',
  'Watch2,7': 'Apple Watch Series 1',
  'Watch2,3': 'Apple Watch Series 2',
  'Watch2,4': 'Apple Watch Series 2',
  'Watch3,1': 'Apple Watch Series 3',
  'Watch3,2': 'Apple Watch Series 3',
  'Watch3,3': 'Apple Watch Series 3',
  'Watch3,4': 'Apple Watch Series 3',
  'Watch4,1': 'Apple Watch Series 4',
  'Watch4,2': 'Apple Watch Series 4',
  'Watch4,3': 'Apple Watch Series 4',
  'Watch4,4': 'Apple Watch Series 4',
  'Watch5,1': 'Apple Watch Series 5',
  'Watch5,2': 'Apple Watch Series 5',
  'Watch5,3': 'Apple Watch Series 5',
  'Watch5,4': 'Apple Watch Series 5',
  'Watch5,9': 'Apple Watch SE',
  'Watch5,10': 'Apple Watch SE',
  'Watch5,11': 'Apple Watch SE',
  'Watch5,12': 'Apple Watch SE',
  'Watch6,1': 'Apple Watch Series 6',
  'Watch6,2': 'Apple Watch Series 6',
  'Watch6,3': 'Apple Watch Series 6',
  'Watch6,4': 'Apple Watch Series 6',
  'AppleTV1,1': 'Apple TV (1st generation)',
  'AppleTV2,1': 'Apple TV (2nd generation)',
  'AppleTV3,1': 'Apple TV (3rd generation)',
  'AppleTV3,2': 'Apple TV (3rd generation)',
  'AppleTV5,3': 'Apple TV (4th generation)',
  'AppleTV6,2': 'Apple TV 4K',
  'AirPods1,1': 'AirPods (1st generation)',
  'AirPods2,1': 'AirPods (2nd generation)',
  'iProd8,1': 'AirPods Pro'
};


/***/ }),

/***/ "./app/views/organizationGroupDetails/groupTagValues.tsx":
/*!***************************************************************!*\
  !*** ./app/views/organizationGroupDetails/groupTagValues.tsx ***!
  \***************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_acl_feature__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/acl/feature */ "./app/components/acl/feature.tsx");
/* harmony import */ var sentry_components_asyncComponent__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/asyncComponent */ "./app/components/asyncComponent.tsx");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_buttonBar__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/buttonBar */ "./app/components/buttonBar.tsx");
/* harmony import */ var sentry_components_dataExport__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/dataExport */ "./app/components/dataExport.tsx");
/* harmony import */ var sentry_components_deviceName__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/deviceName */ "./app/components/deviceName.tsx");
/* harmony import */ var sentry_components_dropdownLink__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/dropdownLink */ "./app/components/dropdownLink.tsx");
/* harmony import */ var sentry_components_globalSelectionLink__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/globalSelectionLink */ "./app/components/globalSelectionLink.tsx");
/* harmony import */ var sentry_components_idBadge_userBadge__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/components/idBadge/userBadge */ "./app/components/idBadge/userBadge.tsx");
/* harmony import */ var sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/components/layouts/thirds */ "./app/components/layouts/thirds.tsx");
/* harmony import */ var sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/components/links/externalLink */ "./app/components/links/externalLink.tsx");
/* harmony import */ var sentry_components_links_link__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/components/links/link */ "./app/components/links/link.tsx");
/* harmony import */ var sentry_components_pagination__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/components/pagination */ "./app/components/pagination.tsx");
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var sentry_components_timeSince__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! sentry/components/timeSince */ "./app/components/timeSince.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_20__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_21__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");
/* harmony import */ var sentry_utils_discover_eventView__WEBPACK_IMPORTED_MODULE_22__ = __webpack_require__(/*! sentry/utils/discover/eventView */ "./app/utils/discover/eventView.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");



function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }
























const DEFAULT_SORT = 'count';

class GroupTagValues extends sentry_components_asyncComponent__WEBPACK_IMPORTED_MODULE_4__["default"] {
  getEndpoints() {
    const {
      environments: environment
    } = this.props;
    const {
      groupId,
      tagKey
    } = this.props.params;
    return [['tag', `/issues/${groupId}/tags/${tagKey}/`], ['tagValueList', `/issues/${groupId}/tags/${tagKey}/values/`, {
      query: {
        environment,
        sort: this.getSort()
      }
    }]];
  }

  getSort() {
    return this.props.location.query.sort || DEFAULT_SORT;
  }

  renderLoading() {
    return this.renderBody();
  }

  renderResults() {
    const {
      baseUrl,
      project,
      environments: environment,
      params: {
        orgId,
        groupId,
        tagKey
      }
    } = this.props;
    const {
      tagValueList,
      tag
    } = this.state;
    const discoverFields = ['title', 'release', 'environment', 'user.display', 'timestamp'];
    return tagValueList === null || tagValueList === void 0 ? void 0 : tagValueList.map((tagValue, tagValueIdx) => {
      var _tagValue$key, _tagValue$identifier;

      const pct = tag !== null && tag !== void 0 && tag.totalValues ? `${(0,sentry_utils__WEBPACK_IMPORTED_MODULE_21__.percent)(tagValue.count, tag === null || tag === void 0 ? void 0 : tag.totalValues).toFixed(2)}%` : '--';
      const key = (_tagValue$key = tagValue.key) !== null && _tagValue$key !== void 0 ? _tagValue$key : tagKey;
      const issuesQuery = tagValue.query || `${key}:"${tagValue.value}"`;
      const discoverView = sentry_utils_discover_eventView__WEBPACK_IMPORTED_MODULE_22__["default"].fromSavedQuery({
        id: undefined,
        name: key !== null && key !== void 0 ? key : '',
        fields: [...(key !== undefined ? [key] : []), ...discoverFields.filter(field => field !== key)],
        orderby: '-timestamp',
        query: `issue.id:${groupId} ${issuesQuery}`,
        projects: [Number(project === null || project === void 0 ? void 0 : project.id)],
        environment,
        version: 2,
        range: '90d'
      });
      const issuesPath = `/organizations/${orgId}/issues/`;
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsxs)(react__WEBPACK_IMPORTED_MODULE_2__.Fragment, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsxs)(NameColumn, {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(NameWrapper, {
            "data-test-id": "group-tag-value",
            children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(sentry_components_globalSelectionLink__WEBPACK_IMPORTED_MODULE_10__["default"], {
              to: {
                pathname: `${baseUrl}events/`,
                query: {
                  query: issuesQuery
                }
              },
              children: key === 'user' ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(sentry_components_idBadge_userBadge__WEBPACK_IMPORTED_MODULE_11__["default"], {
                user: { ...tagValue,
                  id: (_tagValue$identifier = tagValue.identifier) !== null && _tagValue$identifier !== void 0 ? _tagValue$identifier : ''
                },
                avatarSize: 20,
                hideEmail: true
              }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(sentry_components_deviceName__WEBPACK_IMPORTED_MODULE_8__.DeviceName, {
                value: tagValue.name
              })
            })
          }), tagValue.email && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(StyledExternalLink, {
            href: `mailto:${tagValue.email}`,
            "data-test-id": "group-tag-mail",
            children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_18__.IconMail, {
              size: "xs",
              color: "gray300"
            })
          }), (0,sentry_utils__WEBPACK_IMPORTED_MODULE_21__.isUrl)(tagValue.value) && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(StyledExternalLink, {
            href: tagValue.value,
            "data-test-id": "group-tag-url",
            children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_18__.IconOpen, {
              size: "xs",
              color: "gray300"
            })
          })]
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(RightAlignColumn, {
          children: pct
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(RightAlignColumn, {
          children: tagValue.count.toLocaleString()
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(RightAlignColumn, {
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(sentry_components_timeSince__WEBPACK_IMPORTED_MODULE_17__["default"], {
            date: tagValue.lastSeen
          })
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(RightAlignColumn, {
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsxs)(sentry_components_dropdownLink__WEBPACK_IMPORTED_MODULE_9__["default"], {
            anchorRight: true,
            alwaysRenderMenu: false,
            caret: false,
            title: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_5__["default"], {
              tooltipProps: {
                containerDisplayMode: 'flex'
              },
              size: "sm",
              type: "button",
              "aria-label": (0,sentry_locale__WEBPACK_IMPORTED_MODULE_19__.t)('Show more'),
              icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_18__.IconEllipsis, {
                size: "xs"
              })
            }),
            children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(sentry_components_acl_feature__WEBPACK_IMPORTED_MODULE_3__["default"], {
              features: ['organizations:discover-basic'],
              children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)("li", {
                children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(sentry_components_links_link__WEBPACK_IMPORTED_MODULE_14__["default"], {
                  to: discoverView.getResultsViewUrlTarget(orgId),
                  children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_19__.t)('Open in Discover')
                })
              })
            }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)("li", {
              children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(sentry_components_globalSelectionLink__WEBPACK_IMPORTED_MODULE_10__["default"], {
                to: {
                  pathname: issuesPath,
                  query: {
                    query: issuesQuery
                  }
                },
                children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_19__.t)('Search All Issues with Tag Value')
              })
            })]
          })
        })]
      }, tagValueIdx);
    });
  }

  renderBody() {
    const {
      group,
      params: {
        orgId,
        tagKey
      },
      location: {
        query
      },
      environments
    } = this.props;
    const {
      tagValueList,
      tag,
      tagValueListPageLinks,
      loading
    } = this.state;
    const {
      cursor: _cursor,
      page: _page,
      ...currentQuery
    } = query;
    const title = tagKey === 'user' ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_19__.t)('Affected Users') : tagKey;
    const sort = this.getSort();

    const sortArrow = (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_18__.IconArrow, {
      color: "gray300",
      size: "xs",
      direction: "down"
    });

    const lastSeenColumnHeader = (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsxs)(StyledSortLink, {
      to: {
        pathname: location.pathname,
        query: { ...currentQuery,
          sort: 'date'
        }
      },
      children: [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_19__.t)('Last Seen'), " ", sort === 'date' && sortArrow]
    });

    const countColumnHeader = (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsxs)(StyledSortLink, {
      to: {
        pathname: location.pathname,
        query: { ...currentQuery,
          sort: 'count'
        }
      },
      children: [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_19__.t)('Count'), " ", sort === 'count' && sortArrow]
    });

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_12__.Body, {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsxs)(sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_12__.Main, {
        fullWidth: true,
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsxs)(TitleWrapper, {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(Title, {
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_19__.t)('Tag Details')
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsxs)(sentry_components_buttonBar__WEBPACK_IMPORTED_MODULE_6__["default"], {
            gap: 1,
            children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_5__["default"], {
              size: "sm",
              priority: "default",
              href: `/${orgId}/${group.project.slug}/issues/${group.id}/tags/${tagKey}/export/`,
              children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_19__.t)('Export Page to CSV')
            }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(sentry_components_dataExport__WEBPACK_IMPORTED_MODULE_7__["default"], {
              payload: {
                queryType: sentry_components_dataExport__WEBPACK_IMPORTED_MODULE_7__.ExportQueryType.IssuesByTag,
                queryInfo: {
                  project: group.project.id,
                  group: group.id,
                  key: tagKey
                }
              }
            })]
          })]
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(StyledPanelTable, {
          isLoading: loading,
          isEmpty: (tagValueList === null || tagValueList === void 0 ? void 0 : tagValueList.length) === 0,
          headers: [title, (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(PercentColumnHeader, {
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_19__.t)('Percent')
          }, "percent"), countColumnHeader, lastSeenColumnHeader, ''],
          emptyMessage: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_19__.t)('Sorry, the tags for this issue could not be found.'),
          emptyAction: !!(environments !== null && environments !== void 0 && environments.length) ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_19__.t)('No tags were found for the currently selected environments') : null,
          children: tagValueList && tag && this.renderResults()
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_23__.jsx)(StyledPagination, {
          pageLinks: tagValueListPageLinks
        })]
      })
    });
  }

}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (GroupTagValues);

const TitleWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e8ib56610"
} : 0)("display:flex;flex-direction:row;flex-wrap:wrap;align-items:center;justify-content:space-between;margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_20__["default"])(2), ";" + ( true ? "" : 0));

const Title = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('h3',  true ? {
  target: "e8ib5669"
} : 0)( true ? {
  name: "ti75j2",
  styles: "margin:0"
} : 0);

const StyledPanelTable = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_panels__WEBPACK_IMPORTED_MODULE_16__.PanelTable,  true ? {
  target: "e8ib5668"
} : 0)("white-space:nowrap;font-size:", p => p.theme.fontSizeMedium, ";overflow:auto;@media (min-width: ", p => p.theme.breakpoints.small, "){overflow:initial;}&>*{padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_20__["default"])(1), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_20__["default"])(2), ";}" + ( true ? "" : 0));

const PercentColumnHeader = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e8ib5667"
} : 0)( true ? {
  name: "2qga7i",
  styles: "text-align:right"
} : 0);

const StyledSortLink = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_links_link__WEBPACK_IMPORTED_MODULE_14__["default"],  true ? {
  target: "e8ib5666"
} : 0)( true ? {
  name: "7p2agl",
  styles: "text-align:right;color:inherit;:hover{color:inherit;}"
} : 0);

const StyledExternalLink = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_13__["default"],  true ? {
  target: "e8ib5665"
} : 0)("margin-left:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_20__["default"])(0.5), ";" + ( true ? "" : 0));

const Column = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e8ib5664"
} : 0)( true ? {
  name: "s5xdrg",
  styles: "display:flex;align-items:center"
} : 0);

const NameColumn = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(Column,  true ? {
  target: "e8ib5663"
} : 0)(p => p.theme.overflowEllipsis, ";display:flex;min-width:320px;" + ( true ? "" : 0));

const NameWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('span',  true ? {
  target: "e8ib5662"
} : 0)(p => p.theme.overflowEllipsis, ";width:auto;" + ( true ? "" : 0));

const RightAlignColumn = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(Column,  true ? {
  target: "e8ib5661"
} : 0)( true ? {
  name: "1f60if8",
  styles: "justify-content:flex-end"
} : 0);

const StyledPagination = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_pagination__WEBPACK_IMPORTED_MODULE_15__["default"],  true ? {
  target: "e8ib5660"
} : 0)( true ? {
  name: "ti75j2",
  styles: "margin:0"
} : 0);

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_views_organizationGroupDetails_groupTagValues_tsx.5e877bb1e3774a41494c9957baa037b4.js.map