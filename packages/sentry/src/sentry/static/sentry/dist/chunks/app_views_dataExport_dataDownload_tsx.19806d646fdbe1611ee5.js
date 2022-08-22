"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_views_dataExport_dataDownload_tsx"],{

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

/***/ "./app/views/asyncView.tsx":
/*!*********************************!*\
  !*** ./app/views/asyncView.tsx ***!
  \*********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ AsyncView)
/* harmony export */ });
/* harmony import */ var sentry_components_asyncComponent__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/components/asyncComponent */ "./app/components/asyncComponent.tsx");
/* harmony import */ var sentry_components_sentryDocumentTitle__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/sentryDocumentTitle */ "./app/components/sentryDocumentTitle.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");



class AsyncView extends sentry_components_asyncComponent__WEBPACK_IMPORTED_MODULE_0__["default"] {
  getTitle() {
    return '';
  }

  render() {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)(sentry_components_sentryDocumentTitle__WEBPACK_IMPORTED_MODULE_1__["default"], {
      title: this.getTitle(),
      children: this.renderComponent()
    });
  }

}
AsyncView.displayName = "AsyncView";

/***/ }),

/***/ "./app/views/dataExport/dataDownload.tsx":
/*!***********************************************!*\
  !*** ./app/views/dataExport/dataDownload.tsx ***!
  \***********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "DownloadStatus": () => (/* binding */ DownloadStatus),
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var react_router__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! react-router */ "../node_modules/react-router/es/index.js");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_dataExport__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/dataExport */ "./app/components/dataExport.tsx");
/* harmony import */ var sentry_components_dateTime__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/dateTime */ "./app/components/dateTime.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_views_asyncView__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/views/asyncView */ "./app/views/asyncView.tsx");
/* harmony import */ var sentry_views_auth_layout__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/views/auth/layout */ "./app/views/auth/layout.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");















let DownloadStatus;

(function (DownloadStatus) {
  DownloadStatus["Early"] = "EARLY";
  DownloadStatus["Valid"] = "VALID";
  DownloadStatus["Expired"] = "EXPIRED";
})(DownloadStatus || (DownloadStatus = {}));

