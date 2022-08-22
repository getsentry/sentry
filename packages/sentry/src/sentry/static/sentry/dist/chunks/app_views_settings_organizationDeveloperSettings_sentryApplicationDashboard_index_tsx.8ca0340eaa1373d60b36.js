"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_views_settings_organizationDeveloperSettings_sentryApplicationDashboard_index_tsx"],{

/***/ "./app/components/charts/lineChart.tsx":
/*!*********************************************!*\
  !*** ./app/components/charts/lineChart.tsx ***!
  \*********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "LineChart": () => (/* binding */ LineChart)
/* harmony export */ });
/* harmony import */ var _series_lineSeries__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./series/lineSeries */ "./app/components/charts/series/lineSeries.tsx");
/* harmony import */ var _baseChart__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./baseChart */ "./app/components/charts/baseChart.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");



function LineChart(_ref) {
  let {
    series,
    seriesOptions,
    ...props
  } = _ref;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)(_baseChart__WEBPACK_IMPORTED_MODULE_1__["default"], { ...props,
    series: series.map(_ref2 => {
      let {
        seriesName,
        data,
        dataArray,
        ...options
      } = _ref2;
      return (0,_series_lineSeries__WEBPACK_IMPORTED_MODULE_0__["default"])({ ...seriesOptions,
        ...options,
        name: seriesName,
        data: dataArray || (data === null || data === void 0 ? void 0 : data.map(_ref3 => {
          let {
            value,
            name
          } = _ref3;
          return [name, value];
        })),
        animation: false,
        animationThreshold: 1,
        animationDuration: 0
      });
    })
  });
}
LineChart.displayName = "LineChart";

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

/***/ "./app/views/settings/organizationDeveloperSettings/sentryApplicationDashboard/index.tsx":
/*!***********************************************************************************************!*\
  !*** ./app/views/settings/organizationDeveloperSettings/sentryApplicationDashboard/index.tsx ***!
  \***********************************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ SentryApplicationDashboard)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_charts_barChart__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/charts/barChart */ "./app/components/charts/barChart.tsx");
/* harmony import */ var sentry_components_charts_lineChart__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/charts/lineChart */ "./app/components/charts/lineChart.tsx");
/* harmony import */ var sentry_components_dateTime__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/dateTime */ "./app/components/dateTime.tsx");
/* harmony import */ var sentry_components_links_link__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/links/link */ "./app/components/links/link.tsx");
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_views_asyncView__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/views/asyncView */ "./app/views/asyncView.tsx");
/* harmony import */ var sentry_views_settings_components_settingsPageHeader__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/views/settings/components/settingsPageHeader */ "./app/views/settings/components/settingsPageHeader.tsx");
/* harmony import */ var _requestLog__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! ./requestLog */ "./app/views/settings/organizationDeveloperSettings/sentryApplicationDashboard/requestLog.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }














class SentryApplicationDashboard extends sentry_views_asyncView__WEBPACK_IMPORTED_MODULE_9__["default"] {
  getEndpoints() {
    const {
      appSlug
    } = this.props.params; // Default time range for now: 90 days ago to now

    const now = Math.floor(new Date().getTime() / 1000);
    const ninety_days_ago = 3600 * 24 * 90;
    return [['stats', `/sentry-apps/${appSlug}/stats/`, {
      query: {
        since: now - ninety_days_ago,
        until: now
      }
    }], ['interactions', `/sentry-apps/${appSlug}/interaction/`, {
      query: {
        since: now - ninety_days_ago,
        until: now
      }
    }], ['app', `/sentry-apps/${appSlug}/`]];
  }

  getTitle() {
    return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Integration Dashboard');
  }

