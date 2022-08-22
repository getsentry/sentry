"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_views_projectsDashboard_index_tsx"],{

/***/ "./app/components/resourceCard.tsx":
/*!*****************************************!*\
  !*** ./app/components/resourceCard.tsx ***!
  \*****************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/links/externalLink */ "./app/components/links/externalLink.tsx");
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_analytics__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/utils/analytics */ "./app/utils/analytics.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }








const ResourceCard = _ref => {
  let {
    title,
    link,
    imgUrl
  } = _ref;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(ResourceCardWrapper, {
    onClick: () => (0,sentry_utils_analytics__WEBPACK_IMPORTED_MODULE_4__.analytics)('orgdash.resource_clicked', {
      link,
      title
    }),
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsxs)(StyledLink, {
      href: link,
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(StyledImg, {
        src: imgUrl,
        alt: title
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)(StyledTitle, {
        children: title
      })]
    })
  });
};

ResourceCard.displayName = "ResourceCard";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (ResourceCard);

const ResourceCardWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_panels__WEBPACK_IMPORTED_MODULE_2__.Panel,  true ? {
  target: "e7kb6ei3"
} : 0)("display:flex;flex:1;align-items:center;padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_3__["default"])(3), ";margin-bottom:0;" + ( true ? "" : 0));

const StyledLink = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_1__["default"],  true ? {
  target: "e7kb6ei2"
} : 0)( true ? {
  name: "82a6rk",
  styles: "flex:1"
} : 0);

const StyledImg = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('img',  true ? {
  target: "e7kb6ei1"
} : 0)("display:block;margin:0 auto ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_3__["default"])(3), " auto;height:160px;" + ( true ? "" : 0));

const StyledTitle = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e7kb6ei0"
} : 0)("color:", p => p.theme.textColor, ";font-size:", p => p.theme.fontSizeLarge, ";text-align:center;font-weight:bold;" + ( true ? "" : 0));

/***/ }),

/***/ "./app/utils/getProjectsByTeams.tsx":
/*!******************************************!*\
  !*** ./app/utils/getProjectsByTeams.tsx ***!
  \******************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ getProjectsByTeams)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);

function getProjectsByTeams(teams, projects) {
  let isSuperuser = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : false;
  const projectsByTeam = {};
  const teamlessProjects = [];
  let usersTeams = new Set(teams.filter(team => team.isMember).map(team => team.slug));

  if (usersTeams.size === 0 && isSuperuser) {
    usersTeams = new Set(teams.map(team => team.slug));
  }

  projects.forEach(project => {
    if (!project.teams.length && project.isMember) {
      teamlessProjects.push(project);
    } else {
      project.teams.forEach(team => {
        if (!usersTeams.has(team.slug)) {
          return;
        }

        if (!projectsByTeam.hasOwnProperty(team.slug)) {
          projectsByTeam[team.slug] = [];
        }

        projectsByTeam[team.slug].push(project);
      });
    }
  });
  return {
    projectsByTeam,
    teamlessProjects
  };
}

/***/ }),

/***/ "./app/utils/withTeamsForUser.tsx":
/*!****************************************!*\
  !*** ./app/utils/withTeamsForUser.tsx ***!
  \****************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_stores_configStore__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/stores/configStore */ "./app/stores/configStore.tsx");
/* harmony import */ var sentry_utils_getDisplayName__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/utils/getDisplayName */ "./app/utils/getDisplayName.tsx");
/* harmony import */ var sentry_utils_getProjectsByTeams__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/utils/getProjectsByTeams */ "./app/utils/getProjectsByTeams.tsx");
/* harmony import */ var _analytics__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! ./analytics */ "./app/utils/analytics.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");






 // We require these props when using this HOC



const withTeamsForUser = WrappedComponent => {
  var _class;

  return _class = class extends react__WEBPACK_IMPORTED_MODULE_2__.Component {
    constructor() {
      super(...arguments);

      (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", {
        teams: [],
        loadingTeams: true,
        error: null
      });
    }

    componentDidMount() {
      this.fetchTeams();
    }

    async fetchTeams() {
      this.setState({
        loadingTeams: true
      });

      try {
        _analytics__WEBPACK_IMPORTED_MODULE_6__.metric.mark({
          name: 'user-teams-fetch-start'
        });
        const teamsWithProjects = await this.props.api.requestPromise(this.getUsersTeamsEndpoint());
        this.setState({
          teams: teamsWithProjects,
          loadingTeams: false
        }, () => {
          _analytics__WEBPACK_IMPORTED_MODULE_6__.metric.measure({
            name: 'app.component.perf',
            start: 'user-teams-fetch-start',
            data: {
              name: 'user-teams',
              route: '/organizations/:orgid/user-teams',
              organization_id: parseInt(this.props.organization.id, 10)
            }
          });
        });
      } catch (error) {
        this.setState({
          error,
          loadingTeams: false
        });
      }
    }

    populateTeamsWithProjects(teams, projects) {
      const {
        isSuperuser
      } = sentry_stores_configStore__WEBPACK_IMPORTED_MODULE_3__["default"].get('user');
      const {
        projectsByTeam
      } = (0,sentry_utils_getProjectsByTeams__WEBPACK_IMPORTED_MODULE_5__["default"])(teams, projects, isSuperuser);
      const teamsWithProjects = teams.map(team => {
        const teamProjects = projectsByTeam[team.slug] || [];
        return { ...team,
          projects: teamProjects
        };
      });
      this.setState({
        teams: teamsWithProjects,
        loadingTeams: false
      });
    }

    getUsersTeamsEndpoint() {
      return `/organizations/${this.props.organization.slug}/user-teams/`;
    }

    render() {
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(WrappedComponent, { ...this.props,
        ...this.state
      });
    }

  }, (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(_class, "displayName", `withUsersTeams(${(0,sentry_utils_getDisplayName__WEBPACK_IMPORTED_MODULE_4__["default"])(WrappedComponent)})`), _class;
};

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (withTeamsForUser);

/***/ }),

/***/ "./app/views/projectsDashboard/chart.tsx":
/*!***********************************************!*\
  !*** ./app/views/projectsDashboard/chart.tsx ***!
  \***********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var _emotion_react__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! @emotion/react */ "../node_modules/@emotion/react/dist/emotion-element-cbed451f.browser.esm.js");
/* harmony import */ var sentry_components_charts_baseChart__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/charts/baseChart */ "./app/components/charts/baseChart.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_discover_charts__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/utils/discover/charts */ "./app/utils/discover/charts.tsx");
/* harmony import */ var _noEvents__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ./noEvents */ "./app/views/projectsDashboard/noEvents.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");










