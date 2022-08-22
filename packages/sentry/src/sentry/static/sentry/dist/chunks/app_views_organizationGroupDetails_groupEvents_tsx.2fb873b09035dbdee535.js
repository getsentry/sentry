"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_views_organizationGroupDetails_groupEvents_tsx"],{

/***/ "./app/components/acl/role.tsx":
/*!*************************************!*\
  !*** ./app/components/acl/role.tsx ***!
  \*************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "Role": () => (/* binding */ withOrganizationRole)
/* harmony export */ });
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_stores_configStore__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/stores/configStore */ "./app/stores/configStore.tsx");
/* harmony import */ var sentry_utils_isActiveSuperuser__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/utils/isActiveSuperuser */ "./app/utils/isActiveSuperuser.tsx");
/* harmony import */ var sentry_utils_isRenderFunc__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/utils/isRenderFunc */ "./app/utils/isRenderFunc.tsx");
/* harmony import */ var sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/utils/withOrganization */ "./app/utils/withOrganization.tsx");







function checkUserRole(user, organization, role) {
  var _organization$role, _organization$role2;

  if (!user) {
    return false;
  }

  if ((0,sentry_utils_isActiveSuperuser__WEBPACK_IMPORTED_MODULE_3__.isActiveSuperuser)()) {
    return true;
  }

  if (!Array.isArray(organization.orgRoleList)) {
    return false;
  }

  const roleIds = organization.orgRoleList.map(r => r.id);

  if (!roleIds.includes(role) || !roleIds.includes((_organization$role = organization.role) !== null && _organization$role !== void 0 ? _organization$role : '')) {
    return false;
  }

  const requiredIndex = roleIds.indexOf(role);
  const currentIndex = roleIds.indexOf((_organization$role2 = organization.role) !== null && _organization$role2 !== void 0 ? _organization$role2 : '');
  return currentIndex >= requiredIndex;
}

function Role(_ref) {
  let {
    role,
    organization,
    children
  } = _ref;
  const user = sentry_stores_configStore__WEBPACK_IMPORTED_MODULE_2__["default"].get('user');
  const hasRole = (0,react__WEBPACK_IMPORTED_MODULE_1__.useMemo)(() => checkUserRole(user, organization, role), // It seems that this returns a stable reference, but
  [organization, role, user]);

  if ((0,sentry_utils_isRenderFunc__WEBPACK_IMPORTED_MODULE_4__.isRenderFunc)(children)) {
    return children({
      hasRole
    });
  }

  return hasRole ? children : null;
}

const withOrganizationRole = (0,sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_5__["default"])(Role);


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

/***/ "./app/components/eventsTable/eventsTable.tsx":
/*!****************************************************!*\
  !*** ./app/components/eventsTable/eventsTable.tsx ***!
  \****************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_eventsTable_eventsTableRow__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/eventsTable/eventsTableRow */ "./app/components/eventsTable/eventsTableRow.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");






class EventsTable extends react__WEBPACK_IMPORTED_MODULE_0__.Component {
  render() {
    const {
      events,
      tagList,
      orgId,
      projectId,
      groupId
    } = this.props;
    const hasUser = !!events.find(event => event.user);
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsxs)("table", {
      className: "table events-table",
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)("thead", {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsxs)("tr", {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)("th", {
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('ID')
          }), hasUser && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)("th", {
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_2__.t)('User')
          }), tagList.map(tag => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)("th", {
            children: tag.name
          }, tag.key))]
        })
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)("tbody", {
        children: events.map(event => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(sentry_components_eventsTable_eventsTableRow__WEBPACK_IMPORTED_MODULE_1__["default"], {
          event: event,
          orgId: orgId,
          projectId: projectId,
          groupId: groupId,
          tagList: tagList,
          hasUser: hasUser
        }, event.id))
      })]
    });
  }

}

EventsTable.displayName = "EventsTable";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (EventsTable);

/***/ }),

