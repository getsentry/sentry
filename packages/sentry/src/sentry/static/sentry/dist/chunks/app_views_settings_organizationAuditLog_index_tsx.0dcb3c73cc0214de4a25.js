"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_views_settings_organizationAuditLog_index_tsx"],{

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

/***/ "./app/views/settings/organizationAuditLog/auditLogList.tsx":
/*!******************************************************************!*\
  !*** ./app/views/settings/organizationAuditLog/auditLogList.tsx ***!
  \******************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_activity_item_avatar__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/activity/item/avatar */ "./app/components/activity/item/avatar.tsx");
/* harmony import */ var sentry_components_avatar_userAvatar__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/avatar/userAvatar */ "./app/components/avatar/userAvatar.tsx");
/* harmony import */ var sentry_components_dateTime__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/dateTime */ "./app/components/dateTime.tsx");
/* harmony import */ var sentry_components_forms_selectControl__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/forms/selectControl */ "./app/components/forms/selectControl.tsx");
/* harmony import */ var sentry_components_pagination__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/pagination */ "./app/components/pagination.tsx");
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var sentry_components_tag__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/tag */ "./app/components/tag.tsx");
/* harmony import */ var sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/tooltip */ "./app/components/tooltip.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_dates__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/utils/dates */ "./app/utils/dates.tsx");
/* harmony import */ var sentry_views_settings_components_settingsPageHeader__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/views/settings/components/settingsPageHeader */ "./app/views/settings/components/settingsPageHeader.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");



function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }
















const avatarStyle = {
  width: 36,
  height: 36,
  marginRight: 8
};

const getAvatarDisplay = logEntryUser => {
  // Display Sentry's avatar for system or superuser-initiated events
  if (logEntryUser !== null && logEntryUser !== void 0 && logEntryUser.isSuperuser || (logEntryUser === null || logEntryUser === void 0 ? void 0 : logEntryUser.name) === 'Sentry' && (logEntryUser === null || logEntryUser === void 0 ? void 0 : logEntryUser.email) === undefined) {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(SentryAvatar, {
      type: "system",
      size: 36
    });
  } // Display user's avatar for non-superusers-initiated events


  if (logEntryUser !== undefined) {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_components_avatar_userAvatar__WEBPACK_IMPORTED_MODULE_4__["default"], {
      style: avatarStyle,
      user: logEntryUser
    });
  }

  return null;
};

const addUsernameDisplay = logEntryUser => {
  if (logEntryUser !== null && logEntryUser !== void 0 && logEntryUser.isSuperuser) {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsxs)(Name, {
      "data-test-id": "actor-name",
      children: [logEntryUser.name, (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(StaffTag, {
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Sentry Staff')
      })]
    });
  }

  if (logEntryUser !== undefined) {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(Name, {
      "data-test-id": "actor-name",
      children: logEntryUser.name
    });
  }

  return null;
};