const Chart = _ref => {
  let {
    firstEvent,
    stats,
    transactionStats
  } = _ref;
  const series = [];
  const hasTransactions = transactionStats !== undefined;
  const theme = (0,_emotion_react__WEBPACK_IMPORTED_MODULE_6__.a)();

  if (transactionStats) {
    const transactionSeries = transactionStats.map(_ref2 => {
      let [timestamp, value] = _ref2;
      return [timestamp * 1000, value];
    });
    series.push({
      cursor: 'normal',
      name: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Transactions'),
      type: 'bar',
      data: transactionSeries,
      barMinHeight: 1,
      xAxisIndex: 1,
      yAxisIndex: 1,
      itemStyle: {
        color: theme.gray200,
        opacity: 0.8
      },
      emphasis: {
        itemStyle: {
          color: theme.gray200,
          opacity: 1.0
        }
      }
    });
  }

  if (stats) {
    series.push({
      cursor: 'normal',
      name: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Errors'),
      type: 'bar',
      data: stats.map(_ref3 => {
        let [timestamp, value] = _ref3;
        return [timestamp * 1000, value];
      }),
      barMinHeight: 1,
      xAxisIndex: 0,
      yAxisIndex: 0,
      itemStyle: {
        color: theme.purple300,
        opacity: 0.6
      },
      emphasis: {
        itemStyle: {
          color: theme.purple300,
          opacity: 0.8
        }
      }
    });
  }

  const grid = hasTransactions ? [{
    top: 10,
    bottom: 60,
    left: 2,
    right: 2
  }, {
    top: 105,
    bottom: 0,
    left: 2,
    right: 2
  }] : [{
    top: 10,
    bottom: 0,
    left: 2,
    right: 2
  }];
  const chartOptions = {
    series,
    colors: [],
    height: 150,
    isGroupedByDate: true,
    showTimeInTooltip: true,
    grid,
    tooltip: {
      trigger: 'axis'
    },
    xAxes: Array.from(new Array(series.length)).map((_i, index) => ({
      gridIndex: index,
      axisLine: {
        show: false
      },
      axisTick: {
        show: false
      },
      axisLabel: {
        show: false
      },
      axisPointer: {
        type: 'line',
        label: {
          show: false
        },
        lineStyle: {
          width: 0
        }
      }
    })),
    yAxes: Array.from(new Array(series.length)).map((_i, index) => ({
      gridIndex: index,
      interval: Infinity,

      max(value) {
        // This keeps small datasets from looking 'scary'
        // by having full bars for < 10 values.
        return Math.max(10, value.max);
      },

      axisLabel: {
        margin: 2,
        showMaxLabel: true,
        showMinLabel: false,
        color: theme.chartLabel,
        fontFamily: theme.text.family,
        inside: true,
        lineHeight: 12,
        formatter: value => (0,sentry_utils_discover_charts__WEBPACK_IMPORTED_MODULE_4__.axisLabelFormatter)(value, 'number', true),
        textBorderColor: theme.backgroundSecondary,
        textBorderWidth: 1
      },
      splitLine: {
        show: false
      },
      zlevel: theme.zIndex.header
    })),
    axisPointer: {
      // Link each x-axis together.
      link: [{
        xAxisIndex: [0, 1]
      }]
    },
    options: {
      animation: false
    }
  };
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsxs)(react__WEBPACK_IMPORTED_MODULE_1__.Fragment, {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(sentry_components_charts_baseChart__WEBPACK_IMPORTED_MODULE_2__["default"], { ...chartOptions
    }), !firstEvent && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(_noEvents__WEBPACK_IMPORTED_MODULE_5__["default"], {
      seriesCount: series.length
    })]
  });
};

Chart.displayName = "Chart";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (Chart);

/***/ }),

/***/ "./app/views/projectsDashboard/deploys.tsx":
/*!*************************************************!*\
  !*** ./app/views/projectsDashboard/deploys.tsx ***!
  \*************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "DeployRows": () => (/* binding */ DeployRows),
/* harmony export */   "GetStarted": () => (/* binding */ GetStarted),
/* harmony export */   "TextOverflow": () => (/* reexport safe */ sentry_components_textOverflow__WEBPACK_IMPORTED_MODULE_4__["default"]),
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_textOverflow__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/textOverflow */ "./app/components/textOverflow.tsx");
/* harmony import */ var sentry_components_timeSince__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/timeSince */ "./app/components/timeSince.tsx");
/* harmony import */ var sentry_components_version__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/version */ "./app/components/version.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_getDynamicText__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/utils/getDynamicText */ "./app/utils/getDynamicText.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");



function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }












const DEPLOY_COUNT = 2;

const Deploys = _ref => {
  let {
    project,
    shorten
  } = _ref;
  const flattenedDeploys = Object.entries(project.latestDeploys || {}).map(_ref2 => {
    let [environment, value] = _ref2;
    return {
      environment,
      ...value
    };
  });
  const deploys = (flattenedDeploys || []).sort((a, b) => new Date(b.dateFinished).getTime() - new Date(a.dateFinished).getTime()).slice(0, DEPLOY_COUNT);

  if (!deploys.length) {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(NoDeploys, {});
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(DeployRows, {
    children: deploys.map(deploy => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(Deploy, {
      deploy: deploy,
      project: project,
      shorten: shorten
    }, `${deploy.environment}-${deploy.version}`))
  });
};

Deploys.displayName = "Deploys";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (Deploys);

const Deploy = _ref3 => {
  let {
    deploy,
    project,
    shorten
  } = _ref3;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsxs)(react__WEBPACK_IMPORTED_MODULE_2__.Fragment, {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_7__.IconReleases, {
      size: "sm"
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsxs)(sentry_components_textOverflow__WEBPACK_IMPORTED_MODULE_4__["default"], {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(Environment, {
        children: deploy.environment
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_components_version__WEBPACK_IMPORTED_MODULE_6__["default"], {
        version: deploy.version,
        projectId: project.id,
        tooltipRawVersion: true,
        truncate: true
      })]
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(DeployTime, {
      children: (0,sentry_utils_getDynamicText__WEBPACK_IMPORTED_MODULE_10__["default"])({
        fixed: '3 hours ago',
        value: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_components_timeSince__WEBPACK_IMPORTED_MODULE_5__["default"], {
          date: deploy.dateFinished,
          shorten: shorten ? shorten : false
        })
      })
    })]
  });
};

Deploy.displayName = "Deploy";

const NoDeploys = () => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(GetStarted, {
  children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_3__["default"], {
    size: "sm",
    href: "https://docs.sentry.io/product/releases/",
    external: true,
    children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('Track Deploys')
  })
});

NoDeploys.displayName = "NoDeploys";

const DeployContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1nt7vv34"
} : 0)("padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__["default"])(2), ";height:115px;" + ( true ? "" : 0));

const DeployRows = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(DeployContainer,  true ? {
  target: "e1nt7vv33"
} : 0)("display:grid;grid-template-columns:30px 1fr 1fr;grid-template-rows:auto;grid-column-gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__["default"])(1), ";grid-row-gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__["default"])(1), ";font-size:", p => p.theme.fontSizeMedium, ";line-height:1.2;" + ( true ? "" : 0));

const Environment = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1nt7vv32"
} : 0)("color:", p => p.theme.textColor, ";margin:0;" + ( true ? "" : 0));

const DeployTime = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1nt7vv31"
} : 0)("color:", p => p.theme.gray300, ";overflow:hidden;text-align:right;text-overflow:ellipsis;" + ( true ? "" : 0));

const GetStarted = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(DeployContainer,  true ? {
  target: "e1nt7vv30"
} : 0)( true ? {
  name: "1wnowod",
  styles: "display:flex;align-items:center;justify-content:center"
} : 0);



/***/ }),

/***/ "./app/views/projectsDashboard/index.tsx":
/*!***********************************************!*\
  !*** ./app/views/projectsDashboard/index.tsx ***!
  \***********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "Dashboard": () => (/* binding */ Dashboard),
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var react_lazyload__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! react-lazyload */ "../node_modules/react-lazyload/lib/index.js");
/* harmony import */ var _sentry_react__WEBPACK_IMPORTED_MODULE_30__ = __webpack_require__(/*! @sentry/react */ "../node_modules/@sentry/react/esm/profiler.js");
/* harmony import */ var lodash_debounce__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! lodash/debounce */ "../node_modules/lodash/debounce.js");
/* harmony import */ var lodash_debounce__WEBPACK_IMPORTED_MODULE_5___default = /*#__PURE__*/__webpack_require__.n(lodash_debounce__WEBPACK_IMPORTED_MODULE_5__);
/* harmony import */ var lodash_flatten__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! lodash/flatten */ "../node_modules/lodash/flatten.js");
/* harmony import */ var lodash_flatten__WEBPACK_IMPORTED_MODULE_6___default = /*#__PURE__*/__webpack_require__.n(lodash_flatten__WEBPACK_IMPORTED_MODULE_6__);
/* harmony import */ var lodash_uniqBy__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! lodash/uniqBy */ "../node_modules/lodash/uniqBy.js");
/* harmony import */ var lodash_uniqBy__WEBPACK_IMPORTED_MODULE_7___default = /*#__PURE__*/__webpack_require__.n(lodash_uniqBy__WEBPACK_IMPORTED_MODULE_7__);
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/layouts/thirds */ "./app/components/layouts/thirds.tsx");
/* harmony import */ var sentry_components_loadingError__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/loadingError */ "./app/components/loadingError.tsx");
/* harmony import */ var sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/components/loadingIndicator */ "./app/components/loadingIndicator.tsx");
/* harmony import */ var sentry_components_noProjectMessage__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/components/noProjectMessage */ "./app/components/noProjectMessage.tsx");
/* harmony import */ var sentry_components_pageHeading__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/components/pageHeading */ "./app/components/pageHeading.tsx");
/* harmony import */ var sentry_components_searchBar__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/components/searchBar */ "./app/components/searchBar.tsx");
/* harmony import */ var sentry_components_sentryDocumentTitle__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/components/sentryDocumentTitle */ "./app/components/sentryDocumentTitle.tsx");
/* harmony import */ var sentry_constants__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/constants */ "./app/constants/index.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_stores_projectsStatsStore__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! sentry/stores/projectsStatsStore */ "./app/stores/projectsStatsStore.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_20__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_21__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");
/* harmony import */ var sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_22__ = __webpack_require__(/*! sentry/utils/withApi */ "./app/utils/withApi.tsx");
/* harmony import */ var sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_23__ = __webpack_require__(/*! sentry/utils/withOrganization */ "./app/utils/withOrganization.tsx");
/* harmony import */ var sentry_utils_withTeamsForUser__WEBPACK_IMPORTED_MODULE_24__ = __webpack_require__(/*! sentry/utils/withTeamsForUser */ "./app/utils/withTeamsForUser.tsx");
/* harmony import */ var sentry_views_alerts_list_rules_teamFilter__WEBPACK_IMPORTED_MODULE_25__ = __webpack_require__(/*! sentry/views/alerts/list/rules/teamFilter */ "./app/views/alerts/list/rules/teamFilter.tsx");
/* harmony import */ var _projectCard__WEBPACK_IMPORTED_MODULE_26__ = __webpack_require__(/*! ./projectCard */ "./app/views/projectsDashboard/projectCard.tsx");
/* harmony import */ var _resources__WEBPACK_IMPORTED_MODULE_27__ = __webpack_require__(/*! ./resources */ "./app/views/projectsDashboard/resources.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_28__ = __webpack_require__(/*! ./utils */ "./app/views/projectsDashboard/utils.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }































function Dashboard(_ref) {
  let {
    teams,
    organization,
    loadingTeams,
    error,
    router,
    location
  } = _ref;
  (0,react__WEBPACK_IMPORTED_MODULE_3__.useEffect)(() => {
    return function cleanup() {
      sentry_stores_projectsStatsStore__WEBPACK_IMPORTED_MODULE_19__["default"].reset();
    };
  }, []);
  const [projectQuery, setProjectQuery] = (0,react__WEBPACK_IMPORTED_MODULE_3__.useState)('');
  const debouncedSearchQuery = (0,react__WEBPACK_IMPORTED_MODULE_3__.useMemo)(() => lodash_debounce__WEBPACK_IMPORTED_MODULE_5___default()(handleSearch, sentry_constants__WEBPACK_IMPORTED_MODULE_16__.DEFAULT_DEBOUNCE_DURATION), []);

  if (loadingTeams) {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsx)(sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_11__["default"], {});
  }

  if (error) {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsx)(sentry_components_loadingError__WEBPACK_IMPORTED_MODULE_10__["default"], {
      message: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_18__.t)('An error occurred while fetching your projects')
    });
  }

  const canCreateProjects = organization.access.includes('project:admin');
  const canJoinTeam = organization.access.includes('team:read');
  const hasProjectAccess = organization.access.includes('project:read');
  const selectedTeams = (0,_utils__WEBPACK_IMPORTED_MODULE_28__.getTeamParams)(location ? location.query.team : '');
  const filteredTeams = teams.filter(team => selectedTeams.includes(team.id));
  const filteredTeamProjects = lodash_uniqBy__WEBPACK_IMPORTED_MODULE_7___default()(lodash_flatten__WEBPACK_IMPORTED_MODULE_6___default()((filteredTeams !== null && filteredTeams !== void 0 ? filteredTeams : teams).map(team => team.projects)), 'id');
  const projects = lodash_uniqBy__WEBPACK_IMPORTED_MODULE_7___default()(lodash_flatten__WEBPACK_IMPORTED_MODULE_6___default()(teams.map(teamObj => teamObj.projects)), 'id');
  const currentProjects = selectedTeams.length === 0 ? projects : filteredTeamProjects;
  const filteredProjects = (currentProjects !== null && currentProjects !== void 0 ? currentProjects : projects).filter(project => project.slug.includes(projectQuery));
  const favorites = projects.filter(project => project.isBookmarked);
  const showEmptyMessage = projects.length === 0 && favorites.length === 0;
  const showResources = projects.length === 1 && !projects[0].firstEvent;

  function handleSearch(searchQuery) {
    setProjectQuery(searchQuery);
  }

  function handleChangeFilter(activeFilters) {
    const { ...currentQuery
    } = location.query;
    router.push({
      pathname: location.pathname,
      query: { ...currentQuery,
        team: activeFilters.length > 0 ? activeFilters : ''
      }
    });
  }

  if (showEmptyMessage) {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsx)(sentry_components_noProjectMessage__WEBPACK_IMPORTED_MODULE_12__["default"], {
      organization: organization,
      superuserNeedsToBeProjectMember: true
    });
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsxs)(react__WEBPACK_IMPORTED_MODULE_3__.Fragment, {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsx)(sentry_components_sentryDocumentTitle__WEBPACK_IMPORTED_MODULE_15__["default"], {
      title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_18__.t)('Projects Dashboard'),
      orgSlug: organization.slug
    }), projects.length > 0 && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsxs)(react__WEBPACK_IMPORTED_MODULE_3__.Fragment, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsxs)(ProjectsHeader, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsx)(Title, {
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsx)(sentry_components_pageHeading__WEBPACK_IMPORTED_MODULE_13__["default"], {
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_18__.t)('Projects')
          })
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsx)(sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_9__.HeaderActions, {
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsxs)(ButtonContainer, {
            children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_8__["default"], {
              icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_17__.IconUser, {
                size: "xs"
              }),
              title: canJoinTeam ? undefined : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_18__.t)('You do not have permission to join a team.'),
              disabled: !canJoinTeam,
              to: `/settings/${organization.slug}/teams/`,
              "data-test-id": "join-team",
              children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_18__.t)('Join a Team')
            }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_8__["default"], {
              priority: "primary",
              disabled: !canCreateProjects,
              title: !canCreateProjects ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_18__.t)('You do not have permission to create projects') : undefined,
              to: `/organizations/${organization.slug}/projects/new/`,
              icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_17__.IconAdd, {
                size: "xs",
                isCircled: true
              }),
              "data-test-id": "create-project",
              children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_18__.t)('Create Project')
            })]
          })
        })]
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsx)(Body, {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsxs)(sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_9__.Main, {
          fullWidth: true,
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsxs)(SearchAndSelectorWrapper, {
            children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsx)(sentry_views_alerts_list_rules_teamFilter__WEBPACK_IMPORTED_MODULE_25__["default"], {
              selectedTeams: selectedTeams,
              handleChangeFilter: handleChangeFilter,
              showIsMemberTeams: true,
              showSuggestedOptions: false,
              showMyTeamsDescription: true
            }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsx)(StyledSearchBar, {
              defaultQuery: "",
              placeholder: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_18__.t)('Search for projects by name'),
              onChange: debouncedSearchQuery,
              query: projectQuery
            })]
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsx)(react_lazyload__WEBPACK_IMPORTED_MODULE_4__["default"], {
            once: true,
            debounce: 50,
            height: 300,
            offset: 300,
            children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsx)(ProjectCards, {
              children: (0,sentry_utils__WEBPACK_IMPORTED_MODULE_21__.sortProjects)(filteredProjects).map(project => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsx)(_projectCard__WEBPACK_IMPORTED_MODULE_26__["default"], {
                "data-test-id": project.slug,
                project: project,
                hasProjectAccess: hasProjectAccess
              }, project.slug))
            })
          })]
        })
      }), showResources && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsx)(_resources__WEBPACK_IMPORTED_MODULE_27__["default"], {
        organization: organization
      })]
    })]
  });
}

Dashboard.displayName = "Dashboard";

const OrganizationDashboard = props => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsx)(OrganizationDashboardWrapper, {
  children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_29__.jsx)(Dashboard, { ...props
  })
});

OrganizationDashboard.displayName = "OrganizationDashboard";

const ProjectsHeader = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_9__.Header,  true ? {
  target: "e1na43vn7"
} : 0)("border-bottom:none;align-items:end;@media (min-width: ", p => p.theme.breakpoints.medium, "){padding:26px ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_20__["default"])(4), " 0 ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_20__["default"])(4), ";}" + ( true ? "" : 0));

const Title = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_9__.HeaderContent,  true ? {
  target: "e1na43vn6"
} : 0)( true ? {
  name: "1ykowef",
  styles: "margin-bottom:0"
} : 0);

const ButtonContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1na43vn5"
} : 0)("display:inline-flex;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_20__["default"])(1), ";" + ( true ? "" : 0));

const SearchAndSelectorWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1na43vn4"
} : 0)("display:flex;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_20__["default"])(2), ";justify-content:flex-end;align-items:flex-end;margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_20__["default"])(2), ";@media (max-width: ", p => p.theme.breakpoints.small, "){display:block;}@media (min-width: ", p => p.theme.breakpoints.xlarge, "){display:flex;}" + ( true ? "" : 0));

const StyledSearchBar = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_searchBar__WEBPACK_IMPORTED_MODULE_14__["default"],  true ? {
  target: "e1na43vn3"
} : 0)("flex-grow:1;@media (max-width: ", p => p.theme.breakpoints.small, "){margin-top:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_20__["default"])(1), ";}" + ( true ? "" : 0));

const Body = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_9__.Body,  true ? {
  target: "e1na43vn2"
} : 0)("padding-top:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_20__["default"])(2), "!important;background-color:", p => p.theme.surface100, ";" + ( true ? "" : 0));

const ProjectCards = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1na43vn1"
} : 0)("display:grid;grid-template-columns:minmax(100px, 1fr);gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_20__["default"])(3), ";@media (min-width: ", p => p.theme.breakpoints.small, "){grid-template-columns:repeat(2, minmax(100px, 1fr));}@media (min-width: ", p => p.theme.breakpoints.xlarge, "){grid-template-columns:repeat(3, minmax(100px, 1fr));}" + ( true ? "" : 0));

const OrganizationDashboardWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1na43vn0"
} : 0)( true ? {
  name: "1k8t52o",
  styles: "display:flex;flex:1;flex-direction:column"
} : 0);


/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_22__["default"])((0,sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_23__["default"])((0,sentry_utils_withTeamsForUser__WEBPACK_IMPORTED_MODULE_24__["default"])((0,_sentry_react__WEBPACK_IMPORTED_MODULE_30__.withProfiler)(OrganizationDashboard)))));

/***/ }),

/***/ "./app/views/projectsDashboard/noEvents.tsx":
/*!**************************************************!*\
  !*** ./app/views/projectsDashboard/noEvents.tsx ***!
  \**************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }




const NoEvents = _ref => {
  let {
    seriesCount
  } = _ref;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)(Container, {
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)(EmptyText, {
      seriesCount: seriesCount,
      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('No activity yet.')
    })
  });
};

NoEvents.displayName = "NoEvents";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (NoEvents);

const Container = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "eshjevu1"
} : 0)( true ? {
  name: "re8sfx",
  styles: "position:absolute;top:0;left:0;bottom:0;right:0"
} : 0);

const EmptyText = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "eshjevu0"
} : 0)("display:flex;align-items:center;justify-content:center;margin-left:4px;margin-right:4px;height:", p => p.seriesCount > 1 ? '90px' : '150px', ";color:", p => p.theme.gray300, ";" + ( true ? "" : 0));

/***/ }),

/***/ "./app/views/projectsDashboard/projectCard.tsx":
/*!*****************************************************!*\
  !*** ./app/views/projectsDashboard/projectCard.tsx ***!
  \*****************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "ProjectCard": () => (/* binding */ ProjectCard),
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var lodash_round__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! lodash/round */ "../node_modules/lodash/round.js");
/* harmony import */ var lodash_round__WEBPACK_IMPORTED_MODULE_5___default = /*#__PURE__*/__webpack_require__.n(lodash_round__WEBPACK_IMPORTED_MODULE_5__);
/* harmony import */ var sentry_actionCreators_projects__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/actionCreators/projects */ "./app/actionCreators/projects.tsx");
/* harmony import */ var sentry_components_idBadge__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/idBadge */ "./app/components/idBadge/index.tsx");
/* harmony import */ var sentry_components_links_link__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/links/link */ "./app/components/links/link.tsx");
/* harmony import */ var sentry_components_placeholder__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/placeholder */ "./app/components/placeholder.tsx");
/* harmony import */ var sentry_components_projects_bookmarkStar__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/projects/bookmarkStar */ "./app/components/projects/bookmarkStar.tsx");
/* harmony import */ var sentry_components_questionTooltip__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/components/questionTooltip */ "./app/components/questionTooltip.tsx");
/* harmony import */ var sentry_components_scoreCard__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/components/scoreCard */ "./app/components/scoreCard.tsx");
/* harmony import */ var sentry_data_platformCategories__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/data/platformCategories */ "./app/data/platformCategories.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_stores_projectsStatsStore__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/stores/projectsStatsStore */ "./app/stores/projectsStatsStore.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");
/* harmony import */ var sentry_utils_callIfFunction__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! sentry/utils/callIfFunction */ "./app/utils/callIfFunction.tsx");
/* harmony import */ var sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_20__ = __webpack_require__(/*! sentry/utils/formatters */ "./app/utils/formatters.tsx");
/* harmony import */ var sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_21__ = __webpack_require__(/*! sentry/utils/withApi */ "./app/utils/withApi.tsx");
/* harmony import */ var sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_22__ = __webpack_require__(/*! sentry/utils/withOrganization */ "./app/utils/withOrganization.tsx");
/* harmony import */ var sentry_views_projectDetail_missingFeatureButtons_missingReleasesButtons__WEBPACK_IMPORTED_MODULE_23__ = __webpack_require__(/*! sentry/views/projectDetail/missingFeatureButtons/missingReleasesButtons */ "./app/views/projectDetail/missingFeatureButtons/missingReleasesButtons.tsx");
/* harmony import */ var sentry_views_releases_utils__WEBPACK_IMPORTED_MODULE_24__ = __webpack_require__(/*! sentry/views/releases/utils */ "./app/views/releases/utils/index.tsx");
/* harmony import */ var _chart__WEBPACK_IMPORTED_MODULE_25__ = __webpack_require__(/*! ./chart */ "./app/views/projectsDashboard/chart.tsx");
/* harmony import */ var _deploys__WEBPACK_IMPORTED_MODULE_26__ = __webpack_require__(/*! ./deploys */ "./app/views/projectsDashboard/deploys.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");





function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }



























class ProjectCard extends react__WEBPACK_IMPORTED_MODULE_4__.Component {
  componentDidMount() {
    const {
      organization,
      project,
      api
    } = this.props; // fetch project stats

    (0,sentry_actionCreators_projects__WEBPACK_IMPORTED_MODULE_6__.loadStatsForProject)(api, project.id, {
      orgId: organization.slug,
      projectId: project.id,
      query: {
        transactionStats: this.hasPerformance ? '1' : undefined,
        sessionStats: '1'
      }
    });
  }

  get hasPerformance() {
    return this.props.organization.features.includes('performance-view');
  }

  get crashFreeTrend() {
    const {
      currentCrashFreeRate,
      previousCrashFreeRate
    } = this.props.project.sessionStats || {};

    if (!(0,sentry_utils__WEBPACK_IMPORTED_MODULE_18__.defined)(currentCrashFreeRate) || !(0,sentry_utils__WEBPACK_IMPORTED_MODULE_18__.defined)(previousCrashFreeRate)) {
      return undefined;
    }

    return lodash_round__WEBPACK_IMPORTED_MODULE_5___default()(currentCrashFreeRate - previousCrashFreeRate, currentCrashFreeRate > sentry_views_releases_utils__WEBPACK_IMPORTED_MODULE_24__.CRASH_FREE_DECIMAL_THRESHOLD ? 3 : 0);
  }