/***/ "./app/components/eventsTable/eventsTableRow.tsx":
/*!*******************************************************!*\
  !*** ./app/components/eventsTable/eventsTableRow.tsx ***!
  \*******************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "EventsTableRow": () => (/* binding */ EventsTableRow),
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_avatar_userAvatar__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/avatar/userAvatar */ "./app/components/avatar/userAvatar.tsx");
/* harmony import */ var sentry_components_dateTime__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/dateTime */ "./app/components/dateTime.tsx");
/* harmony import */ var sentry_components_deviceName__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/deviceName */ "./app/components/deviceName.tsx");
/* harmony import */ var sentry_components_fileSize__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/fileSize */ "./app/components/fileSize.tsx");
/* harmony import */ var sentry_components_globalSelectionLink__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/globalSelectionLink */ "./app/components/globalSelectionLink.tsx");
/* harmony import */ var sentry_utils_attachmentUrl__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/utils/attachmentUrl */ "./app/utils/attachmentUrl.tsx");
/* harmony import */ var sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/utils/withOrganization */ "./app/utils/withOrganization.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");











class EventsTableRow extends react__WEBPACK_IMPORTED_MODULE_0__.Component {
  renderCrashFileLink() {
    const {
      event,
      projectId
    } = this.props;

    if (!event.crashFile) {
      return null;
    }

    const crashFileType = event.crashFile.type === 'event.minidump' ? 'Minidump' : 'Crash file';
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(sentry_utils_attachmentUrl__WEBPACK_IMPORTED_MODULE_6__["default"], {
      projectId: projectId,
      eventId: event.id,
      attachment: event.crashFile,
      children: url => {
        var _event$crashFile, _event$crashFile2;

        return url ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsxs)("small", {
          children: [crashFileType, ": ", (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)("a", {
            href: `${url}?download=1`,
            children: (_event$crashFile = event.crashFile) === null || _event$crashFile === void 0 ? void 0 : _event$crashFile.name
          }), " (", (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(sentry_components_fileSize__WEBPACK_IMPORTED_MODULE_4__["default"], {
            bytes: ((_event$crashFile2 = event.crashFile) === null || _event$crashFile2 === void 0 ? void 0 : _event$crashFile2.size) || 0
          }), ")"]
        }) : null;
      }
    });
  }

  render() {
    const {
      className,
      event,
      orgId,
      groupId,
      tagList,
      hasUser
    } = this.props;
    const tagMap = {};
    event.tags.forEach(tag => {
      tagMap[tag.key] = tag.value;
    });
    const link = `/organizations/${orgId}/issues/${groupId}/events/${event.id}/`;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsxs)("tr", {
      className: className,
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)("td", {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsxs)("h5", {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(sentry_components_globalSelectionLink__WEBPACK_IMPORTED_MODULE_5__["default"], {
            to: link,
            children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(sentry_components_dateTime__WEBPACK_IMPORTED_MODULE_2__["default"], {
              date: event.dateCreated,
              year: true,
              seconds: true,
              timeZone: true
            })
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)("small", {
            children: event.title.substr(0, 100)
          }), this.renderCrashFileLink()]
        })
      }), hasUser && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)("td", {
        className: "event-user table-user-info",
        children: event.user ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsxs)("div", {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(sentry_components_avatar_userAvatar__WEBPACK_IMPORTED_MODULE_1__["default"], {
            user: event.user // TODO(ts): Some of the user fields are optional from event, this cast can probably be removed in the future
            ,
            size: 24,
            className: "avatar",
            gravatar: false
          }), event.user.email]
        }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)("span", {
          children: "\u2014"
        })
      }), tagList.map(tag => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)("td", {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)("div", {
          children: tag.key === 'device' ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(sentry_components_deviceName__WEBPACK_IMPORTED_MODULE_3__.DeviceName, {
            value: tagMap[tag.key]
          }) : tagMap[tag.key]
        })
      }, tag.key))]
    }, event.id);
  }

}

EventsTableRow.displayName = "EventsTableRow";

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_7__["default"])(EventsTableRow));

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