  renderInstallData() {
    const {
      app,
      stats
    } = this.state;
    const {
      totalUninstalls,
      totalInstalls
    } = stats;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsxs)(react__WEBPACK_IMPORTED_MODULE_1__.Fragment, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)("h5", {
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Installation & Interaction Data')
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsxs)(Row, {
        children: [app.datePublished ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsxs)(StatsSection, {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(StatsHeader, {
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Date published')
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(sentry_components_dateTime__WEBPACK_IMPORTED_MODULE_4__["default"], {
            dateOnly: true,
            date: app.datePublished
          })]
        }) : null, (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsxs)(StatsSection, {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(StatsHeader, {
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Total installs')
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)("p", {
            children: totalInstalls
          })]
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsxs)(StatsSection, {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(StatsHeader, {
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Total uninstalls')
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)("p", {
            children: totalUninstalls
          })]
        })]
      }), this.renderInstallCharts()]
    });
  }

  renderInstallCharts() {
    const {
      installStats,
      uninstallStats
    } = this.state.stats;
    const installSeries = {
      data: installStats.map(point => ({
        name: point[0] * 1000,
        value: point[1]
      })),
      seriesName: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('installed')
    };
    const uninstallSeries = {
      data: uninstallStats.map(point => ({
        name: point[0] * 1000,
        value: point[1]
      })),
      seriesName: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('uninstalled')
    };
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsxs)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_6__.Panel, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_6__.PanelHeader, {
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Installations/Uninstallations over Last 90 Days')
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(ChartWrapper, {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(sentry_components_charts_barChart__WEBPACK_IMPORTED_MODULE_2__.BarChart, {
          series: [installSeries, uninstallSeries],
          height: 150,
          stacked: true,
          isGroupedByDate: true,
          legend: {
            show: true,
            orient: 'horizontal',
            data: ['installed', 'uninstalled'],
            itemWidth: 15
          },
          yAxis: {
            type: 'value',
            minInterval: 1,
            max: 'dataMax'
          },
          xAxis: {
            type: 'time'
          },
          grid: {
            left: (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_8__["default"])(4),
            right: (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_8__["default"])(4)
          }
        })
      })]
    });
  }

  renderIntegrationViews() {
    const {
      views
    } = this.state.interactions;
    const {
      appSlug,
      orgId
    } = this.props.params;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsxs)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_6__.Panel, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_6__.PanelHeader, {
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Integration Views')
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_6__.PanelBody, {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(InteractionsChart, {
          data: {
            Views: views
          }
        })
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_6__.PanelFooter, {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsxs)(StyledFooter, {
          children: [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Integration views are measured through views on the '), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(sentry_components_links_link__WEBPACK_IMPORTED_MODULE_5__["default"], {
            to: `/sentry-apps/${appSlug}/external-install/`,
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('external installation page')
          }), (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)(' and views on the Learn More/Install modal on the '), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(sentry_components_links_link__WEBPACK_IMPORTED_MODULE_5__["default"], {
            to: `/settings/${orgId}/integrations/`,
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('integrations page')
          })]
        })
      })]
    });
  }

  renderComponentInteractions() {
    const {
      componentInteractions
    } = this.state.interactions;
    const componentInteractionsDetails = {
      'stacktrace-link': (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Each link click or context menu open counts as one interaction'),
      'issue-link': (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Each open of the issue link modal counts as one interaction')
    };
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsxs)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_6__.Panel, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_6__.PanelHeader, {
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Component Interactions')
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_6__.PanelBody, {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(InteractionsChart, {
          data: componentInteractions
        })
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_6__.PanelFooter, {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(StyledFooter, {
          children: Object.keys(componentInteractions).map((component, idx) => componentInteractionsDetails[component] && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsxs)(react__WEBPACK_IMPORTED_MODULE_1__.Fragment, {
            children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)("strong", {
              children: `${component}: `
            }), componentInteractionsDetails[component], (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)("br", {})]
          }, idx))
        })
      })]
    });
  }

  renderBody() {
    const {
      app
    } = this.state;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsxs)("div", {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(sentry_views_settings_components_settingsPageHeader__WEBPACK_IMPORTED_MODULE_10__["default"], {
        title: `${(0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Integration Dashboard')} - ${app.name}`
      }), app.status === 'published' && this.renderInstallData(), app.status === 'published' && this.renderIntegrationViews(), app.schema.elements && this.renderComponentInteractions(), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(_requestLog__WEBPACK_IMPORTED_MODULE_11__["default"], {
        app: app
      })]
    });
  }

}

const InteractionsChart = _ref => {
  let {
    data
  } = _ref;
  const elementInteractionsSeries = Object.keys(data).map(key => {
    const seriesData = data[key].map(point => ({
      value: point[1],
      name: point[0] * 1000
    }));
    return {
      seriesName: key,
      data: seriesData
    };
  });
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(ChartWrapper, {
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_12__.jsx)(sentry_components_charts_lineChart__WEBPACK_IMPORTED_MODULE_3__.LineChart, {
      isGroupedByDate: true,
      series: elementInteractionsSeries,
      grid: {
        left: (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_8__["default"])(4),
        right: (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_8__["default"])(4)
      },
      legend: {
        show: true,
        orient: 'horizontal',
        data: Object.keys(data)
      }
    })
  });
};