  renderMissingFeatureCard() {
    const {
      organization,
      project
    } = this.props;

    if (project.platform && sentry_data_platformCategories__WEBPACK_IMPORTED_MODULE_13__.releaseHealth.includes(project.platform)) {
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsx)(sentry_components_scoreCard__WEBPACK_IMPORTED_MODULE_12__["default"], {
        title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)('Crash Free Sessions'),
        score: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsx)(sentry_views_projectDetail_missingFeatureButtons_missingReleasesButtons__WEBPACK_IMPORTED_MODULE_23__["default"], {
          organization: organization,
          health: true
        })
      });
    }

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsx)(sentry_components_scoreCard__WEBPACK_IMPORTED_MODULE_12__["default"], {
      title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)('Crash Free Sessions'),
      score: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsxs)(NotAvailable, {
        children: [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)('Not Available'), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsx)(sentry_components_questionTooltip__WEBPACK_IMPORTED_MODULE_11__["default"], {
          title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)('Release Health is not yet supported on this platform.'),
          size: "xs"
        })]
      })
    });
  }

  renderTrend() {
    const {
      currentCrashFreeRate
    } = this.props.project.sessionStats || {};

    if (!(0,sentry_utils__WEBPACK_IMPORTED_MODULE_18__.defined)(currentCrashFreeRate) || !(0,sentry_utils__WEBPACK_IMPORTED_MODULE_18__.defined)(this.crashFreeTrend)) {
      return null;
    }

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsxs)("div", {
      children: [this.crashFreeTrend >= 0 ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_14__.IconArrow, {
        direction: "up",
        size: "xs"
      }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_14__.IconArrow, {
        direction: "down",
        size: "xs"
      }), `${(0,sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_20__.formatAbbreviatedNumber)(Math.abs(this.crashFreeTrend))}\u0025`]
    });
  }

  render() {
    var _stats$reduce, _transactionStats$red;

    const {
      organization,
      project,
      hasProjectAccess
    } = this.props;
    const {
      stats,
      slug,
      transactionStats,
      sessionStats
    } = project;
    const {
      hasHealthData,
      currentCrashFreeRate
    } = sessionStats || {};
    const totalErrors = (_stats$reduce = stats === null || stats === void 0 ? void 0 : stats.reduce((sum, _ref) => {
      let [_, value] = _ref;
      return sum + value;
    }, 0)) !== null && _stats$reduce !== void 0 ? _stats$reduce : 0;
    const totalTransactions = (_transactionStats$red = transactionStats === null || transactionStats === void 0 ? void 0 : transactionStats.reduce((sum, _ref2) => {
      let [_, value] = _ref2;
      return sum + value;
    }, 0)) !== null && _transactionStats$red !== void 0 ? _transactionStats$red : 0;
    const zeroTransactions = totalTransactions === 0;
    const hasFirstEvent = Boolean(project.firstEvent || project.firstTransactionEvent);
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsx)("div", {
      "data-test-id": slug,
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsxs)(StyledProjectCard, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsxs)(CardHeader, {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsxs)(HeaderRow, {
            children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsx)(StyledIdBadge, {
              project: project,
              avatarSize: 32,
              hideOverflow: true,
              disableLink: !hasProjectAccess
            }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsx)(StyledBookmarkStar, {
              organization: organization,
              project: project
            })]
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsx)(SummaryLinks, {
            "data-test-id": "summary-links",
            children: stats ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsxs)(react__WEBPACK_IMPORTED_MODULE_4__.Fragment, {
              children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsx)(sentry_components_links_link__WEBPACK_IMPORTED_MODULE_8__["default"], {
                "data-test-id": "project-errors",
                to: `/organizations/${organization.slug}/issues/?project=${project.id}`,
                children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)('Errors: %s', (0,sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_20__.formatAbbreviatedNumber)(totalErrors))
              }), this.hasPerformance && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsxs)(react__WEBPACK_IMPORTED_MODULE_4__.Fragment, {
                children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsx)("em", {
                  children: "|"
                }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsxs)(TransactionsLink, {
                  "data-test-id": "project-transactions",
                  to: `/organizations/${organization.slug}/performance/?project=${project.id}`,
                  children: [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)('Transactions: %s', (0,sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_20__.formatAbbreviatedNumber)(totalTransactions)), zeroTransactions && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsx)(sentry_components_questionTooltip__WEBPACK_IMPORTED_MODULE_11__["default"], {
                    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)('Click here to learn more about performance monitoring'),
                    position: "top",
                    size: "xs"
                  })]
                })]
              })]
            }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsx)(SummaryLinkPlaceholder, {})
          })]
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsx)(ChartContainer, {
          "data-test-id": "chart-container",
          children: stats ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsx)(_chart__WEBPACK_IMPORTED_MODULE_25__["default"], {
            firstEvent: hasFirstEvent,
            stats: stats,
            transactionStats: transactionStats
          }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsx)(sentry_components_placeholder__WEBPACK_IMPORTED_MODULE_9__["default"], {
            height: "150px"
          })
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsxs)(FooterWrapper, {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsx)(ScoreCardWrapper, {
            children: !stats ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsxs)(react__WEBPACK_IMPORTED_MODULE_4__.Fragment, {
              children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsx)(ReleaseTitle, {
                children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)('Crash Free Sessions')
              }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsx)(FooterPlaceholder, {})]
            }) : hasHealthData ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsx)(sentry_components_scoreCard__WEBPACK_IMPORTED_MODULE_12__["default"], {
              title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)('Crash Free Sessions'),
              score: (0,sentry_utils__WEBPACK_IMPORTED_MODULE_18__.defined)(currentCrashFreeRate) ? (0,sentry_views_releases_utils__WEBPACK_IMPORTED_MODULE_24__.displayCrashFreePercent)(currentCrashFreeRate) : '\u2014',
              trend: this.renderTrend(),
              trendStatus: this.crashFreeTrend ? this.crashFreeTrend > 0 ? 'good' : 'bad' : undefined
            }) : this.renderMissingFeatureCard()
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsxs)(DeploysWrapper, {
            children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsx)(ReleaseTitle, {
              children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)('Latest Deploys')
            }), stats ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsx)(_deploys__WEBPACK_IMPORTED_MODULE_26__["default"], {
              project: project,
              shorten: true
            }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsx)(FooterPlaceholder, {})]
          })]
        })]
      })
    });
  }

}

ProjectCard.displayName = "ProjectCard";

class ProjectCardContainer extends react__WEBPACK_IMPORTED_MODULE_4__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", this.getInitialState());

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "listeners", [sentry_stores_projectsStatsStore__WEBPACK_IMPORTED_MODULE_16__["default"].listen(itemsBySlug => {
      this.onProjectStoreUpdate(itemsBySlug);
    }, undefined)]);
  }

  getInitialState() {
    const {
      project
    } = this.props;
    const initialState = sentry_stores_projectsStatsStore__WEBPACK_IMPORTED_MODULE_16__["default"].getInitialState() || {};
    return {
      projectDetails: initialState[project.slug] || null
    };
  }

  componentWillUnmount() {
    this.listeners.forEach(sentry_utils_callIfFunction__WEBPACK_IMPORTED_MODULE_19__.callIfFunction);
  }

  onProjectStoreUpdate(itemsBySlug) {
    const {
      project
    } = this.props; // Don't update state if we already have stats

    if (!itemsBySlug[project.slug]) {
      return;
    }

    if (itemsBySlug[project.slug] === this.state.projectDetails) {
      return;
    }

    this.setState({
      projectDetails: itemsBySlug[project.slug]
    });
  }

  render() {
    const {
      project,
      ...props
    } = this.props;
    const {
      projectDetails
    } = this.state;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_27__.jsx)(ProjectCard, { ...props,
      project: { ...project,
        ...(projectDetails || {})
      }
    });
  }

}

ProjectCardContainer.displayName = "ProjectCardContainer";

const ChartContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "eja9a5414"
} : 0)("position:relative;background:", p => p.theme.backgroundSecondary, ";" + ( true ? "" : 0));

const CardHeader = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "eja9a5413"
} : 0)("margin:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_17__["default"])(2), " 13px;height:32px;" + ( true ? "" : 0));

const StyledBookmarkStar = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_projects_bookmarkStar__WEBPACK_IMPORTED_MODULE_10__["default"],  true ? {
  target: "eja9a5412"
} : 0)( true ? {
  name: "1hcx8jb",
  styles: "padding:0"
} : 0);

const HeaderRow = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "eja9a5411"
} : 0)("display:flex;justify-content:space-between;align-items:flex-start;", p => p.theme.text.cardTitle, ";color:", p => p.theme.headingColor, ";" + ( true ? "" : 0));

const StyledProjectCard = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "eja9a5410"
} : 0)("background-color:", p => p.theme.background, ";border:1px solid ", p => p.theme.border, ";border-radius:", p => p.theme.borderRadius, ";box-shadow:", p => p.theme.dropShadowLight, ";min-height:330px;" + ( true ? "" : 0));

const FooterWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "eja9a549"
} : 0)("display:grid;grid-template-columns:1fr 1fr;div{border:none;box-shadow:none;font-size:", p => p.theme.fontSizeMedium, ";padding:0;}" + ( true ? "" : 0));

const ScoreCardWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "eja9a548"
} : 0)("margin:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_17__["default"])(2), " 0 0 ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_17__["default"])(2), ";", sentry_components_scoreCard__WEBPACK_IMPORTED_MODULE_12__.ScorePanel, "{min-height:auto;}", sentry_components_scoreCard__WEBPACK_IMPORTED_MODULE_12__.Title, "{color:", p => p.theme.gray300, ";}", sentry_components_scoreCard__WEBPACK_IMPORTED_MODULE_12__.ScoreWrapper, "{flex-direction:column;align-items:flex-start;}", sentry_components_scoreCard__WEBPACK_IMPORTED_MODULE_12__.Score, "{font-size:28px;}", sentry_components_scoreCard__WEBPACK_IMPORTED_MODULE_12__.Trend, "{margin-left:0;margin-top:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_17__["default"])(0.5), ";}" + ( true ? "" : 0));

const DeploysWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "eja9a547"
} : 0)("margin-top:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_17__["default"])(2), ";", _deploys__WEBPACK_IMPORTED_MODULE_26__.GetStarted, "{display:block;height:100%;}", _deploys__WEBPACK_IMPORTED_MODULE_26__.TextOverflow, "{display:grid;grid-template-columns:1fr 1fr;grid-column-gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_17__["default"])(1), ";div{white-space:nowrap;text-overflow:ellipsis;overflow:hidden;}a{display:grid;}}", _deploys__WEBPACK_IMPORTED_MODULE_26__.DeployRows, "{grid-template-columns:2fr auto;margin-right:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_17__["default"])(2), ";height:auto;svg{display:none;}}" + ( true ? "" : 0));

const ReleaseTitle = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('span',  true ? {
  target: "eja9a546"
} : 0)("color:", p => p.theme.gray300, ";font-weight:600;" + ( true ? "" : 0));

const StyledIdBadge = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_idBadge__WEBPACK_IMPORTED_MODULE_7__["default"],  true ? {
  target: "eja9a545"
} : 0)( true ? {
  name: "aik98h",
  styles: "overflow:hidden;white-space:nowrap;flex-shrink:1;& div{align-items:flex-start;}& span{padding:0;position:relative;top:-1px;}"
} : 0);

const SummaryLinks = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "eja9a544"
} : 0)("display:flex;position:relative;top:-", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_17__["default"])(2), ";align-items:center;font-weight:400;color:", p => p.theme.subText, ";font-size:", p => p.theme.fontSizeSmall, ";margin-left:40px;a{color:", p => p.theme.subText, ";:hover{color:", p => p.theme.linkHoverColor, ";}}em{font-style:normal;margin:0 ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_17__["default"])(0.5), ";}" + ( true ? "" : 0));

const TransactionsLink = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_links_link__WEBPACK_IMPORTED_MODULE_8__["default"],  true ? {
  target: "eja9a543"
} : 0)("display:flex;align-items:center;justify-content:space-between;>span{margin-left:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_17__["default"])(0.5), ";}" + ( true ? "" : 0));

const NotAvailable = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "eja9a542"
} : 0)("font-size:", p => p.theme.fontSizeMedium, ";font-weight:normal;display:grid;grid-template-columns:auto auto;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_17__["default"])(0.5), ";align-items:center;" + ( true ? "" : 0));

const SummaryLinkPlaceholder = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_placeholder__WEBPACK_IMPORTED_MODULE_9__["default"],  true ? {
  target: "eja9a541"
} : 0)("height:15px;width:180px;margin-top:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_17__["default"])(0.75), ";margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_17__["default"])(0.5), ";" + ( true ? "" : 0));

const FooterPlaceholder = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_placeholder__WEBPACK_IMPORTED_MODULE_9__["default"],  true ? {
  target: "eja9a540"
} : 0)("height:40px;width:auto;margin-right:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_17__["default"])(2), ";" + ( true ? "" : 0));


/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_22__["default"])((0,sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_21__["default"])(ProjectCardContainer)));

/***/ }),

/***/ "./app/views/projectsDashboard/resources.tsx":
/*!***************************************************!*\
  !*** ./app/views/projectsDashboard/resources.tsx ***!
  \***************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_images_spot_breadcrumbs_generic_svg__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry-images/spot/breadcrumbs-generic.svg */ "./images/spot/breadcrumbs-generic.svg");
/* harmony import */ var sentry_images_spot_code_arguments_tags_mirrored_svg__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry-images/spot/code-arguments-tags-mirrored.svg */ "./images/spot/code-arguments-tags-mirrored.svg");
/* harmony import */ var sentry_images_spot_releases_svg__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry-images/spot/releases.svg */ "./images/spot/releases.svg");
/* harmony import */ var sentry_components_pageHeading__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/pageHeading */ "./app/components/pageHeading.tsx");
/* harmony import */ var sentry_components_resourceCard__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/resourceCard */ "./app/components/resourceCard.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_analytics__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/utils/analytics */ "./app/utils/analytics.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");













function Resources(_ref) {
  let {
    organization
  } = _ref;
  (0,react__WEBPACK_IMPORTED_MODULE_1__.useEffect)(() => {
    (0,sentry_utils_analytics__WEBPACK_IMPORTED_MODULE_9__.trackAnalyticsEvent)({
      eventKey: 'orgdash.resources_shown',
      eventName: 'Projects Dashboard: Resources Shown',
      organization_id: organization.id
    });
  });
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsxs)(ResourcesWrapper, {
    "data-test-id": "resources",
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(sentry_components_pageHeading__WEBPACK_IMPORTED_MODULE_5__["default"], {
      withMargins: true,
      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Resources')
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsxs)(ResourceCards, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(sentry_components_resourceCard__WEBPACK_IMPORTED_MODULE_6__["default"], {
        link: "https://docs.sentry.io/product/releases/",
        imgUrl: sentry_images_spot_releases_svg__WEBPACK_IMPORTED_MODULE_4__,
        title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('The Sentry Workflow')
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(sentry_components_resourceCard__WEBPACK_IMPORTED_MODULE_6__["default"], {
        link: "https://docs.sentry.io/product/issues/",
        imgUrl: sentry_images_spot_breadcrumbs_generic_svg__WEBPACK_IMPORTED_MODULE_2__,
        title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Sentry vs Logging')
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(sentry_components_resourceCard__WEBPACK_IMPORTED_MODULE_6__["default"], {
        link: "https://docs.sentry.io/",
        imgUrl: sentry_images_spot_code_arguments_tags_mirrored_svg__WEBPACK_IMPORTED_MODULE_3__,
        title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Docs')
      })]
    })]
  });
}

Resources.displayName = "Resources";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (Resources);

const ResourcesWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1lk9ohe1"
} : 0)("border-top:1px solid ", p => p.theme.border, ";padding:25px 30px 10px 30px;" + ( true ? "" : 0));

const ResourceCards = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1lk9ohe0"
} : 0)("display:grid;grid-template-columns:minmax(100px, 1fr);gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_8__["default"])(3), ";@media (min-width: ", p => p.theme.breakpoints.medium, "){grid-template-columns:repeat(auto-fit, minmax(100px, 1fr));}" + ( true ? "" : 0));

/***/ }),

/***/ "./app/views/projectsDashboard/utils.tsx":
/*!***********************************************!*\
  !*** ./app/views/projectsDashboard/utils.tsx ***!
  \***********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "getTeamParams": () => (/* binding */ getTeamParams)
/* harmony export */ });
/**
 * Noramlize a team slug from the query
 */
function getTeamParams(team) {
  if (team === '' || team === undefined) {
    return [];
  }

  if (Array.isArray(team)) {
    return team;
  }

  return [team];
}

/***/ }),

/***/ "./images/spot/breadcrumbs-generic.svg":
/*!*********************************************!*\
  !*** ./images/spot/breadcrumbs-generic.svg ***!
  \*********************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

module.exports = __webpack_require__.p + "assets/breadcrumbs-generic.d27a0c9f5da19ea21b84.svg";

/***/ }),

/***/ "./images/spot/code-arguments-tags-mirrored.svg":
/*!******************************************************!*\
  !*** ./images/spot/code-arguments-tags-mirrored.svg ***!
  \******************************************************/