/***/ "./app/utils/attachmentUrl.tsx":
/*!*************************************!*\
  !*** ./app/utils/attachmentUrl.tsx ***!
  \*************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_acl_role__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/acl/role */ "./app/components/acl/role.tsx");
/* harmony import */ var sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/utils/withOrganization */ "./app/utils/withOrganization.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");





function AttachmentUrl(_ref) {
  let {
    attachment,
    organization,
    eventId,
    projectId,
    children
  } = _ref;

  function getDownloadUrl() {
    return `/api/0/projects/${organization.slug}/${projectId}/events/${eventId}/attachments/${attachment.id}/`;
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(sentry_components_acl_role__WEBPACK_IMPORTED_MODULE_1__.Role, {
    role: organization.attachmentsRole,
    children: _ref2 => {
      let {
        hasRole
      } = _ref2;
      return children(hasRole ? getDownloadUrl() : null);
    }
  });
}

AttachmentUrl.displayName = "AttachmentUrl";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_2__["default"])( /*#__PURE__*/(0,react__WEBPACK_IMPORTED_MODULE_0__.memo)(AttachmentUrl)));

/***/ }),

/***/ "./app/views/organizationGroupDetails/groupEvents.tsx":
/*!************************************************************!*\
  !*** ./app/views/organizationGroupDetails/groupEvents.tsx ***!
  \************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "GroupEvents": () => (/* binding */ GroupEvents),
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var react_router__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react-router */ "../node_modules/react-router/es/index.js");
/* harmony import */ var lodash_pick__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! lodash/pick */ "../node_modules/lodash/pick.js");
/* harmony import */ var lodash_pick__WEBPACK_IMPORTED_MODULE_4___default = /*#__PURE__*/__webpack_require__.n(lodash_pick__WEBPACK_IMPORTED_MODULE_4__);
/* harmony import */ var sentry_components_emptyStateWarning__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/emptyStateWarning */ "./app/components/emptyStateWarning.tsx");
/* harmony import */ var sentry_components_environmentPageFilter__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/environmentPageFilter */ "./app/components/environmentPageFilter.tsx");
/* harmony import */ var sentry_components_eventsTable_eventsTable__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/eventsTable/eventsTable */ "./app/components/eventsTable/eventsTable.tsx");
/* harmony import */ var sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/layouts/thirds */ "./app/components/layouts/thirds.tsx");
/* harmony import */ var sentry_components_loadingError__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/loadingError */ "./app/components/loadingError.tsx");
/* harmony import */ var sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/loadingIndicator */ "./app/components/loadingIndicator.tsx");
/* harmony import */ var sentry_components_pagination__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/components/pagination */ "./app/components/pagination.tsx");
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var sentry_components_searchBar__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/components/searchBar */ "./app/components/searchBar.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_parseApiError__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/utils/parseApiError */ "./app/utils/parseApiError.tsx");
/* harmony import */ var sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! sentry/utils/withApi */ "./app/utils/withApi.tsx");
/* harmony import */ var sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! sentry/utils/withOrganization */ "./app/utils/withOrganization.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");






