InteractionsChart.displayName = "InteractionsChart";

const Row = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1b7k1wi4"
} : 0)( true ? {
  name: "zjik7",
  styles: "display:flex"
} : 0);

const StatsSection = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1b7k1wi3"
} : 0)("margin-right:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_8__["default"])(4), ";" + ( true ? "" : 0));

const StatsHeader = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('h6',  true ? {
  target: "e1b7k1wi2"
} : 0)("margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_8__["default"])(1), ";font-size:12px;text-transform:uppercase;color:", p => p.theme.subText, ";" + ( true ? "" : 0));

const StyledFooter = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1b7k1wi1"
} : 0)("padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_8__["default"])(1.5), ";" + ( true ? "" : 0));

const ChartWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1b7k1wi0"
} : 0)("padding-top:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_8__["default"])(3), ";" + ( true ? "" : 0));

/***/ }),

/***/ "./app/views/settings/organizationDeveloperSettings/sentryApplicationDashboard/requestLog.tsx":
/*!****************************************************************************************************!*\
  !*** ./app/views/settings/organizationDeveloperSettings/sentryApplicationDashboard/requestLog.tsx ***!
  \****************************************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ RequestLog)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var lodash_memoize__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! lodash/memoize */ "../node_modules/lodash/memoize.js");
/* harmony import */ var lodash_memoize__WEBPACK_IMPORTED_MODULE_5___default = /*#__PURE__*/__webpack_require__.n(lodash_memoize__WEBPACK_IMPORTED_MODULE_5__);
/* harmony import */ var sentry_components_asyncComponent__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/asyncComponent */ "./app/components/asyncComponent.tsx");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_checkbox__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/checkbox */ "./app/components/checkbox.tsx");
/* harmony import */ var sentry_components_dateTime__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/dateTime */ "./app/components/dateTime.tsx");
/* harmony import */ var sentry_components_forms_compactSelect__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/forms/compactSelect */ "./app/components/forms/compactSelect.tsx");
/* harmony import */ var sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/components/links/externalLink */ "./app/components/links/externalLink.tsx");
/* harmony import */ var sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/components/loadingIndicator */ "./app/components/loadingIndicator.tsx");
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var sentry_components_tag__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/components/tag */ "./app/components/tag.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_dates__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! sentry/utils/dates */ "./app/utils/dates.tsx");
/* harmony import */ var sentry_views_settings_components_emptyMessage__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! sentry/views/settings/components/emptyMessage */ "./app/views/settings/components/emptyMessage.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");





function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }



