const AuditLogList = _ref => {
  let {
    isLoading,
    pageLinks,
    entries,
    eventType,
    eventTypes,
    onCursor,
    onEventSelect
  } = _ref;
  const is24Hours = (0,sentry_utils_dates__WEBPACK_IMPORTED_MODULE_13__.shouldUse24Hours)();
  const hasEntries = entries && entries.length > 0;
  const ipv4Length = 15;
  const eventOptions = eventTypes === null || eventTypes === void 0 ? void 0 : eventTypes.map(type => ({
    label: type,
    value: type
  }));

  const action = (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(EventSelector, {
    clearable: true,
    isDisabled: isLoading,
    name: "eventFilter",
    value: eventType,
    placeholder: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Select Action: '),
    options: eventOptions,
    onChange: options => {
      onEventSelect(options === null || options === void 0 ? void 0 : options.value);
    }
  });

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsxs)("div", {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_views_settings_components_settingsPageHeader__WEBPACK_IMPORTED_MODULE_14__["default"], {
      title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Audit Log'),
      action: action
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_8__.PanelTable, {
      headers: [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Member'), (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Action'), (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('IP'), (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Time')],
      isEmpty: !hasEntries && (entries === null || entries === void 0 ? void 0 : entries.length) === 0,
      emptyMessage: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('No audit entries available'),
      isLoading: isLoading,
      children: entries === null || entries === void 0 ? void 0 : entries.map(entry => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsxs)(react__WEBPACK_IMPORTED_MODULE_2__.Fragment, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsxs)(UserInfo, {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)("div", {
            children: getAvatarDisplay(entry.actor)
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsxs)(NameContainer, {
            children: [addUsernameDisplay(entry.actor), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(Note, {
              children: entry.note
            })]
          })]
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(FlexCenter, {
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(MonoDetail, {
            children: entry.event
          })
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(FlexCenter, {
          children: entry.ipAddress && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(IpAddressOverflow, {
            children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_10__["default"], {
              title: entry.ipAddress,
              disabled: entry.ipAddress.length <= ipv4Length,
              children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(MonoDetail, {
                children: entry.ipAddress
              })
            })
          })
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsxs)(TimestampInfo, {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_components_dateTime__WEBPACK_IMPORTED_MODULE_5__["default"], {
            dateOnly: true,
            date: entry.dateCreated
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_components_dateTime__WEBPACK_IMPORTED_MODULE_5__["default"], {
            timeOnly: true,
            format: is24Hours ? 'HH:mm zz' : 'LT zz',
            date: entry.dateCreated
          })]
        })]
      }, entry.id))
    }), pageLinks && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_components_pagination__WEBPACK_IMPORTED_MODULE_7__["default"], {
      pageLinks: pageLinks,
      onCursor: onCursor
    })]
  });
};

AuditLogList.displayName = "AuditLogList";

const SentryAvatar = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_activity_item_avatar__WEBPACK_IMPORTED_MODULE_3__["default"],  true ? {
  target: "e1haq54w10"
} : 0)("margin-right:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_12__["default"])(1), ";" + ( true ? "" : 0));

const Name = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('strong',  true ? {
  target: "e1haq54w9"
} : 0)("font-size:", p => p.theme.fontSizeMedium, ";" + ( true ? "" : 0));

const StaffTag = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_tag__WEBPACK_IMPORTED_MODULE_9__["default"],  true ? {
  target: "e1haq54w8"
} : 0)("padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_12__["default"])(1), ";" + ( true ? "" : 0));

const EventSelector = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_forms_selectControl__WEBPACK_IMPORTED_MODULE_6__["default"],  true ? {
  target: "e1haq54w7"
} : 0)( true ? {
  name: "xu0q36",
  styles: "width:250px"
} : 0);

const UserInfo = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1haq54w6"
} : 0)("display:flex;align-items:center;line-height:1.2;font-size:", p => p.theme.fontSizeSmall, ";min-width:250px;" + ( true ? "" : 0));

const NameContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1haq54w5"
} : 0)( true ? {
  name: "16mmcnu",
  styles: "display:flex;flex-direction:column;justify-content:center"
} : 0);

const Note = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1haq54w4"
} : 0)("font-size:", p => p.theme.fontSizeSmall, ";word-break:break-word;" + ( true ? "" : 0));

const FlexCenter = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1haq54w3"
} : 0)( true ? {
  name: "s5xdrg",
  styles: "display:flex;align-items:center"
} : 0);

const IpAddressOverflow = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1haq54w2"
} : 0)(p => p.theme.overflowEllipsis, ";min-width:90px;" + ( true ? "" : 0));

const MonoDetail = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('code',  true ? {
  target: "e1haq54w1"
} : 0)("font-size:", p => p.theme.fontSizeMedium, ";white-space:no-wrap;" + ( true ? "" : 0));

const TimestampInfo = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1haq54w0"
} : 0)("display:grid;grid-template-rows:auto auto;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_12__["default"])(1), ";font-size:", p => p.theme.fontSizeMedium, ";" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (AuditLogList);

/***/ }),

/***/ "./app/views/settings/organizationAuditLog/index.tsx":
/*!***********************************************************!*\
  !*** ./app/views/settings/organizationAuditLog/index.tsx ***!
  \***********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var react_router__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react-router */ "../node_modules/react-router/es/index.js");