/***/ ((module) => {

module.exports = "data:image/svg+xml;base64,PHN2ZyB2ZXJzaW9uPSIxLjEiIGlkPSJMYXllcl8xIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHg9IjAiIHk9IjAiIHZpZXdCb3g9IjAgMCA5NTAgOTUwIiB4bWw6c3BhY2U9InByZXNlcnZlIj48c3R5bGU+LnN0MntmaWxsOiNjNGJmZGN9LnN0M3tmaWxsOiNmZmZ9LnN0NHtmaWxsOiNlM2EzNmZ9LnN0NXtmaWxsOiNjMDNmMzN9LnN0NntmaWxsOiNkNWQwZTV9PC9zdHlsZT48ZyBpZD0iQWJzdHJhY3Rfc2NyZWVuc2hvdCI+PHBhdGggZD0iTTE1OS40IDM1Mi42TDc2MC44IDUuNGM2LjQtMy43IDEyLjItNC4zIDE2LjgtMi4zLjkuNCAyMy4xIDEzLjIgMjMuOCAxMy42IDQuNyAzLjMgNy41IDkuOSA3LjUgMTguOXY1MTIuOWMwIDE4LjQtMTIgNDAuMy0yNi44IDQ4LjlMMTgwLjggOTQ0LjZjLTYuMiAzLjYtMTIgNC4yLTE2LjUgMi40cy0yMy40LTEzLjMtMjQuMS0xMy44Yy00LjctMy4zLTcuNS05LjgtNy41LTE4LjhWNDAxLjVjLS4xLTE4LjUgMTItNDAuNCAyNi43LTQ4Ljl6IiBmaWxsPSIjMzQzMDQwIi8+PHBhdGggZD0iTTc4Mi4xIDU5Ny40YzE0LjgtOC41IDI2LjgtMzAuNCAyNi44LTQ4LjlWMzUuNmMwLTE4LjQtMTItMjYuNS0yNi44LTE4TDE4MC44IDM2NC45Yy0xNC44IDguNS0yNi44IDMwLjQtMjYuOCA0OC45djUxMi45YzAgMTguNCAxMiAyNi41IDI2LjggMThsNjAxLjMtMzQ3LjN6IiBmaWxsPSIjNTA0YTVkIi8+PHBhdGggY2xhc3M9InN0MiIgZD0iTTgxNCA0NWwtLjEtLjEuMS4xYy4xIDAgMCAwIDAgMHpNMTY2LjcgNDA2LjR2NTEyLjljMCA1LjIgMS42IDkgNC4xIDEwLjlzMTguOCAxMC43IDIxLjYgMTIuNWMuMS4xLjIuMS4zLjItMy0xLjctNC44LTUuNy00LjgtMTEuM3YtNTEzYzAtMTAuNCA2LjMtMjIuNCAxNC0yNi45TDgwMy4zIDQ0LjVjMi45LTEuNyA1LjYtMi4xIDcuOC0xLjMgMCAwLTIwLjctMTIuMS0yMS4zLTEyLjMtMi4yLS42LTQuOC0uMi03LjcgMS40TDE4MC44IDM3OS41Yy03LjggNC41LTE0LjEgMTYuNS0xNC4xIDI2Ljl6Ii8+PHBhdGggY2xhc3M9InN0MyIgZD0iTTgxNy4zIDU2OC4xVjU1LjJjMC0xMC4zLTYuMy0xNS4xLTE0LTEwLjZMMjAxLjkgMzkxLjhjLTcuOCA0LjUtMTQgMTYuNS0xNCAyNi45djUxMi45YzAgMTAuMyA2LjMgMTUuMSAxNCAxMC42TDgwMy4zIDU5NWM3LjgtNC42IDE0LTE2LjYgMTQtMjYuOXoiLz48cGF0aCBjbGFzcz0ic3Q0IiBkPSJNNTkwLjEgNTY0LjZsLTI4LjcgMTYuNnYxOWwyOC43LTE2LjZ2LTE5em0tMjguNyA0Ny4xdjE5bDM1LjktMjAuN3YtMTlsLTM1LjkgMjAuN3ptMCA0OS42bDIxLjUtMTIuNHYtMTlsLTIxLjUgMTIuNHYxOXoiLz48cGF0aCBjbGFzcz0ic3Q1IiBkPSJNNjIzLjggNTQ1LjFMNTk1IDU2MS43djE5bDI4LjctMTYuNi4xLTE5em0tMjEuNiA0M3YxOWwzNS45LTIwLjd2LTE5bC0zNS45IDIwLjd6TTU4Ny44IDY0Nmw0Ni4yLTI2LjZ2LTE5TDU4Ny44IDYyN3YxOXoiLz48cGF0aCBjbGFzcz0ic3Q0IiBkPSJNNzI3LjcgNDg1LjFMNjg0LjYgNTEwdjE5bDQzLjEtMjQuOXYtMTl6bS00My4xIDU1LjV2MTlsMzEtMTcuOXYtMTlsLTMxIDE3Ljl6bTAgNDkuNWwzMS0xNy45di0xOWwtMzEgMTcuOXYxOXoiLz48cGF0aCBjbGFzcz0ic3Q1IiBkPSJNNzY2LjIgNDYyLjlsLTMzLjUgMTkuNHYxOWwzMy41LTE5LjR2LTE5em0tNDUuNyA1Ni45djE5bDYwLTM0LjZ2LTE5bC02MCAzNC42em0wIDQ5LjZsNTUuOS0zMi4zdi0xOWwtNTUuOSAzMi4zdjE5eiIvPjxwYXRoIGNsYXNzPSJzdDIiIGQ9Ik04MDUuOSAzNjJWMTQ4LjlsNS4zLTN2MjIxLjRMNTE5IDUzNnYtOC4zeiIvPjxwYXRoIGNsYXNzPSJzdDYiIGQ9Ik01NTIuNCAzMTkuMmwtNy42IDQuNHYyMC4xbDcuNi00LjR2LTIwLjF6TTU5NC4zIDM3OS45bDcuNi00LjR2LTIwLjFsLTcuNiA0LjR2MjAuMXpNNTQ0LjggNDczLjFsNy42LTQuM3YtMjAuMmwtNy42IDQuNHYyMC4xek01OTQuMyAzMjcuNGwtNy42IDQuNHYyMC4xbDcuNi00LjR2LTIwLjF6TTU3OS4xIDQyMWw3LjYtNC40di0yMC4xbC03LjYgNC40VjQyMXoiLz48cGF0aCBjbGFzcz0ic3Q1IiBkPSJNNjIyLjQgMzExLjJsLTIyLjggMTMuMnYyMC4xbDIyLjgtMTMuMnYtMjAuMXptLTE1LjIgNDEuMXYyMC4xbDMwLjQtMTcuNXYtMjAuMWwtMzAuNCAxNy41ek01OTIgNDEzLjVsMzgtMjEuOXYtMjAuMWwtMzggMjEuOXYyMC4xeiIvPjxwYXRoIGNsYXNzPSJzdDQiIGQ9Ik01ODEuNCAzMzQuOEw1NTEgMzUyLjR2MjAuMWwzMC40LTE3LjV2LTIwLjJ6TTU1MSAzODQuN3YyMC4xbDM4LTIxLjl2LTIwLjFsLTM4IDIxLjl6bTAgNTIuNWwyMi44LTEzLjJ2LTIwLjFMNTUxIDQxNy4xdjIwLjF6Ii8+PHBhdGggY2xhc3M9InN0MiIgZD0iTTI5My41IDM5MS40bDcuOS0yNS42LTYxIDM1LjItNy45IDI1LjYgNjEtMzUuMnpNNDI2IDI5My44bC0yMi41IDEzdjIxLjFsMjIuNS0xM3YtMjEuMXptLTI5LjEgMjcuM2wtNi42IDMuOHYxMC41bDYuNi0zLjh2LTEwLjV6TTIwNy43IDQ0MC45bDYuNi0zLjh2LTEwLjVsLTYuNiAzLjh2MTAuNXptMjYtMzYuMWwtNi42IDMuOC03LjkgMjUuNiA2LjYtMy44IDcuOS0yNS42ek00NTkgMjc0LjdsLTYuNiAzLjh2MjEuMWw2LjYtMy44di0yMS4xem02LjYtMy44VjI5MmwxOS44LTExLjR2LTIxLjFsLTE5LjggMTEuNHptLTgxLjkgNjguNHYtMjEuMWwtNjIuNSAzNi4xLTcuOSAyNS42IDcwLjQtNDAuNnptLTc3IDQ0LjRsNy45LTI1LjYtNi41IDMuOC03LjkgMjUuNiA2LjUtMy44ek00NDUuOCAyOTIuOGwtMTMuMiA3LjZ2MTAuNWwxMy4yLTcuNnYtMTAuNXoiLz48cGF0aCBkPSJNMjQ3LjQgNTYyLjd2MjAuMWwyMi44LTEzLjJ2LTIwLjFsLTIyLjggMTMuMnptLTEwLjYtMjYuMnYyMC4xbDQ1LjYtMjYuM3YtMjAuMWwtNDUuNiAyNi4zem0yMi44LTI1LjRWNDkxbC0yMi44IDEzLjJ2MjAuMWwyMi44LTEzLjJ6bTE0Mi0xMzQuNHYyMC4xbDM4LTIxLjl2LTIwLjFsLTM4IDIxLjl6bS0xMjkuOSA5NS4xdi0yMC4xTDIyNi4xIDQ3OHYyMC4xbDQ1LjYtMjYuM3ptMy44IDc0Ljd2MjAuMWwxNS4yLTguOHYtMjAuMWwtMTUuMiA4Ljh6bS0zOC43IDExOS40VjY4Nmw0NS42LTI2LjN2LTIwLjFsLTQ1LjYgMjYuM3oiIGZpbGw9IiNkZTkxNjYiLz48cGF0aCBkPSJNMjQ3LjQgNjQ3LjZsNy42LTQuNFY2MjNsLTcuNiA0LjR2MjAuMnptMjkuNi0xOTl2MjAuMWw3LjYtNC40di0yMC4xbC03LjYgNC40em0tNTAuOSAyNzZsMTUuMi04Ljh2LTIwLjFsLTE1LjIgOC44djIwLjF6IiBmaWxsPSIjZDg3ZjVhIi8+PHBhdGggY2xhc3M9InN0NCIgZD0iTTI4Ny43IDUyNy4zbDkxLjEtNTIuNnYtMjAuMWwtOTEuMSA1Mi42djIwLjF6bTguMyA3LjR2MjAuMWwzMC40LTE3LjV2LTIwLjFMMjk2IDUzNC43em0tOC4zIDEyMmw2MC44LTM1LjF2LTIwLjFsLTYwLjggMzUuMXYyMC4xem0yLjItMjE1LjZ2MjAuMWwxMDYuMy02MS40di0yMC4xbC0xMDYuMyA2MS40em0tMjUgNjdsMTUuMi04Ljh2LTIwLjFsLTE1LjIgOC44djIwLjF6Ii8+PHBhdGggZmlsbD0iI2NkNWU0NyIgZD0iTTQ4Ny4yIDQ4My4zTDIwNS40IDY0NnYtMzMuMmwyODEuOC0xNjIuNnoiLz48cGF0aCBjbGFzcz0ic3QzIiBkPSJNMjcxIDYwMS42bDMyLjItMTguNnYtMjAuMUwyNzEgNTgxLjV6TTI1OCA2MDkuMWw3LjctNC40di0yMC4yTDI1OCA1ODl2MjAuMXpNMzY5LjIgNTI0LjhsLTYwLjcgMzUuMVY1ODBsNjAuNy0zNS4xeiIvPjxwYXRoIGNsYXNzPSJzdDIiIGQ9Ik00ODkuNCA2MTIuNlYyNTcuMmMzLS41IDUuMiAyLjUgNS4yIDcuNnYzNTNMMjAyLjQgNzg2LjV2LTguM2wyODctMTY1LjZ6TTcxOC4yIDExMy4zbDY3LjMtMzguOWMxLjktMS4zIDQuNC0xLjYgNi42LTEgLjYuMiAxMC40IDUuOCAxMSA2LjMgMi43IDIuMyA0LjQgNi45IDQuNCAxMy4yIDAgMTEuNy02IDI0LjYtMTMuMyAyOC44bC02Ny4zIDM4LjljLTEuOCAxLjItNC4xIDEuNi02LjIgMS4xLTIuMi0uNi04LjgtNC44LTEwLjItNS42LTMuNC0xLjktNS42LTYuOS01LjYtMTQgMC0xMS43IDUuOS0yNC42IDEzLjMtMjguOHpNNDg5LjQgNjU5di0yOS44bDUuMi0zLjF2MzguMkwyMDIuNCA4MzN2LTguM3oiLz48cGF0aCBjbGFzcz0ic3QyIiBkPSJNNjE5LjEgMTcwLjVsNjcuMy0zOC45YzEuOS0xLjMgNC40LTEuNiA2LjYtMSAuNi4yIDEwLjQgNS44IDExIDYuMyAyLjcgMi4zIDQuNCA3IDQuNCAxMy4yIDAgMTEuNy02IDI0LjYtMTMuMyAyOC45bC02Ny4zIDM4LjhjLTEuOCAxLjItNC4xIDEuNi02LjIgMS4xLTIuMi0uNi04LjgtNC44LTEwLjItNS42LTMuNC0xLjktNS42LTYuOS01LjYtMTQgMC0xMS43IDUuOS0yNC42IDEzLjMtMjguOHpNNDg5LjQgNzA1LjV2LTI5LjlsNS4yLTN2MzguMkwyMDIuNCA4NzkuNXYtOC4zeiIvPjxwYXRoIGNsYXNzPSJzdDIiIGQ9Ik01MTkuOSAyMjcuN2w2Ny4zLTM4LjljMS45LTEuMyA0LjQtMS42IDYuNi0xIC43LjIgMTAuNCA1LjggMTEgNi4zIDIuNyAyLjMgNC40IDYuOSA0LjQgMTMuMiAwIDExLjctNiAyNC42LTEzLjMgMjguOWwtNjcuMyAzOC45Yy0xLjggMS4yLTQuMSAxLjYtNi4yIDEuMS0yLjItLjYtOC44LTQuOC0xMC4yLTUuNi0zLjQtMS45LTUuNi02LjktNS42LTE0IDAtMTEuNyA2LTI0LjYgMTMuMy0yOC45eiIvPjxwYXRoIGNsYXNzPSJzdDMiIGQ9Ik01MjguNyAyNzUuMWw2Ny4zLTM4LjljNy4zLTQuMiAxMy4zLTE3LjIgMTMuMy0yOC45cy02LTE3LjctMTMuMy0xMy41bC02Ny4zIDM4LjljLTcuMyA0LjItMTMuMyAxNy4yLTEzLjMgMjguOXM1LjkgMTcuNyAxMy4zIDEzLjV6TTYyNy44IDIxNy45bDY3LjMtMzguOWM3LjMtNC4yIDEzLjMtMTcuMiAxMy4zLTI4LjlzLTYtMTcuNy0xMy4zLTEzLjVsLTY3LjMgMzguOWMtNy4zIDQuMi0xMy4zIDE3LjItMTMuMyAyOC45czYgMTcuNyAxMy4zIDEzLjV6TTcyNi45IDE2MC42bDY3LjMtMzguOWM3LjMtNC4yIDEzLjMtMTcuMiAxMy4zLTI4LjggMC0xMS43LTYtMTcuNy0xMy4zLTEzLjVsLTY3LjMgMzguOGMtNy4zIDQuMi0xMy4zIDE3LjItMTMuMyAyOC44IDAgMTEuOCA2IDE3LjkgMTMuMyAxMy42eiIvPjxwYXRoIGNsYXNzPSJzdDIiIGQ9Ik00ODkuNCA3NTJ2LTI5LjlsNS4yLTN2MzguMmwtMjg1IDE2NC41Yy0yLjMgMS4zLTUuMi41LTYuNi0xLjgtLjQtLjctLjYtMS41LS42LTIuNGwyODctMTY1LjZ6TTgwNS45IDU2OC41VjM3Ny4zbDUuMi0zdjE5NS4zYzAgMi42LTEuNCA1LTMuNiA2LjNMNTE5IDc0Mi41di04LjNsMjg2LjktMTY1Ljd6Ii8+PC9nPjwvc3ZnPg==";

/***/ }),

/***/ "./images/spot/releases.svg":
/*!**********************************!*\
  !*** ./images/spot/releases.svg ***!
  \**********************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

module.exports = __webpack_require__.p + "assets/releases.70c2a2b15ce0006e598a.svg";

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_views_projectsDashboard_index_tsx.d805fb8103777fc7c1ff3bde79caab6a.js.map