const ALL_EVENTS = (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('All Events');
const MAX_PER_PAGE = 10;
const is24Hours = (0,sentry_utils_dates__WEBPACK_IMPORTED_MODULE_18__.shouldUse24Hours)();

const componentHasSelectUri = issueLinkComponent => {
  const hasSelectUri = fields => fields.some(field => field.type === 'select' && 'uri' in field);

  const createHasSelectUri = hasSelectUri(issueLinkComponent.create.required_fields) || hasSelectUri(issueLinkComponent.create.optional_fields || []);
  const linkHasSelectUri = hasSelectUri(issueLinkComponent.link.required_fields) || hasSelectUri(issueLinkComponent.link.optional_fields || []);
  return createHasSelectUri || linkHasSelectUri;
};

const getEventTypes = lodash_memoize__WEBPACK_IMPORTED_MODULE_5___default()(app => {
  // TODO(nola): ideally this would be kept in sync with EXTENDED_VALID_EVENTS on the backend
  let issueLinkEvents = [];
  const issueLinkComponent = (app.schema.elements || []).find(element => element.type === 'issue-link');

  if (issueLinkComponent) {
    issueLinkEvents = ['external_issue.created', 'external_issue.linked'];

    if (componentHasSelectUri(issueLinkComponent)) {
      issueLinkEvents.push('select_options.requested');
    }
  }

  const events = [ALL_EVENTS, // Internal apps don't have installation webhooks
  ...(app.status !== 'internal' ? ['installation.created', 'installation.deleted'] : []), ...(app.events.includes('error') ? ['error.created'] : []), ...(app.events.includes('issue') ? ['issue.created', 'issue.resolved', 'issue.ignored', 'issue.assigned'] : []), ...(app.isAlertable ? ['event_alert.triggered', 'metric_alert.open', 'metric_alert.resolved', 'metric_alert.critical', 'metric_alert.warning'] : []), ...issueLinkEvents];
  return events;
});

const ResponseCode = _ref => {
  let {
    code
  } = _ref;
  let type = 'error';

  if (code <= 399 && code >= 300) {
    type = 'warning';
  } else if (code <= 299 && code >= 100) {
    type = 'success';
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(Tags, {
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(StyledTag, {
      type: type,
      children: code === 0 ? 'timeout' : code
    })
  });
};

ResponseCode.displayName = "ResponseCode";

const TimestampLink = _ref2 => {
  let {
    date,
    link
  } = _ref2;
  return link ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsxs)(sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_11__["default"], {
    href: link,
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_dateTime__WEBPACK_IMPORTED_MODULE_9__["default"], {
      date: date
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(StyledIconOpen, {
      size: "12px"
    })]
  }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_dateTime__WEBPACK_IMPORTED_MODULE_9__["default"], {
    date: date,
    format: is24Hours ? 'MMM D, YYYY HH:mm:ss z' : 'll LTS z'
  });
};

class RequestLog extends sentry_components_asyncComponent__WEBPACK_IMPORTED_MODULE_6__["default"] {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "shouldReload", true);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleChangeEventType", eventType => {
      this.setState({
        eventType,
        currentPage: 0
      }, this.remountComponent);
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleChangeErrorsOnly", () => {
      this.setState({
        errorsOnly: !this.state.errorsOnly,
        currentPage: 0
      }, this.remountComponent);
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleNextPage", () => {
      this.setState({
        currentPage: this.state.currentPage + 1
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handlePrevPage", () => {
      this.setState({
        currentPage: this.state.currentPage - 1
      });
    });
  }

  get hasNextPage() {
    return (this.state.currentPage + 1) * MAX_PER_PAGE < this.state.requests.length;
  }

  get hasPrevPage() {
    return this.state.currentPage > 0;
  }

  getEndpoints() {
    const {
      slug
    } = this.props.app;
    const query = {};

    if (this.state) {
      if (this.state.eventType !== ALL_EVENTS) {
        query.eventType = this.state.eventType;
      }

      if (this.state.errorsOnly) {
        query.errorsOnly = true;
      }
    }

    return [['requests', `/sentry-apps/${slug}/requests/`, {
      query
    }]];
  }

  getDefaultState() {
    return { ...super.getDefaultState(),
      requests: [],
      eventType: ALL_EVENTS,
      errorsOnly: false,
      currentPage: 0
    };
  }

  renderLoading() {
    return this.renderBody();
  }

  renderBody() {
    const {
      requests,
      eventType,
      errorsOnly,
      currentPage
    } = this.state;
    const {
      app
    } = this.props;
    const currentRequests = requests.slice(currentPage * MAX_PER_PAGE, (currentPage + 1) * MAX_PER_PAGE);
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsxs)(react__WEBPACK_IMPORTED_MODULE_4__.Fragment, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)("h5", {
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('Request Log')
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsxs)("div", {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)("p", {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('This log shows the status of any outgoing webhook requests from Sentry to your integration.')
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsxs)(RequestLogFilters, {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_forms_compactSelect__WEBPACK_IMPORTED_MODULE_10__["default"], {
            triggerLabel: eventType,
            value: eventType,
            options: getEventTypes(app).map(type => ({
              value: type,
              label: type
            })),
            onChange: opt => this.handleChangeEventType(opt === null || opt === void 0 ? void 0 : opt.value)
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(StyledErrorsOnlyButton, {
            onClick: this.handleChangeErrorsOnly,
            children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsxs)(ErrorsOnlyCheckbox, {
              children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_checkbox__WEBPACK_IMPORTED_MODULE_8__["default"], {
                checked: errorsOnly,
                onChange: () => {}
              }), (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('Errors Only')]
            })
          })]
        })]
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsxs)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_13__.Panel, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_13__.PanelHeader, {
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsxs)(TableLayout, {
            hasOrganization: app.status !== 'internal',
            children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)("div", {
              children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('Time')
            }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)("div", {
              children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('Status Code')
            }), app.status !== 'internal' && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)("div", {
              children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('Organization')
            }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)("div", {
              children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('Event Type')
            }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)("div", {
              children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('Webhook URL')
            })]
          })
        }), !this.state.loading ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_13__.PanelBody, {
          children: currentRequests.length > 0 ? currentRequests.map((request, idx) => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_13__.PanelItem, {
            children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsxs)(TableLayout, {
              hasOrganization: app.status !== 'internal',
              children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(TimestampLink, {
                date: request.date,
                link: request.errorUrl
              }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(ResponseCode, {
                code: request.responseCode
              }), app.status !== 'internal' && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)("div", {
                children: request.organization ? request.organization.name : null
              }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)("div", {
                children: request.eventType
              }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(OverflowBox, {
                children: request.webhookUrl
              })]
            })
          }, idx)) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_views_settings_components_emptyMessage__WEBPACK_IMPORTED_MODULE_19__["default"], {
            icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_15__.IconFlag, {
              size: "xl"
            }),
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('No requests found in the last 30 days.')
          })
        }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_12__["default"], {})]
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsxs)(PaginationButtons, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_7__["default"], {
          icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_15__.IconChevron, {
            direction: "left",
            size: "sm"
          }),
          onClick: this.handlePrevPage,
          disabled: !this.hasPrevPage,
          "aria-label": (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('Previous page')
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_7__["default"], {
          icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_20__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_15__.IconChevron, {
            direction: "right",
            size: "sm"
          }),
          onClick: this.handleNextPage,
          disabled: !this.hasNextPage,
          "aria-label": (0,sentry_locale__WEBPACK_IMPORTED_MODULE_16__.t)('Next page')
        })]
      })]
    });
  }

}