class GroupEvents extends react__WEBPACK_IMPORTED_MODULE_2__.Component {
  constructor(props) {
    super(props);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleSearch", query => {
      const targetQueryParams = { ...this.props.location.query
      };
      targetQueryParams.query = query;
      const {
        groupId,
        orgId
      } = this.props.params;
      react_router__WEBPACK_IMPORTED_MODULE_3__.browserHistory.push({
        pathname: `/organizations/${orgId}/issues/${groupId}/events/`,
        query: targetQueryParams
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "fetchData", () => {
      this.setState({
        loading: true,
        error: false
      });
      const query = { ...lodash_pick__WEBPACK_IMPORTED_MODULE_4___default()(this.props.location.query, ['cursor', 'environment']),
        limit: 50,
        query: this.state.query
      };
      this.props.api.request(`/issues/${this.props.params.groupId}/events/`, {
        query,
        method: 'GET',
        success: (data, _, resp) => {
          var _resp$getResponseHead;

          this.setState({
            eventList: data,
            error: false,
            loading: false,
            pageLinks: (_resp$getResponseHead = resp === null || resp === void 0 ? void 0 : resp.getResponseHeader('Link')) !== null && _resp$getResponseHead !== void 0 ? _resp$getResponseHead : ''
          });
        },
        error: err => {
          this.setState({
            error: (0,sentry_utils_parseApiError__WEBPACK_IMPORTED_MODULE_16__["default"])(err),
            loading: false
          });
        }
      });
    });

    const queryParams = this.props.location.query;
    this.state = {
      eventList: [],
      loading: true,
      error: false,
      pageLinks: '',
      query: queryParams.query || ''
    };
  }

  UNSAFE_componentWillMount() {
    this.fetchData();
  }

  UNSAFE_componentWillReceiveProps(nextProps) {
    if (this.props.location.search !== nextProps.location.search) {
      const queryParams = nextProps.location.query;
      this.setState({
        query: queryParams.query
      }, this.fetchData);
    }
  }

  renderNoQueryResults() {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(sentry_components_emptyStateWarning__WEBPACK_IMPORTED_MODULE_5__["default"], {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)("p", {
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)('Sorry, no events match your search query.')
      })
    });
  }

  renderEmpty() {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(sentry_components_emptyStateWarning__WEBPACK_IMPORTED_MODULE_5__["default"], {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)("p", {
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)("There don't seem to be any events yet.")
      })
    });
  }

  renderResults() {
    const {
      group,
      params
    } = this.props;
    const tagList = group.tags.filter(tag => tag.key !== 'user') || [];
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(sentry_components_eventsTable_eventsTable__WEBPACK_IMPORTED_MODULE_7__["default"], {
      tagList: tagList,
      events: this.state.eventList,
      orgId: params.orgId,
      projectId: group.project.slug,
      groupId: params.groupId
    });
  }

  renderBody() {
    let body;

    if (this.state.loading) {
      body = (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_10__["default"], {});
    } else if (this.state.error) {
      body = (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(sentry_components_loadingError__WEBPACK_IMPORTED_MODULE_9__["default"], {
        message: this.state.error,
        onRetry: this.fetchData
      });
    } else if (this.state.eventList.length > 0) {
      body = this.renderResults();
    } else if (this.state.query && this.state.query !== '') {
      body = this.renderNoQueryResults();
    } else {
      body = this.renderEmpty();
    }

    return body;
  }

  render() {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_8__.Body, {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_8__.Main, {
        fullWidth: true,
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsxs)(Wrapper, {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsxs)(FilterSection, {
            children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(sentry_components_environmentPageFilter__WEBPACK_IMPORTED_MODULE_6__["default"], {}), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(sentry_components_searchBar__WEBPACK_IMPORTED_MODULE_13__["default"], {
              defaultQuery: "",
              placeholder: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)('Search events by id, message, or tags'),
              query: this.state.query,
              onSearch: this.handleSearch
            })]
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_12__.Panel, {
            className: "event-list",
            children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_12__.PanelBody, {
              children: this.renderBody()
            })
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_19__.jsx)(sentry_components_pagination__WEBPACK_IMPORTED_MODULE_11__["default"], {
            pageLinks: this.state.pageLinks
          })]
        })
      })
    });
  }

}

GroupEvents.displayName = "GroupEvents";

const FilterSection = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "etd8qom1"
} : 0)("display:grid;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_15__["default"])(1), ";grid-template-columns:max-content 1fr;" + ( true ? "" : 0));

const Wrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "etd8qom0"
} : 0)("display:grid;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_15__["default"])(2), ";" + ( true ? "" : 0));


/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_18__["default"])((0,sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_17__["default"])(GroupEvents)));

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_views_organizationGroupDetails_groupEvents_tsx.df601d9b5ead6a6a3030dcc329669650.js.map