class DataDownload extends sentry_views_asyncView__WEBPACK_IMPORTED_MODULE_11__["default"] {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "disableErrorReport", false);
  }

  getTitle() {
    return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Download Center');
  }

  getEndpoints() {
    const {
      orgId,
      dataExportId
    } = this.props.params;
    return [['download', `/organizations/${orgId}/data-export/${dataExportId}/`]];
  }

  getActionLink(queryType) {
    const {
      orgId
    } = this.props.params;

    switch (queryType) {
      case sentry_components_dataExport__WEBPACK_IMPORTED_MODULE_6__.ExportQueryType.IssuesByTag:
        return `/organizations/${orgId}/issues/`;

      case sentry_components_dataExport__WEBPACK_IMPORTED_MODULE_6__.ExportQueryType.Discover:
        return `/organizations/${orgId}/discover/queries/`;

      default:
        return '/';
    }
  }

  renderDate(date) {
    if (!date) {
      return null;
    }

    const d = new Date(date);
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)("strong", {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_components_dateTime__WEBPACK_IMPORTED_MODULE_7__["default"], {
        date: d
      })
    });
  }

  renderEarly() {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsxs)(react__WEBPACK_IMPORTED_MODULE_3__.Fragment, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(Header, {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsxs)("h3", {
          children: [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('What are'), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)("i", {
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)(' you ')
          }), (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('doing here?')]
        })
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsxs)(Body, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)("p", {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)("Not that its any of our business, but were you invited to this page? It's just that we don't exactly remember emailing you about it.")
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)("p", {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)("Close this window and we'll email you when your download is ready.")
        })]
      })]
    });
  }

  renderExpired() {
    const {
      query
    } = this.state.download;
    const actionLink = this.getActionLink(query.type);
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsxs)(react__WEBPACK_IMPORTED_MODULE_3__.Fragment, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(Header, {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)("h3", {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('This is awkward.')
        })
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsxs)(Body, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)("p", {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)("That link expired, so your download doesn't live here anymore. Just picked up one day and left town.")
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)("p", {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Make a new one with your latest data. Your old download will never see it coming.')
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(DownloadButton, {
          href: actionLink,
          priority: "primary",
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Start a New Download')
        })]
      })]
    });
  }

  openInDiscover() {
    const {
      download: {
        query: {
          info
        }
      }
    } = this.state;
    const {
      orgId
    } = this.props.params;
    const to = {
      pathname: `/organizations/${orgId}/discover/results/`,
      query: info
    };
    react_router__WEBPACK_IMPORTED_MODULE_4__.browserHistory.push(to);
  }

  renderOpenInDiscover() {
    const {
      download: {
        query = {
          type: sentry_components_dataExport__WEBPACK_IMPORTED_MODULE_6__.ExportQueryType.IssuesByTag,
          info: {}
        }
      }
    } = this.state; // default to IssuesByTag because we don't want to
    // display this unless we're sure its a discover query

    const {
      type = sentry_components_dataExport__WEBPACK_IMPORTED_MODULE_6__.ExportQueryType.IssuesByTag
    } = query;
    return type === 'Discover' ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsxs)(react__WEBPACK_IMPORTED_MODULE_3__.Fragment, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)("p", {
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Need to make changes?')
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_5__["default"], {
        priority: "primary",
        onClick: () => this.openInDiscover(),
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Open in Discover')
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)("br", {})]
    }) : null;
  }

  renderValid() {
    const {
      download: {
        dateExpired,
        checksum
      }
    } = this.state;
    const {
      orgId,
      dataExportId
    } = this.props.params;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsxs)(react__WEBPACK_IMPORTED_MODULE_3__.Fragment, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(Header, {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)("h3", {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('All done.')
        })
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsxs)(Body, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)("p", {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)("See, that wasn't so bad. Your data is all ready for download.")
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_5__["default"], {
          priority: "primary",
          icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_8__.IconDownload, {}),
          href: `/api/0/organizations/${orgId}/data-export/${dataExportId}/?download=true`,
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Download CSV')
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsxs)("p", {
          children: [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)("That link won't last forever — it expires:"), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)("br", {}), this.renderDate(dateExpired)]
        }), this.renderOpenInDiscover(), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsxs)("p", {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)("small", {
            children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsxs)("strong", {
              children: ["SHA1:", checksum]
            })
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)("br", {}), (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.tct)('Need help verifying? [link].', {
            link: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)("a", {
              href: "https://docs.sentry.io/product/discover-queries/query-builder/#filter-by-table-columns",
              target: "_blank",
              rel: "noopener noreferrer",
              children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Check out our docs')
            })
          })]
        })]
      })]
    });
  }

  renderError() {
    var _err$responseJSON;

    const {
      errors: {
        download: err
      }
    } = this.state;
    const errDetail = err === null || err === void 0 ? void 0 : (_err$responseJSON = err.responseJSON) === null || _err$responseJSON === void 0 ? void 0 : _err$responseJSON.detail;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_views_auth_layout__WEBPACK_IMPORTED_MODULE_12__["default"], {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsxs)("main", {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(Header, {
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsxs)("h3", {
            children: [err.status, " - ", err.statusText]
          })
        }), errDetail && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(Body, {
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)("p", {
            children: errDetail
          })
        })]
      })
    });
  }

  renderContent() {
    const {
      download
    } = this.state;

    switch (download.status) {
      case DownloadStatus.Early:
        return this.renderEarly();

      case DownloadStatus.Expired:
        return this.renderExpired();

      default:
        return this.renderValid();
    }
  }

  renderBody() {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_views_auth_layout__WEBPACK_IMPORTED_MODULE_12__["default"], {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)("main", {
        children: this.renderContent()
      })
    });
  }

}

const Header = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('header',  true ? {
  target: "eq2c1c22"
} : 0)("border-bottom:1px solid ", p => p.theme.border, ";padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_10__["default"])(3), " 40px 0;h3{font-size:24px;margin:0 0 ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_10__["default"])(3), " 0;}" + ( true ? "" : 0));

const Body = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "eq2c1c21"
} : 0)("padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_10__["default"])(2), " 40px;max-width:500px;p{margin:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_10__["default"])(1.5), " 0;}" + ( true ? "" : 0));

const DownloadButton = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_button__WEBPACK_IMPORTED_MODULE_5__["default"],  true ? {
  target: "eq2c1c20"
} : 0)("margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_10__["default"])(1.5), ";" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (DataDownload);

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_views_dataExport_dataDownload_tsx.fe9fca60526e676d67910b1725937e84.js.map