/* harmony import */ var _sentry_react__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! @sentry/react */ "../node_modules/@sentry/hub/esm/exports.js");
/* harmony import */ var sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/actionCreators/indicator */ "./app/actionCreators/indicator.tsx");
/* harmony import */ var sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/utils/queryString */ "./app/utils/queryString.tsx");
/* harmony import */ var sentry_utils_useApi__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/utils/useApi */ "./app/utils/useApi.tsx");
/* harmony import */ var sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/utils/withOrganization */ "./app/utils/withOrganization.tsx");
/* harmony import */ var _auditLogList__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! ./auditLogList */ "./app/views/settings/organizationAuditLog/auditLogList.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");











function OrganizationAuditLog(_ref) {
  let {
    location,
    organization
  } = _ref;
  const [state, setState] = (0,react__WEBPACK_IMPORTED_MODULE_1__.useState)({
    entryList: [],
    entryListPageLinks: null,
    eventType: (0,sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_4__.decodeScalar)(location.query.event),
    eventTypes: [],
    isLoading: true
  });
  const api = (0,sentry_utils_useApi__WEBPACK_IMPORTED_MODULE_5__["default"])();

  const handleCursor = resultsCursor => {
    setState(prevState => ({ ...prevState,
      currentCursor: resultsCursor
    }));
  };

  (0,react__WEBPACK_IMPORTED_MODULE_1__.useEffect)(() => {
    // Watch the location for changes so we can re-fetch data.
    const eventType = (0,sentry_utils_queryString__WEBPACK_IMPORTED_MODULE_4__.decodeScalar)(location.query.event);
    setState(prevState => ({ ...prevState,
      eventType
    }));
  }, [location.query]);
  const fetchAuditLogData = (0,react__WEBPACK_IMPORTED_MODULE_1__.useCallback)(async () => {
    setState(prevState => ({ ...prevState,
      isLoading: true
    }));

    try {
      const payload = {
        cursor: state.currentCursor,
        event: state.eventType
      };

      if (!payload.cursor) {
        delete payload.cursor;
      }

      if (!payload.event) {
        delete payload.event;
      }

      setState(prevState => ({ ...prevState,
        isLoading: true
      }));
      const [data, _, response] = await api.requestPromise(`/organizations/${organization.slug}/audit-logs/`, {
        method: 'GET',
        includeAllArgs: true,
        query: payload
      });
      setState(prevState => {
        var _response$getResponse;

        return { ...prevState,
          entryList: data.rows,
          eventTypes: data.options.sort(),
          isLoading: false,
          entryListPageLinks: (_response$getResponse = response === null || response === void 0 ? void 0 : response.getResponseHeader('Link')) !== null && _response$getResponse !== void 0 ? _response$getResponse : null
        };
      });
    } catch (err) {
      if (err.status !== 401 && err.status !== 403) {
        _sentry_react__WEBPACK_IMPORTED_MODULE_8__.captureException(err);
      }

      setState(prevState => ({ ...prevState,
        isLoading: false
      }));
      (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_3__.addErrorMessage)('Unable to load audit logs.');
    }
  }, [api, organization.slug, state.currentCursor, state.eventType]);
  (0,react__WEBPACK_IMPORTED_MODULE_1__.useEffect)(() => {
    fetchAuditLogData();
  }, [fetchAuditLogData]);

  const handleEventSelect = value => {
    setState(prevState => ({ ...prevState,
      eventType: value
    }));
    react_router__WEBPACK_IMPORTED_MODULE_2__.browserHistory.push({
      pathname: location.pathname,
      query: { ...location.query,
        event: value
      }
    });
  };

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(react__WEBPACK_IMPORTED_MODULE_1__.Fragment, {
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(_auditLogList__WEBPACK_IMPORTED_MODULE_7__["default"], {
      entries: state.entryList,
      pageLinks: state.entryListPageLinks,
      eventType: state.eventType,
      eventTypes: state.eventTypes,
      onEventSelect: handleEventSelect,
      isLoading: state.isLoading,
      onCursor: handleCursor
    })
  });
}

OrganizationAuditLog.displayName = "OrganizationAuditLog";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_6__["default"])(OrganizationAuditLog));

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_views_settings_organizationAuditLog_index_tsx.269cc863a9c23785562d01369684281f.js.map