const TableLayout = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "ev8k1zo8"
} : 0)("display:grid;grid-template-columns:1fr 0.5fr ", p => p.hasOrganization ? '1fr' : '', " 1fr 1fr;grid-column-gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_17__["default"])(1.5), ";width:100%;align-items:center;" + ( true ? "" : 0));

const OverflowBox = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "ev8k1zo7"
} : 0)( true ? {
  name: "1sdjnkx",
  styles: "word-break:break-word"
} : 0);

const PaginationButtons = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "ev8k1zo6"
} : 0)( true ? {
  name: "6izmta",
  styles: "display:flex;justify-content:flex-end;align-items:center;>:first-child{border-top-right-radius:0;border-bottom-right-radius:0;}>:nth-child(2){margin-left:-1px;border-top-left-radius:0;border-bottom-left-radius:0;}"
} : 0);

const RequestLogFilters = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "ev8k1zo5"
} : 0)("display:flex;align-items:center;padding-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_17__["default"])(1), ";>:first-child ", sentry_components_button__WEBPACK_IMPORTED_MODULE_7__.StyledButton, "{border-radius:", p => p.theme.borderRadiusLeft, ";}" + ( true ? "" : 0));

const ErrorsOnlyCheckbox = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "ev8k1zo4"
} : 0)("input{margin:0 ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_17__["default"])(1), " 0 0;}display:flex;align-items:center;" + ( true ? "" : 0));

const StyledErrorsOnlyButton = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_button__WEBPACK_IMPORTED_MODULE_7__["default"],  true ? {
  target: "ev8k1zo3"
} : 0)( true ? {
  name: "9aiwao",
  styles: "margin-left:-1px;border-top-left-radius:0;border-bottom-left-radius:0"
} : 0);

const StyledIconOpen = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_icons__WEBPACK_IMPORTED_MODULE_15__.IconOpen,  true ? {
  target: "ev8k1zo2"
} : 0)("margin-left:6px;color:", p => p.theme.subText, ";" + ( true ? "" : 0));

const Tags = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "ev8k1zo1"
} : 0)("margin:-", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_17__["default"])(0.5), ";" + ( true ? "" : 0));

const StyledTag = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_tag__WEBPACK_IMPORTED_MODULE_14__["default"],  true ? {
  target: "ev8k1zo0"
} : 0)("padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_17__["default"])(0.5), ";display:inline-flex;" + ( true ? "" : 0));

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_views_settings_organizationDeveloperSettings_sentryApplicationDashboard_index_tsx.b7b420b74cd42bf0af6b9d8ced415008.js.map