(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_components_modals_addDashboardWidgetModal_tsx-app_utils_discover_charts_tsx-app_utils_wit-3c3c39"],{

/***/ "./app/components/dashboards/issueWidgetQueriesForm.tsx":
/*!**************************************************************!*\
  !*** ./app/components/dashboards/issueWidgetQueriesForm.tsx ***!
  \**************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "SearchConditionsWrapper": () => (/* binding */ SearchConditionsWrapper),
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var lodash_cloneDeep__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! lodash/cloneDeep */ "../node_modules/lodash/cloneDeep.js");
/* harmony import */ var lodash_cloneDeep__WEBPACK_IMPORTED_MODULE_5___default = /*#__PURE__*/__webpack_require__.n(lodash_cloneDeep__WEBPACK_IMPORTED_MODULE_5__);
/* harmony import */ var sentry_components_forms_field__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/forms/field */ "./app/components/forms/field/index.tsx");
/* harmony import */ var sentry_components_forms_selectControl__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/forms/selectControl */ "./app/components/forms/selectControl.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/utils/discover/fields */ "./app/utils/discover/fields.tsx");
/* harmony import */ var sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/views/dashboardsV2/types */ "./app/views/dashboardsV2/types.tsx");
/* harmony import */ var sentry_views_dashboardsV2_widgetBuilder_buildSteps_filterResultsStep_issuesSearchBar__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/views/dashboardsV2/widgetBuilder/buildSteps/filterResultsStep/issuesSearchBar */ "./app/views/dashboardsV2/widgetBuilder/buildSteps/filterResultsStep/issuesSearchBar.tsx");
/* harmony import */ var sentry_views_dashboardsV2_widgetBuilder_issueWidget_utils__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/views/dashboardsV2/widgetBuilder/issueWidget/utils */ "./app/views/dashboardsV2/widgetBuilder/issueWidget/utils.tsx");
/* harmony import */ var sentry_views_issueList_utils__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/views/issueList/utils */ "./app/views/issueList/utils.tsx");
/* harmony import */ var _widgetQueryFields__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! ./widgetQueryFields */ "./app/components/dashboards/widgetQueryFields.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");





function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }
















/**
 * Contain widget queries interactions and signal changes via the onChange
 * callback. This component's state should live in the parent.
 */
class IssueWidgetQueriesForm extends react__WEBPACK_IMPORTED_MODULE_4__.Component {
  constructor(props) {
    super(props);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleFieldChange", field => {
      const {
        query,
        onChange
      } = this.props;
      const widgetQuery = query;
      return function handleChange(value) {
        const newQuery = { ...widgetQuery,
          [field]: value
        };
        onChange(newQuery);
      };
    });

    this.state = {
      blurTimeout: undefined
    };
  }

  componentWillUnmount() {
    if (this.state.blurTimeout) {
      window.clearTimeout(this.state.blurTimeout);
    }
  } // Handle scalar field values changing.


  render() {
    var _query$fields, _organization$feature;

    const {
      organization,
      error,
      query,
      selection,
      fieldOptions,
      onChange
    } = this.props;
    const explodedFields = ((_query$fields = query.fields) !== null && _query$fields !== void 0 ? _query$fields : [...query.columns, ...query.aggregates]).map(field => (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_10__.explodeField)({
      field
    }));
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsxs)(QueryWrapper, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_components_forms_field__WEBPACK_IMPORTED_MODULE_6__["default"], {
        label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('Query'),
        inline: false,
        style: {
          paddingBottom: `8px`
        },
        flexibleControlStateSize: true,
        stacked: true,
        error: error === null || error === void 0 ? void 0 : error.conditions,
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(SearchConditionsWrapper, {
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_views_dashboardsV2_widgetBuilder_buildSteps_filterResultsStep_issuesSearchBar__WEBPACK_IMPORTED_MODULE_12__.IssuesSearchBar, {
            widgetQuery: query,
            pageFilters: selection,
            organization: organization,
            onClose: field => {
              this.handleFieldChange('conditions')(field);
            }
          })
        })
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(_widgetQueryFields__WEBPACK_IMPORTED_MODULE_15__["default"], {
        widgetType: sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_11__.WidgetType.ISSUE,
        displayType: sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_11__.DisplayType.TABLE,
        fieldOptions: fieldOptions,
        errors: error,
        fields: explodedFields,
        organization: organization,
        onChange: fields => {
          const fieldStrings = fields.map(field => (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_10__.generateFieldAsString)(field));
          const newQuery = lodash_cloneDeep__WEBPACK_IMPORTED_MODULE_5___default()(query);
          newQuery.fields = fieldStrings;
          const {
            columns,
            aggregates
          } = (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_10__.getColumnsAndAggregates)(fieldStrings);
          newQuery.aggregates = aggregates;
          newQuery.columns = columns;
          onChange(newQuery);
        }
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_components_forms_field__WEBPACK_IMPORTED_MODULE_6__["default"], {
        label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('Sort by'),
        inline: false,
        flexibleControlStateSize: true,
        stacked: true,
        error: error === null || error === void 0 ? void 0 : error.orderby,
        style: {
          marginBottom: (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__["default"])(1)
        },
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_components_forms_selectControl__WEBPACK_IMPORTED_MODULE_7__["default"], {
          value: query.orderby || sentry_views_issueList_utils__WEBPACK_IMPORTED_MODULE_14__.IssueSortOptions.DATE,
          name: "orderby",
          options: (0,sentry_views_dashboardsV2_widgetBuilder_issueWidget_utils__WEBPACK_IMPORTED_MODULE_13__.generateIssueWidgetOrderOptions)(organization === null || organization === void 0 ? void 0 : (_organization$feature = organization.features) === null || _organization$feature === void 0 ? void 0 : _organization$feature.includes('issue-list-trend-sort')),
          onChange: option => this.handleFieldChange('orderby')(option.value)
        })
      })]
    });
  }

}

IssueWidgetQueriesForm.displayName = "IssueWidgetQueriesForm";

const QueryWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "eg4w5yo1"
} : 0)( true ? {
  name: "17kbf9e",
  styles: "position:relative;padding-bottom:16px"
} : 0);

const SearchConditionsWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "eg4w5yo0"
} : 0)("display:flex;align-items:center;>*+*{margin-left:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_9__["default"])(1), ";}" + ( true ? "" : 0));
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (IssueWidgetQueriesForm);

/***/ }),

/***/ "./app/components/modals/addDashboardWidgetModal.tsx":
/*!***********************************************************!*\
  !*** ./app/components/modals/addDashboardWidgetModal.tsx ***!
  \***********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__),
/* harmony export */   "modalCss": () => (/* binding */ modalCss)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var react_router__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! react-router */ "../node_modules/react-router/es/index.js");
/* harmony import */ var lodash_cloneDeep__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! lodash/cloneDeep */ "../node_modules/lodash/cloneDeep.js");
/* harmony import */ var lodash_cloneDeep__WEBPACK_IMPORTED_MODULE_6___default = /*#__PURE__*/__webpack_require__.n(lodash_cloneDeep__WEBPACK_IMPORTED_MODULE_6__);
/* harmony import */ var lodash_pick__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! lodash/pick */ "../node_modules/lodash/pick.js");
/* harmony import */ var lodash_pick__WEBPACK_IMPORTED_MODULE_7___default = /*#__PURE__*/__webpack_require__.n(lodash_pick__WEBPACK_IMPORTED_MODULE_7__);
/* harmony import */ var lodash_set__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! lodash/set */ "../node_modules/lodash/set.js");
/* harmony import */ var lodash_set__WEBPACK_IMPORTED_MODULE_8___default = /*#__PURE__*/__webpack_require__.n(lodash_set__WEBPACK_IMPORTED_MODULE_8__);
/* harmony import */ var sentry_actionCreators_dashboards__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/actionCreators/dashboards */ "./app/actionCreators/dashboards.tsx");
/* harmony import */ var sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/actionCreators/indicator */ "./app/actionCreators/indicator.tsx");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_buttonBar__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/components/buttonBar */ "./app/components/buttonBar.tsx");
/* harmony import */ var sentry_components_dashboards_issueWidgetQueriesForm__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/components/dashboards/issueWidgetQueriesForm */ "./app/components/dashboards/issueWidgetQueriesForm.tsx");
/* harmony import */ var sentry_components_dashboards_widgetQueriesForm__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/components/dashboards/widgetQueriesForm */ "./app/components/dashboards/widgetQueriesForm.tsx");
/* harmony import */ var sentry_components_featureBadge__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/components/featureBadge */ "./app/components/featureBadge.tsx");
/* harmony import */ var sentry_components_forms_controls_radioGroup__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/components/forms/controls/radioGroup */ "./app/components/forms/controls/radioGroup.tsx");
/* harmony import */ var sentry_components_forms_field__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! sentry/components/forms/field */ "./app/components/forms/field/index.tsx");
/* harmony import */ var sentry_components_forms_field_fieldLabel__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! sentry/components/forms/field/fieldLabel */ "./app/components/forms/field/fieldLabel.tsx");
/* harmony import */ var sentry_components_forms_selectControl__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! sentry/components/forms/selectControl */ "./app/components/forms/selectControl.tsx");
/* harmony import */ var sentry_components_input__WEBPACK_IMPORTED_MODULE_20__ = __webpack_require__(/*! sentry/components/input */ "./app/components/input.tsx");
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_21__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_22__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_23__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_types__WEBPACK_IMPORTED_MODULE_24__ = __webpack_require__(/*! sentry/types */ "./app/types/index.tsx");
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_25__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");
/* harmony import */ var sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_26__ = __webpack_require__(/*! sentry/utils/analytics/trackAdvancedAnalyticsEvent */ "./app/utils/analytics/trackAdvancedAnalyticsEvent.tsx");
/* harmony import */ var sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_27__ = __webpack_require__(/*! sentry/utils/discover/fields */ "./app/utils/discover/fields.tsx");
/* harmony import */ var sentry_utils_measurements_measurements__WEBPACK_IMPORTED_MODULE_28__ = __webpack_require__(/*! sentry/utils/measurements/measurements */ "./app/utils/measurements/measurements.tsx");
/* harmony import */ var sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_29__ = __webpack_require__(/*! sentry/utils/withApi */ "./app/utils/withApi.tsx");
/* harmony import */ var sentry_utils_withPageFilters__WEBPACK_IMPORTED_MODULE_30__ = __webpack_require__(/*! sentry/utils/withPageFilters */ "./app/utils/withPageFilters.tsx");
/* harmony import */ var sentry_utils_withTags__WEBPACK_IMPORTED_MODULE_31__ = __webpack_require__(/*! sentry/utils/withTags */ "./app/utils/withTags.tsx");
/* harmony import */ var sentry_views_dashboardsV2_data__WEBPACK_IMPORTED_MODULE_32__ = __webpack_require__(/*! sentry/views/dashboardsV2/data */ "./app/views/dashboardsV2/data.tsx");
/* harmony import */ var sentry_views_dashboardsV2_layoutUtils__WEBPACK_IMPORTED_MODULE_33__ = __webpack_require__(/*! sentry/views/dashboardsV2/layoutUtils */ "./app/views/dashboardsV2/layoutUtils.tsx");
/* harmony import */ var sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_34__ = __webpack_require__(/*! sentry/views/dashboardsV2/types */ "./app/views/dashboardsV2/types.tsx");
/* harmony import */ var sentry_views_dashboardsV2_widgetBuilder_issueWidget_utils__WEBPACK_IMPORTED_MODULE_35__ = __webpack_require__(/*! sentry/views/dashboardsV2/widgetBuilder/issueWidget/utils */ "./app/views/dashboardsV2/widgetBuilder/issueWidget/utils.tsx");
/* harmony import */ var sentry_views_dashboardsV2_widgetBuilder_releaseWidget_fields__WEBPACK_IMPORTED_MODULE_36__ = __webpack_require__(/*! sentry/views/dashboardsV2/widgetBuilder/releaseWidget/fields */ "./app/views/dashboardsV2/widgetBuilder/releaseWidget/fields.tsx");
/* harmony import */ var sentry_views_dashboardsV2_widgetBuilder_utils__WEBPACK_IMPORTED_MODULE_37__ = __webpack_require__(/*! sentry/views/dashboardsV2/widgetBuilder/utils */ "./app/views/dashboardsV2/widgetBuilder/utils.tsx");
/* harmony import */ var sentry_views_dashboardsV2_widgetCard__WEBPACK_IMPORTED_MODULE_38__ = __webpack_require__(/*! sentry/views/dashboardsV2/widgetCard */ "./app/views/dashboardsV2/widgetCard/index.tsx");
/* harmony import */ var sentry_views_eventsV2_utils__WEBPACK_IMPORTED_MODULE_39__ = __webpack_require__(/*! sentry/views/eventsV2/utils */ "./app/views/eventsV2/utils.tsx");
/* harmony import */ var _dashboardWidgetLibraryModal_tabsButtonBar__WEBPACK_IMPORTED_MODULE_40__ = __webpack_require__(/*! ./dashboardWidgetLibraryModal/tabsButtonBar */ "./app/components/modals/dashboardWidgetLibraryModal/tabsButtonBar.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_41__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");





function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }









































const newDiscoverQuery = {
  name: '',
  fields: ['count()'],
  columns: [],
  aggregates: ['count()'],
  conditions: '',
  orderby: ''
};
const newIssueQuery = {
  name: '',
  fields: ['issue', 'assignee', 'title'],
  columns: ['issue', 'assignee', 'title'],
  aggregates: [],
  conditions: '',
  orderby: ''
};
const newMetricsQuery = {
  name: '',
  fields: [`crash_free_rate(${sentry_types__WEBPACK_IMPORTED_MODULE_24__.SessionField.SESSION})`],
  columns: [],
  aggregates: [`crash_free_rate(${sentry_types__WEBPACK_IMPORTED_MODULE_24__.SessionField.SESSION})`],
  conditions: '',
  orderby: ''
};
const DiscoverDataset = [sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_34__.WidgetType.DISCOVER, (0,sentry_locale__WEBPACK_IMPORTED_MODULE_22__.t)('All Events (Errors and Transactions)')];
const IssueDataset = [sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_34__.WidgetType.ISSUE, (0,sentry_locale__WEBPACK_IMPORTED_MODULE_22__.t)('Issues (States, Assignment, Time, etc.)')];
const MetricsDataset = [sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_34__.WidgetType.RELEASE, (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_41__.jsxs)(react__WEBPACK_IMPORTED_MODULE_4__.Fragment, {
  children: [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_22__.t)('Health (Releases, sessions)'), " ", (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_41__.jsx)(sentry_components_featureBadge__WEBPACK_IMPORTED_MODULE_15__["default"], {
    type: "alpha"
  })]
}, "metrics-dataset")];

class AddDashboardWidgetModal extends react__WEBPACK_IMPORTED_MODULE_4__.Component {
  constructor(props) {
    var _widget$widgetType;

    super(props);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleSubmit", async event => {
      event.preventDefault();
      const {
        api,
        closeModal,
        organization,
        onAddWidget,
        onUpdateWidget,
        widget: previousWidget,
        source
      } = this.props;
      this.setState({
        loading: true
      });
      let errors = {};
      const widgetData = (0,sentry_views_dashboardsV2_layoutUtils__WEBPACK_IMPORTED_MODULE_33__.assignTempId)(lodash_pick__WEBPACK_IMPORTED_MODULE_7___default()(this.state, ['title', 'displayType', 'interval', 'queries', 'widgetType']));

      if (previousWidget) {
        widgetData.layout = previousWidget === null || previousWidget === void 0 ? void 0 : previousWidget.layout;
      } // Only Table and Top N views need orderby


      if (![sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_34__.DisplayType.TABLE, sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_34__.DisplayType.TOP_N].includes(widgetData.displayType)) {
        widgetData.queries.forEach(query => {
          query.orderby = '';
        });
      }

      try {
        await (0,sentry_actionCreators_dashboards__WEBPACK_IMPORTED_MODULE_9__.validateWidget)(api, organization.slug, widgetData);

        if (typeof onUpdateWidget === 'function' && !!previousWidget) {
          onUpdateWidget({
            id: previousWidget === null || previousWidget === void 0 ? void 0 : previousWidget.id,
            layout: previousWidget === null || previousWidget === void 0 ? void 0 : previousWidget.layout,
            ...widgetData
          });
          (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_10__.addSuccessMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_22__.t)('Updated widget.'));
          (0,sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_26__["default"])('dashboards_views.edit_widget_modal.confirm', {
            organization
          });
        } else if (onAddWidget) {
          var _widgetData$widgetTyp;

          onAddWidget(widgetData);
          (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_10__.addSuccessMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_22__.t)('Added widget.'));
          (0,sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_26__["default"])('dashboards_views.add_widget_modal.confirm', {
            organization,
            data_set: (_widgetData$widgetTyp = widgetData.widgetType) !== null && _widgetData$widgetTyp !== void 0 ? _widgetData$widgetTyp : sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_34__.WidgetType.DISCOVER
          });
        }

        if (source === sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_34__.DashboardWidgetSource.DASHBOARDS) {
          closeModal();
        }
      } catch (err) {
        var _err$responseJSON;

        errors = (0,sentry_views_dashboardsV2_widgetBuilder_utils__WEBPACK_IMPORTED_MODULE_37__.mapErrors)((_err$responseJSON = err === null || err === void 0 ? void 0 : err.responseJSON) !== null && _err$responseJSON !== void 0 ? _err$responseJSON : {}, {});
        this.setState({
          errors
        });
      } finally {
        this.setState({
          loading: false
        });

        if (this.omitDashboardProp) {
          this.handleSubmitFromSelectedDashboard(errors, widgetData);
        }

        if (this.fromLibrary) {
          this.handleSubmitFromLibrary(errors, widgetData);
        }
      }
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleSubmitFromSelectedDashboard", (errors, widgetData) => {
      const {
        closeModal,
        organization,
        selection
      } = this.props;
      const {
        selectedDashboard,
        dashboards
      } = this.state; // Validate that a dashboard was selected since api call to /dashboards/widgets/ does not check for dashboard

      if (!selectedDashboard || !(dashboards.find(_ref => {
        let {
          title,
          id
        } = _ref;
        return title === (selectedDashboard === null || selectedDashboard === void 0 ? void 0 : selectedDashboard.label) && id === (selectedDashboard === null || selectedDashboard === void 0 ? void 0 : selectedDashboard.value);
      }) || selectedDashboard.value === sentry_views_dashboardsV2_widgetBuilder_utils__WEBPACK_IMPORTED_MODULE_37__.NEW_DASHBOARD_ID)) {
        errors.dashboard = (0,sentry_locale__WEBPACK_IMPORTED_MODULE_22__.t)('This field may not be blank');
        this.setState({
          errors
        });
      }

      if (!Object.keys(errors).length && selectedDashboard) {
        closeModal();
        const queryData = {
          queryNames: [],
          queryConditions: [],
          queryFields: [...widgetData.queries[0].columns, ...widgetData.queries[0].aggregates],
          queryOrderby: widgetData.queries[0].orderby
        };
        widgetData.queries.forEach(query => {
          queryData.queryNames.push(query.name);
          queryData.queryConditions.push(query.conditions);
        });
        const pathQuery = {
          displayType: widgetData.displayType,
          interval: widgetData.interval,
          title: widgetData.title,
          ...queryData,
          // Propagate page filters
          ...selection.datetime,
          project: selection.projects,
          environment: selection.environments
        };
        (0,sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_26__["default"])('discover_views.add_to_dashboard.confirm', {
          organization
        });

        if (selectedDashboard.value === sentry_views_dashboardsV2_widgetBuilder_utils__WEBPACK_IMPORTED_MODULE_37__.NEW_DASHBOARD_ID) {
          react_router__WEBPACK_IMPORTED_MODULE_5__.browserHistory.push({
            pathname: `/organizations/${organization.slug}/dashboards/new/`,
            query: pathQuery
          });
        } else {
          react_router__WEBPACK_IMPORTED_MODULE_5__.browserHistory.push({
            pathname: `/organizations/${organization.slug}/dashboard/${selectedDashboard.value}/`,
            query: pathQuery
          });
        }
      }
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleSubmitFromLibrary", (errors, widgetData) => {
      var _widgetData$widgetTyp2;

      const {
        closeModal,
        dashboard,
        onAddLibraryWidget,
        organization
      } = this.props;

      if (!dashboard) {
        errors.dashboard = (0,sentry_locale__WEBPACK_IMPORTED_MODULE_22__.t)('This field may not be blank');
        this.setState({
          errors
        });
        (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_10__.addErrorMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_22__.t)('Widget may only be added to a Dashboard'));
      }

      if (!Object.keys(errors).length && dashboard && onAddLibraryWidget) {
        onAddLibraryWidget([...dashboard.widgets, widgetData]);
        closeModal();
      }

      (0,sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_26__["default"])('dashboards_views.add_widget_modal.save', {
        organization,
        data_set: (_widgetData$widgetTyp2 = widgetData.widgetType) !== null && _widgetData$widgetTyp2 !== void 0 ? _widgetData$widgetTyp2 : sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_34__.WidgetType.DISCOVER
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleDefaultFields", newDisplayType => {
      const {
        displayType,
        defaultWidgetQuery,
        defaultTableColumns,
        widget
      } = this.props;
      this.setState(prevState => {
        const newState = lodash_cloneDeep__WEBPACK_IMPORTED_MODULE_6___default()(prevState);
        const normalized = (0,sentry_views_dashboardsV2_widgetBuilder_utils__WEBPACK_IMPORTED_MODULE_37__.normalizeQueries)({
          displayType: newDisplayType,
          queries: prevState.queries
        });

        if (newDisplayType === sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_34__.DisplayType.TOP_N) {
          // TOP N display should only allow a single query
          normalized.splice(1);
        }

        if (newDisplayType === sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_34__.DisplayType.WORLD_MAP && prevState.widgetType === sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_34__.WidgetType.RELEASE) {
          // World Map display type only supports Discover Dataset
          // so set state to default discover query.
          lodash_set__WEBPACK_IMPORTED_MODULE_8___default()(newState, 'queries', (0,sentry_views_dashboardsV2_widgetBuilder_utils__WEBPACK_IMPORTED_MODULE_37__.normalizeQueries)({
            displayType: newDisplayType,
            queries: [newDiscoverQuery]
          }));
          lodash_set__WEBPACK_IMPORTED_MODULE_8___default()(newState, 'widgetType', sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_34__.WidgetType.DISCOVER);
          return { ...newState,
            errors: undefined
          };
        }

        if (!prevState.userHasModified) {
          // If the Widget is an issue widget,
          if (newDisplayType === sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_34__.DisplayType.TABLE && (widget === null || widget === void 0 ? void 0 : widget.widgetType) === sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_34__.WidgetType.ISSUE) {
            lodash_set__WEBPACK_IMPORTED_MODULE_8___default()(newState, 'queries', widget.queries);
            lodash_set__WEBPACK_IMPORTED_MODULE_8___default()(newState, 'widgetType', sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_34__.WidgetType.ISSUE);
            return { ...newState,
              errors: undefined
            };
          } // Default widget provided by Add to Dashboard from Discover


          if (defaultWidgetQuery && defaultTableColumns) {
            // If switching to Table visualization, use saved query fields for Y-Axis if user has not made query changes
            // This is so the widget can reflect the same columns as the table in Discover without requiring additional user input
            if (newDisplayType === sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_34__.DisplayType.TABLE) {
              normalized.forEach(query => {
                query.fields = [...defaultTableColumns];
                const {
                  columns,
                  aggregates
                } = (0,sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_27__.getColumnsAndAggregates)([...defaultTableColumns]);
                query.aggregates = aggregates;
                query.columns = columns;
              });
            } else if (newDisplayType === displayType) {
              // When switching back to original display type, default fields back to the fields provided from the discover query
              normalized.forEach(query => {
                query.aggregates = [...defaultWidgetQuery.aggregates];
                query.columns = [...defaultWidgetQuery.columns];
                query.fields = (0,sentry_utils__WEBPACK_IMPORTED_MODULE_25__.defined)(defaultWidgetQuery.fields) ? [...defaultWidgetQuery.fields] : [...defaultWidgetQuery.columns, ...defaultWidgetQuery.aggregates];
                query.orderby = defaultWidgetQuery.orderby;
              });
            }
          }
        }

        if (prevState.widgetType === sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_34__.WidgetType.ISSUE) {
          lodash_set__WEBPACK_IMPORTED_MODULE_8___default()(newState, 'widgetType', sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_34__.WidgetType.DISCOVER);
        }

        lodash_set__WEBPACK_IMPORTED_MODULE_8___default()(newState, 'queries', normalized);
        return { ...newState,
          errors: undefined
        };
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleFieldChange", field => value => {
      const {
        organization,
        source
      } = this.props;
      const {
        displayType
      } = this.state;
      this.setState(prevState => {
        const newState = lodash_cloneDeep__WEBPACK_IMPORTED_MODULE_6___default()(prevState);
        lodash_set__WEBPACK_IMPORTED_MODULE_8___default()(newState, field, value);
        (0,sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_26__["default"])('dashboards_views.add_widget_modal.change', {
          from: source,
          field,
          value,
          widget_type: prevState.widgetType,
          organization
        });
        return { ...newState,
          errors: undefined
        };
      });

      if (field === 'displayType' && value !== displayType) {
        this.handleDefaultFields(value);
      }
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleQueryChange", (widgetQuery, index) => {
      this.setState(prevState => {
        const newState = lodash_cloneDeep__WEBPACK_IMPORTED_MODULE_6___default()(prevState);
        lodash_set__WEBPACK_IMPORTED_MODULE_8___default()(newState, `queries.${index}`, widgetQuery);
        lodash_set__WEBPACK_IMPORTED_MODULE_8___default()(newState, 'userHasModified', true);
        return { ...newState,
          errors: undefined
        };
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleQueryRemove", index => {
      this.setState(prevState => {
        const newState = lodash_cloneDeep__WEBPACK_IMPORTED_MODULE_6___default()(prevState);
        newState.queries.splice(index, 1);
        return { ...newState,
          errors: undefined
        };
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleAddSearchConditions", () => {
      this.setState(prevState => {
        const newState = lodash_cloneDeep__WEBPACK_IMPORTED_MODULE_6___default()(prevState);
        const query = lodash_cloneDeep__WEBPACK_IMPORTED_MODULE_6___default()(newDiscoverQuery);
        query.fields = this.state.queries[0].fields;
        query.aggregates = this.state.queries[0].aggregates;
        query.columns = this.state.queries[0].columns;
        newState.queries.push(query);
        return newState;
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleDatasetChange", widgetType => {
      const {
        widget
      } = this.props;
      this.setState(prevState => {
        const newState = lodash_cloneDeep__WEBPACK_IMPORTED_MODULE_6___default()(prevState);
        newState.queries.splice(0, newState.queries.length);
        lodash_set__WEBPACK_IMPORTED_MODULE_8___default()(newState, 'widgetType', widgetType);
        newState.queries.push(...((widget === null || widget === void 0 ? void 0 : widget.widgetType) === widgetType ? widget.queries : [this.defaultQuery(widgetType)]));
        lodash_set__WEBPACK_IMPORTED_MODULE_8___default()(newState, 'userHasModified', true);
        return { ...newState,
          errors: undefined
        };
      });
    });

    const {
      widget: _widget,
      defaultTitle,
      displayType: _displayType,
      defaultWidgetQuery: _defaultWidgetQuery
    } = props;

    if (!_widget) {
      this.state = {
        title: defaultTitle !== null && defaultTitle !== void 0 ? defaultTitle : '',
        displayType: _displayType !== null && _displayType !== void 0 ? _displayType : sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_34__.DisplayType.TABLE,
        interval: '5m',
        queries: [_defaultWidgetQuery ? { ..._defaultWidgetQuery
        } : { ...newDiscoverQuery
        }],
        errors: undefined,
        loading: !!this.omitDashboardProp,
        dashboards: [],
        userHasModified: false,
        widgetType: sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_34__.WidgetType.DISCOVER
      };
      return;
    }

    this.state = {
      title: _widget.title,
      displayType: _widget.displayType,
      interval: _widget.interval,
      queries: (0,sentry_views_dashboardsV2_widgetBuilder_utils__WEBPACK_IMPORTED_MODULE_37__.normalizeQueries)({
        displayType: _widget.displayType,
        queries: _widget.queries
      }),
      errors: undefined,
      loading: false,
      dashboards: [],
      userHasModified: false,
      widgetType: (_widget$widgetType = _widget.widgetType) !== null && _widget$widgetType !== void 0 ? _widget$widgetType : sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_34__.WidgetType.DISCOVER
    };
  }

  componentDidMount() {
    if (this.omitDashboardProp) {
      this.fetchDashboards();
    }
  }

  get omitDashboardProp() {
    // when opening from discover or issues page, the user selects the dashboard in the widget UI
    return [sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_34__.DashboardWidgetSource.DISCOVERV2, sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_34__.DashboardWidgetSource.ISSUE_DETAILS].includes(this.props.source);
  }

  get fromLibrary() {
    return this.props.source === sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_34__.DashboardWidgetSource.LIBRARY;
  }

  defaultQuery(widgetType) {
    switch (widgetType) {
      case sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_34__.WidgetType.ISSUE:
        return newIssueQuery;

      case sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_34__.WidgetType.RELEASE:
        return newMetricsQuery;

      case sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_34__.WidgetType.DISCOVER:
      default:
        return newDiscoverQuery;
    }
  }

  canAddSearchConditions() {
    const rightDisplayType = ['line', 'area', 'stacked_area', 'bar'].includes(this.state.displayType);
    const underQueryLimit = this.state.queries.length < 3;
    return rightDisplayType && underQueryLimit;
  }

  async fetchDashboards() {
    const {
      api,
      organization
    } = this.props;
    const promise = api.requestPromise(`/organizations/${organization.slug}/dashboards/`, {
      method: 'GET',
      query: {
        sort: 'myDashboardsAndRecentlyViewed'
      }
    });

    try {
      const dashboards = await promise;
      this.setState({
        dashboards
      });
    } catch (error) {
      var _error$responseJSON;

      const errorResponse = (_error$responseJSON = error === null || error === void 0 ? void 0 : error.responseJSON) !== null && _error$responseJSON !== void 0 ? _error$responseJSON : null;

      if (errorResponse) {
        (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_10__.addErrorMessage)(errorResponse);
      } else {
        (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_10__.addErrorMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_22__.t)('Unable to fetch dashboards'));
      }
    }

    this.setState({
      loading: false
    });
  }

  handleDashboardChange(option) {
    this.setState({
      selectedDashboard: option
    });
  }

  renderDashboardSelector() {
    const {
      errors,
      loading,
      dashboards
    } = this.state;
    const dashboardOptions = dashboards.map(d => {
      return {
        label: d.title,
        value: d.id,
        disabled: d.widgetDisplay.length >= sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_34__.MAX_WIDGETS,
        tooltip: d.widgetDisplay.length >= sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_34__.MAX_WIDGETS && (0,sentry_locale__WEBPACK_IMPORTED_MODULE_22__.tct)('Max widgets ([maxWidgets]) per dashboard reached.', {
          maxWidgets: sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_34__.MAX_WIDGETS
        }),
        tooltipOptions: {
          position: 'right'
        }
      };
    });
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_41__.jsxs)(react__WEBPACK_IMPORTED_MODULE_4__.Fragment, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_41__.jsx)("p", {
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_22__.t)(`Choose which dashboard you'd like to add this query to. It will appear as a widget.`)
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_41__.jsx)(sentry_components_forms_field__WEBPACK_IMPORTED_MODULE_17__["default"], {
        label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_22__.t)('Custom Dashboard'),
        inline: false,
        flexibleControlStateSize: true,
        stacked: true,
        error: errors === null || errors === void 0 ? void 0 : errors.dashboard,
        style: {
          marginBottom: (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_23__["default"])(1),
          position: 'relative'
        },
        required: true,
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_41__.jsx)(sentry_components_forms_selectControl__WEBPACK_IMPORTED_MODULE_19__["default"], {
          name: "dashboard",
          options: [{
            label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_22__.t)('+ Create New Dashboard'),
            value: 'new'
          }, ...dashboardOptions],
          onChange: option => this.handleDashboardChange(option),
          disabled: loading
        })
      })]
    });
  }

  renderWidgetQueryForm(querySelection, releaseWidgetFieldOptions) {
    var _errors$queries;

    const {
      organization,
      tags
    } = this.props;
    const state = this.state;
    const errors = state.errors;
    const issueWidgetFieldOptions = (0,sentry_views_dashboardsV2_widgetBuilder_issueWidget_utils__WEBPACK_IMPORTED_MODULE_35__.generateIssueWidgetFieldOptions)();

    const fieldOptions = measurementKeys => (0,sentry_views_eventsV2_utils__WEBPACK_IMPORTED_MODULE_39__.generateFieldOptions)({
      organization,
      tagKeys: Object.values(tags).map(_ref2 => {
        let {
          key
        } = _ref2;
        return key;
      }),
      measurementKeys,
      spanOperationBreakdownKeys: sentry_utils_discover_fields__WEBPACK_IMPORTED_MODULE_27__.SPAN_OP_BREAKDOWN_FIELDS
    });

    switch (state.widgetType) {
      case sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_34__.WidgetType.ISSUE:
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_41__.jsxs)(react__WEBPACK_IMPORTED_MODULE_4__.Fragment, {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_41__.jsx)(sentry_components_dashboards_issueWidgetQueriesForm__WEBPACK_IMPORTED_MODULE_13__["default"], {
            organization: organization,
            selection: querySelection,
            fieldOptions: issueWidgetFieldOptions,
            query: state.queries[0],
            error: errors === null || errors === void 0 ? void 0 : (_errors$queries = errors.queries) === null || _errors$queries === void 0 ? void 0 : _errors$queries[0],
            onChange: widgetQuery => this.handleQueryChange(widgetQuery, 0)
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_41__.jsx)(sentry_views_dashboardsV2_widgetCard__WEBPACK_IMPORTED_MODULE_38__["default"], {
            organization: organization,
            selection: querySelection,
            widget: { ...this.state,
              displayType: sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_34__.DisplayType.TABLE
            },
            isEditing: false,
            onDelete: () => undefined,
            onEdit: () => undefined,
            onDuplicate: () => undefined,
            widgetLimitReached: false,
            renderErrorMessage: errorMessage => typeof errorMessage === 'string' && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_41__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_21__.PanelAlert, {
              type: "error",
              children: errorMessage
            }),
            isSorting: false,
            currentWidgetDragging: false,
            noLazyLoad: true
          })]
        });

      case sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_34__.WidgetType.RELEASE:
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_41__.jsxs)(react__WEBPACK_IMPORTED_MODULE_4__.Fragment, {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_41__.jsx)(sentry_components_dashboards_widgetQueriesForm__WEBPACK_IMPORTED_MODULE_14__["default"], {
            organization: organization,
            selection: querySelection,
            displayType: state.displayType,
            widgetType: state.widgetType,
            queries: state.queries,
            errors: errors === null || errors === void 0 ? void 0 : errors.queries,
            fieldOptions: releaseWidgetFieldOptions,
            onChange: (queryIndex, widgetQuery) => this.handleQueryChange(widgetQuery, queryIndex),
            canAddSearchConditions: this.canAddSearchConditions(),
            handleAddSearchConditions: this.handleAddSearchConditions,
            handleDeleteQuery: this.handleQueryRemove
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_41__.jsx)(sentry_views_dashboardsV2_widgetCard__WEBPACK_IMPORTED_MODULE_38__["default"], {
            organization: organization,
            selection: querySelection,
            widget: this.state,
            isEditing: false,
            onDelete: () => undefined,
            onEdit: () => undefined,
            onDuplicate: () => undefined,
            widgetLimitReached: false,
            renderErrorMessage: errorMessage => typeof errorMessage === 'string' && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_41__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_21__.PanelAlert, {
              type: "error",
              children: errorMessage
            }),
            isSorting: false,
            currentWidgetDragging: false,
            noLazyLoad: true
          })]
        });

      case sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_34__.WidgetType.DISCOVER:
      default:
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_41__.jsxs)(react__WEBPACK_IMPORTED_MODULE_4__.Fragment, {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_41__.jsx)(sentry_utils_measurements_measurements__WEBPACK_IMPORTED_MODULE_28__["default"], {
            children: _ref3 => {
              let {
                measurements
              } = _ref3;
              const measurementKeys = Object.values(measurements).map(_ref4 => {
                let {
                  key
                } = _ref4;
                return key;
              });
              const amendedFieldOptions = fieldOptions(measurementKeys);
              return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_41__.jsx)(sentry_components_dashboards_widgetQueriesForm__WEBPACK_IMPORTED_MODULE_14__["default"], {
                organization: organization,
                selection: querySelection,
                fieldOptions: amendedFieldOptions,
                displayType: state.displayType,
                widgetType: state.widgetType,
                queries: state.queries,
                errors: errors === null || errors === void 0 ? void 0 : errors.queries,
                onChange: (queryIndex, widgetQuery) => this.handleQueryChange(widgetQuery, queryIndex),
                canAddSearchConditions: this.canAddSearchConditions(),
                handleAddSearchConditions: this.handleAddSearchConditions,
                handleDeleteQuery: this.handleQueryRemove
              });
            }
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_41__.jsx)(sentry_views_dashboardsV2_widgetCard__WEBPACK_IMPORTED_MODULE_38__["default"], {
            organization: organization,
            selection: querySelection,
            widget: this.state,
            isEditing: false,
            onDelete: () => undefined,
            onEdit: () => undefined,
            onDuplicate: () => undefined,
            widgetLimitReached: false,
            renderErrorMessage: errorMessage => typeof errorMessage === 'string' && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_41__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_21__.PanelAlert, {
              type: "error",
              children: errorMessage
            }),
            isSorting: false,
            currentWidgetDragging: false,
            noLazyLoad: true,
            showStoredAlert: true
          })]
        });
    }
  }

  render() {
    const {
      Footer,
      Body,
      Header,
      organization,
      widget: previousWidget,
      dashboard,
      selectedWidgets,
      onUpdateWidget,
      onAddLibraryWidget,
      source,
      selection,
      start,
      end,
      statsPeriod
    } = this.props;
    const state = this.state;
    const errors = state.errors;
    const isUpdatingWidget = typeof onUpdateWidget === 'function' && !!previousWidget;
    const showDatasetSelector = [sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_34__.DashboardWidgetSource.DASHBOARDS, sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_34__.DashboardWidgetSource.LIBRARY].includes(source) && state.displayType !== sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_34__.DisplayType.WORLD_MAP;
    const showIssueDatasetSelector = showDatasetSelector && state.displayType === sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_34__.DisplayType.TABLE;
    const showMetricsDatasetSelector = showDatasetSelector && organization.features.includes('dashboards-releases');
    const datasetChoices = [DiscoverDataset];

    if (showIssueDatasetSelector) {
      datasetChoices.push(IssueDataset);
    }

    if (showMetricsDatasetSelector) {
      datasetChoices.push(MetricsDataset);
    } // Construct PageFilters object using statsPeriod/start/end props so we can
    // render widget graph using saved timeframe from Saved/Prebuilt Query


    const querySelection = statsPeriod ? { ...selection,
      datetime: {
        start: null,
        end: null,
        period: statsPeriod,
        utc: null
      }
    } : start && end ? { ...selection,
      datetime: {
        start,
        end,
        period: null,
        utc: null
      }
    } : selection;
    const metricsWidgetFieldOptions = (0,sentry_views_dashboardsV2_widgetBuilder_releaseWidget_fields__WEBPACK_IMPORTED_MODULE_36__.generateReleaseWidgetFieldOptions)(Object.values(sentry_views_dashboardsV2_widgetBuilder_releaseWidget_fields__WEBPACK_IMPORTED_MODULE_36__.SESSIONS_FIELDS), sentry_views_dashboardsV2_widgetBuilder_releaseWidget_fields__WEBPACK_IMPORTED_MODULE_36__.SESSIONS_TAGS);
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_41__.jsxs)(react__WEBPACK_IMPORTED_MODULE_4__.Fragment, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_41__.jsx)(Header, {
        closeButton: true,
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_41__.jsx)("h4", {
          children: this.omitDashboardProp ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_22__.t)('Add Widget to Dashboard') : this.fromLibrary ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_22__.t)('Add Widget(s)') : isUpdatingWidget ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_22__.t)('Edit Widget') : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_22__.t)('Add Widget')
        })
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_41__.jsxs)(Body, {
        children: [this.omitDashboardProp && this.renderDashboardSelector(), this.fromLibrary && dashboard && onAddLibraryWidget ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_41__.jsx)(_dashboardWidgetLibraryModal_tabsButtonBar__WEBPACK_IMPORTED_MODULE_40__.TabsButtonBar, {
          activeTab: _dashboardWidgetLibraryModal_tabsButtonBar__WEBPACK_IMPORTED_MODULE_40__.TAB.Custom,
          organization: organization,
          dashboard: dashboard,
          selectedWidgets: selectedWidgets,
          customWidget: this.state,
          onAddWidget: onAddLibraryWidget
        }) : null, (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_41__.jsxs)(DoubleFieldWrapper, {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_41__.jsx)(StyledField, {
            "data-test-id": "widget-name",
            label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_22__.t)('Widget Name'),
            inline: false,
            flexibleControlStateSize: true,
            stacked: true,
            error: errors === null || errors === void 0 ? void 0 : errors.title,
            required: true,
            children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_41__.jsx)(sentry_components_input__WEBPACK_IMPORTED_MODULE_20__["default"], {
              "data-test-id": "widget-title-input",
              type: "text",
              name: "title",
              maxLength: 255,
              required: true,
              value: state.title,
              onChange: event => {
                this.handleFieldChange('title')(event.target.value);
              },
              disabled: state.loading
            })
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_41__.jsx)(StyledField, {
            "data-test-id": "chart-type",
            label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_22__.t)('Visualization Display'),
            inline: false,
            flexibleControlStateSize: true,
            stacked: true,
            error: errors === null || errors === void 0 ? void 0 : errors.displayType,
            required: true,
            children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_41__.jsx)(sentry_components_forms_selectControl__WEBPACK_IMPORTED_MODULE_19__["default"], {
              options: sentry_views_dashboardsV2_data__WEBPACK_IMPORTED_MODULE_32__.DISPLAY_TYPE_CHOICES.slice(),
              name: "displayType",
              value: state.displayType,
              onChange: option => this.handleFieldChange('displayType')(option.value),
              disabled: state.loading
            })
          })]
        }), (showIssueDatasetSelector || showMetricsDatasetSelector) && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_41__.jsxs)(react__WEBPACK_IMPORTED_MODULE_4__.Fragment, {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_41__.jsx)(StyledFieldLabel, {
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_22__.t)('Dataset')
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_41__.jsx)(StyledRadioGroup, {
            style: {
              flex: 1
            },
            choices: datasetChoices,
            value: state.widgetType,
            label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_22__.t)('Dataset'),
            onChange: this.handleDatasetChange
          })]
        }), this.renderWidgetQueryForm(querySelection, metricsWidgetFieldOptions)]
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_41__.jsx)(Footer, {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_41__.jsxs)(sentry_components_buttonBar__WEBPACK_IMPORTED_MODULE_12__["default"], {
          gap: 1,
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_41__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_11__["default"], {
            external: true,
            href: "https://docs.sentry.io/product/dashboards/custom-dashboards/#widget-builder",
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_22__.t)('Read the docs')
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_41__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_11__["default"], {
            "data-test-id": "add-widget",
            priority: "primary",
            type: "button",
            onClick: this.handleSubmit,
            disabled: state.loading,
            busy: state.loading,
            children: this.fromLibrary ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_22__.t)('Save') : isUpdatingWidget ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_22__.t)('Update Widget') : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_22__.t)('Add Widget')
          })]
        })
      })]
    });
  }

}

AddDashboardWidgetModal.displayName = "AddDashboardWidgetModal";

const DoubleFieldWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e19emimy3"
} : 0)("display:inline-grid;grid-template-columns:repeat(2, 1fr);grid-column-gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_23__["default"])(1), ";width:100%;" + ( true ? "" : 0));

const modalCss =  true ? {
  name: "l07bt5",
  styles: "width:100%;max-width:700px;margin:70px auto"
} : 0;

const StyledField = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_forms_field__WEBPACK_IMPORTED_MODULE_17__["default"],  true ? {
  target: "e19emimy2"
} : 0)( true ? {
  name: "bjn8wh",
  styles: "position:relative"
} : 0);

const StyledRadioGroup = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_forms_controls_radioGroup__WEBPACK_IMPORTED_MODULE_16__["default"],  true ? {
  target: "e19emimy1"
} : 0)("padding-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_23__["default"])(2), ";" + ( true ? "" : 0));

const StyledFieldLabel = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_forms_field_fieldLabel__WEBPACK_IMPORTED_MODULE_18__["default"],  true ? {
  target: "e19emimy0"
} : 0)("padding-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_23__["default"])(1), ";display:inline-flex;" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_29__["default"])((0,sentry_utils_withPageFilters__WEBPACK_IMPORTED_MODULE_30__["default"])((0,sentry_utils_withTags__WEBPACK_IMPORTED_MODULE_31__["default"])(AddDashboardWidgetModal))));

/***/ }),

/***/ "./app/components/modals/dashboardWidgetLibraryModal/tabsButtonBar.tsx":
/*!*****************************************************************************!*\
  !*** ./app/components/modals/dashboardWidgetLibraryModal/tabsButtonBar.tsx ***!
  \*****************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "TAB": () => (/* binding */ TAB),
/* harmony export */   "TabsButtonBar": () => (/* binding */ TabsButtonBar)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var sentry_actionCreators_modal__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/actionCreators/modal */ "./app/actionCreators/modal.tsx");
/* harmony import */ var sentry_components_featureBadge__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/featureBadge */ "./app/components/featureBadge.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");
/* harmony import */ var sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/utils/analytics/trackAdvancedAnalyticsEvent */ "./app/utils/analytics/trackAdvancedAnalyticsEvent.tsx");
/* harmony import */ var sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/views/dashboardsV2/types */ "./app/views/dashboardsV2/types.tsx");
/* harmony import */ var _button__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! ../../button */ "./app/components/button.tsx");
/* harmony import */ var _buttonBar__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! ../../buttonBar */ "./app/components/buttonBar.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! ./utils */ "./app/components/modals/dashboardWidgetLibraryModal/utils.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }













let TAB;

(function (TAB) {
  TAB["Library"] = "library";
  TAB["Custom"] = "custom";
})(TAB || (TAB = {}));

function TabsButtonBar(_ref) {
  let {
    activeTab,
    organization,
    dashboard,
    selectedWidgets,
    customWidget,
    onAddWidget
  } = _ref;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsxs)(StyledButtonBar, {
    active: activeTab,
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(CustomButton, {
      barId: TAB.Custom,
      onClick: () => {
        if (activeTab === TAB.Custom) {
          return;
        }

        (0,sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_6__["default"])('dashboards_views.widget_library.switch_tab', {
          organization,
          to: TAB.Custom
        });
        (0,sentry_actionCreators_modal__WEBPACK_IMPORTED_MODULE_1__.openAddDashboardWidgetModal)({
          organization,
          dashboard,
          selectedWidgets,
          widget: customWidget,
          source: sentry_views_dashboardsV2_types__WEBPACK_IMPORTED_MODULE_7__.DashboardWidgetSource.LIBRARY,
          onAddLibraryWidget: onAddWidget
        });
      },
      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Custom Widget')
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsxs)(LibraryButton, {
      barId: TAB.Library,
      "data-test-id": "library-tab",
      onClick: () => {
        if (activeTab === TAB.Library) {
          return;
        }

        (0,sentry_utils_analytics_trackAdvancedAnalyticsEvent__WEBPACK_IMPORTED_MODULE_6__["default"])('dashboards_views.widget_library.switch_tab', {
          organization,
          to: TAB.Library
        });
        (0,_utils__WEBPACK_IMPORTED_MODULE_10__.setWidgetLibraryVisit)();

        if ((0,sentry_utils__WEBPACK_IMPORTED_MODULE_5__.defined)(onAddWidget)) {
          (0,sentry_actionCreators_modal__WEBPACK_IMPORTED_MODULE_1__.openDashboardWidgetLibraryModal)({
            organization,
            dashboard,
            customWidget,
            initialSelectedWidgets: selectedWidgets,
            onAddWidget
          });
        }
      },
      children: [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Widget Library'), (0,_utils__WEBPACK_IMPORTED_MODULE_10__.shouldShowNewBadge)() && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_components_featureBadge__WEBPACK_IMPORTED_MODULE_2__["default"], {
        type: "new"
      })]
    })]
  });
}
TabsButtonBar.displayName = "TabsButtonBar";

const StyledButtonBar = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(_buttonBar__WEBPACK_IMPORTED_MODULE_9__["default"],  true ? {
  target: "ea8om9w2"
} : 0)("display:inline-flex;margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_4__["default"])(2), ";" + ( true ? "" : 0));

const LibraryButton = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(_button__WEBPACK_IMPORTED_MODULE_8__["default"],  true ? {
  target: "ea8om9w1"
} : 0)( true ? {
  name: "ygoyvl",
  styles: "border-top-left-radius:0;border-bottom-left-radius:0"
} : 0);

const CustomButton = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(_button__WEBPACK_IMPORTED_MODULE_8__["default"],  true ? {
  target: "ea8om9w0"
} : 0)( true ? {
  name: "1ga8o78",
  styles: "border-top-right-radius:0;border-bottom-right-radius:0;line-height:17px"
} : 0);

/***/ }),

/***/ "./app/components/modals/dashboardWidgetLibraryModal/utils.tsx":
/*!*********************************************************************!*\
  !*** ./app/components/modals/dashboardWidgetLibraryModal/utils.tsx ***!
  \*********************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "setWidgetLibraryVisit": () => (/* binding */ setWidgetLibraryVisit),
/* harmony export */   "shouldShowNewBadge": () => (/* binding */ shouldShowNewBadge)
/* harmony export */ });
const WIDGET_LIBRARY_VISITS = 'dashboard-widget-library-visits';
function shouldShowNewBadge() {
  const visits = localStorage.getItem(WIDGET_LIBRARY_VISITS);
  return visits === null || (parseInt(visits, 10) || 0) < 5;
}
function setWidgetLibraryVisit() {
  const visits = localStorage.getItem(WIDGET_LIBRARY_VISITS);
  localStorage.setItem(WIDGET_LIBRARY_VISITS, visits === null ? '1' : `${(parseInt(visits, 10) || 0) + 1}`);
}

/***/ }),

/***/ "./app/utils/discover/charts.tsx":
/*!***************************************!*\
  !*** ./app/utils/discover/charts.tsx ***!
  \***************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "axisDuration": () => (/* binding */ axisDuration),
/* harmony export */   "axisLabelFormatter": () => (/* binding */ axisLabelFormatter),
/* harmony export */   "axisLabelFormatterUsingAggregateOutputType": () => (/* binding */ axisLabelFormatterUsingAggregateOutputType),
/* harmony export */   "categorizeDuration": () => (/* binding */ categorizeDuration),
/* harmony export */   "findRangeOfMultiSeries": () => (/* binding */ findRangeOfMultiSeries),
/* harmony export */   "getDurationUnit": () => (/* binding */ getDurationUnit),
/* harmony export */   "tooltipFormatter": () => (/* binding */ tooltipFormatter),
/* harmony export */   "tooltipFormatterUsingAggregateOutputType": () => (/* binding */ tooltipFormatterUsingAggregateOutputType)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");
/* harmony import */ var sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/utils/formatters */ "./app/utils/formatters.tsx");




/**
 * Formatter for chart tooltips that handle a variety of discover and metrics result values.
 * If the result is metric values, the value can be of type number or null
 */

function tooltipFormatter(value) {
  let outputType = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 'number';

  if (!(0,sentry_utils__WEBPACK_IMPORTED_MODULE_2__.defined)(value)) {
    return '\u2014';
  }

  return tooltipFormatterUsingAggregateOutputType(value, outputType);
}
/**
 * Formatter for chart tooltips that takes the aggregate output type directly
 */

function tooltipFormatterUsingAggregateOutputType(value, type) {
  if (!(0,sentry_utils__WEBPACK_IMPORTED_MODULE_2__.defined)(value)) {
    return '\u2014';
  }

  switch (type) {
    case 'integer':
    case 'number':
      return value.toLocaleString();

    case 'percentage':
      return (0,sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_3__.formatPercentage)(value, 2);

    case 'duration':
      return (0,sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_3__.getDuration)(value / 1000, 2, true);

    case 'size':
      return (0,sentry_utils__WEBPACK_IMPORTED_MODULE_2__.formatBytesBase2)(value);

    default:
      return value.toString();
  }
}
/**
 * Formatter for chart axis labels that handle a variety of discover result values
 * This function is *very similar* to tooltipFormatter but outputs data with less precision.
 */

function axisLabelFormatter(value, outputType) {
  let abbreviation = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : false;
  let durationUnit = arguments.length > 3 ? arguments[3] : undefined;
  return axisLabelFormatterUsingAggregateOutputType(value, outputType, abbreviation, durationUnit);
}
/**
 * Formatter for chart axis labels that takes the aggregate output type directly
 */

function axisLabelFormatterUsingAggregateOutputType(value, type) {
  let abbreviation = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : false;
  let durationUnit = arguments.length > 3 ? arguments[3] : undefined;

  switch (type) {
    case 'integer':
    case 'number':
      return abbreviation ? (0,sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_3__.formatAbbreviatedNumber)(value) : value.toLocaleString();

    case 'percentage':
      return (0,sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_3__.formatPercentage)(value, 0);

    case 'duration':
      return axisDuration(value, durationUnit);

    case 'size':
      return (0,sentry_utils__WEBPACK_IMPORTED_MODULE_2__.formatBytesBase2)(value, 0);

    default:
      return value.toString();
  }
}
/**
 * Specialized duration formatting for axis labels.
 * In that context we are ok sacrificing accuracy for more
 * consistent sizing.
 *
 * @param value Number of milliseconds to format.
 */

function axisDuration(value, durationUnit) {
  var _durationUnit;

  (_durationUnit = durationUnit) !== null && _durationUnit !== void 0 ? _durationUnit : durationUnit = categorizeDuration(value);

  if (value === 0) {
    return '0';
  }

  switch (durationUnit) {
    case sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_3__.WEEK:
      {
        const label = (value / sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_3__.WEEK).toFixed(0);
        return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('%swk', label);
      }

    case sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_3__.DAY:
      {
        const label = (value / sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_3__.DAY).toFixed(0);
        return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('%sd', label);
      }

    case sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_3__.HOUR:
      {
        const label = (value / sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_3__.HOUR).toFixed(0);
        return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('%shr', label);
      }

    case sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_3__.MINUTE:
      {
        const label = (value / sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_3__.MINUTE).toFixed(0);
        return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('%smin', label);
      }

    case sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_3__.SECOND:
      {
        const label = (value / sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_3__.SECOND).toFixed(0);
        return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('%ss', label);
      }

    default:
      const label = value.toFixed(0);
      return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_1__.t)('%sms', label);
  }
}
/**
 * Given an array of series and an eCharts legend object,
 * finds the range of y values (min and max) based on which series is selected in the legend
 * Assumes series[0] > series[1] > ...
 * @param series Array of eCharts series
 * @param legend eCharts legend object
 * @returns
 */

function findRangeOfMultiSeries(series, legend) {
  var _series$;

  let range;

  if ((_series$ = series[0]) !== null && _series$ !== void 0 && _series$.data) {
    var _maxSeries2;

    let minSeries = series[0];
    let maxSeries;
    series.forEach((_ref, idx) => {
      var _legend$selected;

      let {
        seriesName,
        data
      } = _ref;

      if ((legend === null || legend === void 0 ? void 0 : (_legend$selected = legend.selected) === null || _legend$selected === void 0 ? void 0 : _legend$selected[seriesName]) !== false && data.length) {
        var _maxSeries;

        minSeries = series[idx];
        (_maxSeries = maxSeries) !== null && _maxSeries !== void 0 ? _maxSeries : maxSeries = series[idx];
      }
    });

    if ((_maxSeries2 = maxSeries) !== null && _maxSeries2 !== void 0 && _maxSeries2.data) {
      const max = Math.max(...maxSeries.data.map(_ref2 => {
        let {
          value
        } = _ref2;
        return value;
      }).filter(value => !!value));
      const min = Math.min(...minSeries.data.map(_ref3 => {
        let {
          value
        } = _ref3;
        return value;
      }).filter(value => !!value));
      range = {
        max,
        min
      };
    }
  }

  return range;
}
/**
 * Given a eCharts series and legend, returns the unit to be used on the yAxis for a duration chart
 * @param series eCharts series array
 * @param legend eCharts legend object
 * @returns
 */

function getDurationUnit(series, legend) {
  let durationUnit = 0;
  const range = findRangeOfMultiSeries(series, legend);

  if (range) {
    const avg = (range.max + range.min) / 2;
    durationUnit = categorizeDuration((range.max - range.min) / 5); // avg of 5 yAxis ticks per chart

    const numOfDigits = (avg / durationUnit).toFixed(0).length;

    if (numOfDigits > 6) {
      durationUnit = categorizeDuration(avg);
    }
  }

  return durationUnit;
}
/**
 * Categorizes the duration by Second, Minute, Hour, etc
 * Ex) categorizeDuration(1200) = MINUTE
 * @param value Duration in ms
 */

function categorizeDuration(value) {
  if (value >= sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_3__.WEEK) {
    return sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_3__.WEEK;
  }

  if (value >= sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_3__.DAY) {
    return sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_3__.DAY;
  }

  if (value >= sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_3__.HOUR) {
    return sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_3__.HOUR;
  }

  if (value >= sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_3__.MINUTE) {
    return sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_3__.MINUTE;
  }

  if (value >= sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_3__.SECOND) {
    return sentry_utils_formatters__WEBPACK_IMPORTED_MODULE_3__.SECOND;
  }

  return 1;
}

/***/ }),

/***/ "./app/utils/withProject.tsx":
/*!***********************************!*\
  !*** ./app/utils/withProject.tsx ***!
  \***********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_sentryTypes__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/sentryTypes */ "./app/sentryTypes.tsx");
/* harmony import */ var sentry_utils_getDisplayName__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/utils/getDisplayName */ "./app/utils/getDisplayName.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");






/**
 * Currently wraps component with project from context
 */
const withProject = WrappedComponent => {
  var _class;

  return _class = class extends react__WEBPACK_IMPORTED_MODULE_1__.Component {
    render() {
      const {
        project,
        ...props
      } = this.props;
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(WrappedComponent, {
        project: project !== null && project !== void 0 ? project : this.context.project,
        ...props
      });
    }

  }, (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(_class, "displayName", `withProject(${(0,sentry_utils_getDisplayName__WEBPACK_IMPORTED_MODULE_3__["default"])(WrappedComponent)})`), (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(_class, "contextTypes", {
    project: sentry_sentryTypes__WEBPACK_IMPORTED_MODULE_2__["default"].Project
  }), _class;
};

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (withProject);

/***/ }),

/***/ "./app/views/dashboardsV2/data.tsx":
/*!*****************************************!*\
  !*** ./app/views/dashboardsV2/data.tsx ***!
  \*****************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "DASHBOARDS_TEMPLATES": () => (/* binding */ DASHBOARDS_TEMPLATES),
/* harmony export */   "DEFAULT_STATS_PERIOD": () => (/* binding */ DEFAULT_STATS_PERIOD),
/* harmony export */   "DISPLAY_TYPE_CHOICES": () => (/* binding */ DISPLAY_TYPE_CHOICES),
/* harmony export */   "EMPTY_DASHBOARD": () => (/* binding */ EMPTY_DASHBOARD),
/* harmony export */   "INTERVAL_CHOICES": () => (/* binding */ INTERVAL_CHOICES)
/* harmony export */ });
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_guid__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/utils/guid */ "./app/utils/guid.tsx");
/* harmony import */ var _types__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./types */ "./app/views/dashboardsV2/types.tsx");



const EMPTY_DASHBOARD = {
  id: '',
  dateCreated: '',
  createdBy: undefined,
  title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Untitled dashboard'),
  widgets: [],
  projects: [],
  filters: {}
};
const DASHBOARDS_TEMPLATES = [{
  id: 'default-template',
  dateCreated: '',
  createdBy: undefined,
  title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('General Template'),
  description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Various Frontend and Backend Widgets'),
  projects: [],
  filters: {},
  widgets: [{
    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Number of Errors'),
    displayType: _types__WEBPACK_IMPORTED_MODULE_2__.DisplayType.BIG_NUMBER,
    interval: '5m',
    widgetType: _types__WEBPACK_IMPORTED_MODULE_2__.WidgetType.DISCOVER,
    tempId: (0,sentry_utils_guid__WEBPACK_IMPORTED_MODULE_1__.uniqueId)(),
    layout: {
      h: 1,
      minH: 1,
      w: 1,
      x: 0,
      y: 0
    },
    queries: [{
      name: '',
      fields: ['count()'],
      aggregates: ['count()'],
      columns: [],
      conditions: '!event.type:transaction',
      orderby: 'count()'
    }]
  }, {
    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Number of Issues'),
    displayType: _types__WEBPACK_IMPORTED_MODULE_2__.DisplayType.BIG_NUMBER,
    interval: '5m',
    widgetType: _types__WEBPACK_IMPORTED_MODULE_2__.WidgetType.DISCOVER,
    tempId: (0,sentry_utils_guid__WEBPACK_IMPORTED_MODULE_1__.uniqueId)(),
    layout: {
      h: 1,
      minH: 1,
      w: 1,
      x: 1,
      y: 0
    },
    queries: [{
      name: '',
      fields: ['count_unique(issue)'],
      aggregates: ['count_unique(issue)'],
      columns: [],
      conditions: '!event.type:transaction',
      orderby: 'count_unique(issue)'
    }]
  }, {
    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Events'),
    displayType: _types__WEBPACK_IMPORTED_MODULE_2__.DisplayType.LINE,
    interval: '5m',
    widgetType: _types__WEBPACK_IMPORTED_MODULE_2__.WidgetType.DISCOVER,
    tempId: (0,sentry_utils_guid__WEBPACK_IMPORTED_MODULE_1__.uniqueId)(),
    layout: {
      h: 2,
      minH: 2,
      w: 4,
      x: 2,
      y: 0
    },
    queries: [{
      name: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Events'),
      fields: ['count()'],
      aggregates: ['count()'],
      columns: [],
      conditions: '!event.type:transaction',
      orderby: 'count()'
    }]
  }, {
    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Affected Users'),
    displayType: _types__WEBPACK_IMPORTED_MODULE_2__.DisplayType.LINE,
    interval: '5m',
    widgetType: _types__WEBPACK_IMPORTED_MODULE_2__.WidgetType.DISCOVER,
    tempId: (0,sentry_utils_guid__WEBPACK_IMPORTED_MODULE_1__.uniqueId)(),
    layout: {
      h: 2,
      minH: 2,
      w: 1,
      x: 1,
      y: 2
    },
    queries: [{
      name: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Known Users'),
      fields: ['count_unique(user)'],
      aggregates: ['count_unique(user)'],
      columns: [],
      conditions: 'has:user.email !event.type:transaction',
      orderby: 'count_unique(user)'
    }, {
      name: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Anonymous Users'),
      fields: ['count_unique(user)'],
      aggregates: ['count_unique(user)'],
      columns: [],
      conditions: '!has:user.email !event.type:transaction',
      orderby: 'count_unique(user)'
    }]
  }, {
    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Handled vs. Unhandled'),
    displayType: _types__WEBPACK_IMPORTED_MODULE_2__.DisplayType.LINE,
    interval: '5m',
    widgetType: _types__WEBPACK_IMPORTED_MODULE_2__.WidgetType.DISCOVER,
    tempId: (0,sentry_utils_guid__WEBPACK_IMPORTED_MODULE_1__.uniqueId)(),
    layout: {
      h: 2,
      minH: 2,
      w: 1,
      x: 0,
      y: 2
    },
    queries: [{
      name: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Handled'),
      fields: ['count()'],
      aggregates: ['count()'],
      columns: [],
      conditions: 'error.handled:true',
      orderby: 'count()'
    }, {
      name: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Unhandled'),
      fields: ['count()'],
      aggregates: ['count()'],
      columns: [],
      conditions: 'error.handled:false',
      orderby: 'count()'
    }]
  }, {
    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Errors by Country'),
    displayType: _types__WEBPACK_IMPORTED_MODULE_2__.DisplayType.WORLD_MAP,
    interval: '5m',
    widgetType: _types__WEBPACK_IMPORTED_MODULE_2__.WidgetType.DISCOVER,
    tempId: (0,sentry_utils_guid__WEBPACK_IMPORTED_MODULE_1__.uniqueId)(),
    layout: {
      h: 4,
      minH: 2,
      w: 2,
      x: 4,
      y: 6
    },
    queries: [{
      name: '',
      fields: ['count()'],
      aggregates: ['count()'],
      columns: [],
      conditions: '!event.type:transaction has:geo.country_code',
      orderby: 'count()'
    }]
  }, {
    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('High Throughput Transactions'),
    displayType: _types__WEBPACK_IMPORTED_MODULE_2__.DisplayType.TABLE,
    interval: '5m',
    widgetType: _types__WEBPACK_IMPORTED_MODULE_2__.WidgetType.DISCOVER,
    tempId: (0,sentry_utils_guid__WEBPACK_IMPORTED_MODULE_1__.uniqueId)(),
    layout: {
      h: 4,
      minH: 2,
      w: 2,
      x: 0,
      y: 6
    },
    queries: [{
      name: '',
      fields: ['count()', 'transaction'],
      aggregates: ['count()'],
      columns: ['transaction'],
      conditions: '!event.type:error',
      orderby: '-count()'
    }]
  }, {
    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Errors by Browser'),
    displayType: _types__WEBPACK_IMPORTED_MODULE_2__.DisplayType.TABLE,
    interval: '5m',
    widgetType: _types__WEBPACK_IMPORTED_MODULE_2__.WidgetType.DISCOVER,
    tempId: (0,sentry_utils_guid__WEBPACK_IMPORTED_MODULE_1__.uniqueId)(),
    layout: {
      h: 4,
      minH: 2,
      w: 1,
      x: 5,
      y: 2
    },
    queries: [{
      name: '',
      fields: ['browser.name', 'count()'],
      aggregates: ['count()'],
      columns: ['browser.name'],
      conditions: '!event.type:transaction has:browser.name',
      orderby: '-count()'
    }]
  }, {
    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Overall User Misery'),
    displayType: _types__WEBPACK_IMPORTED_MODULE_2__.DisplayType.BIG_NUMBER,
    interval: '5m',
    widgetType: _types__WEBPACK_IMPORTED_MODULE_2__.WidgetType.DISCOVER,
    tempId: (0,sentry_utils_guid__WEBPACK_IMPORTED_MODULE_1__.uniqueId)(),
    layout: {
      h: 1,
      minH: 1,
      w: 1,
      x: 0,
      y: 1
    },
    queries: [{
      name: '',
      fields: ['user_misery(300)'],
      aggregates: ['user_misery(300)'],
      columns: [],
      conditions: '',
      orderby: ''
    }]
  }, {
    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Overall Apdex'),
    displayType: _types__WEBPACK_IMPORTED_MODULE_2__.DisplayType.BIG_NUMBER,
    interval: '5m',
    widgetType: _types__WEBPACK_IMPORTED_MODULE_2__.WidgetType.DISCOVER,
    tempId: (0,sentry_utils_guid__WEBPACK_IMPORTED_MODULE_1__.uniqueId)(),
    layout: {
      h: 1,
      minH: 1,
      w: 1,
      x: 1,
      y: 1
    },
    queries: [{
      name: '',
      fields: ['apdex(300)'],
      aggregates: ['apdex(300)'],
      columns: [],
      conditions: '',
      orderby: ''
    }]
  }, {
    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('High Throughput Transactions'),
    displayType: _types__WEBPACK_IMPORTED_MODULE_2__.DisplayType.TOP_N,
    interval: '5m',
    widgetType: _types__WEBPACK_IMPORTED_MODULE_2__.WidgetType.DISCOVER,
    tempId: (0,sentry_utils_guid__WEBPACK_IMPORTED_MODULE_1__.uniqueId)(),
    layout: {
      h: 2,
      minH: 2,
      w: 2,
      x: 0,
      y: 4
    },
    queries: [{
      name: '',
      fields: ['transaction', 'count()'],
      aggregates: ['count()'],
      columns: ['transaction'],
      conditions: '!event.type:error',
      orderby: '-count()'
    }]
  }, {
    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Issues Assigned to Me or My Teams'),
    displayType: _types__WEBPACK_IMPORTED_MODULE_2__.DisplayType.TABLE,
    interval: '5m',
    widgetType: _types__WEBPACK_IMPORTED_MODULE_2__.WidgetType.ISSUE,
    tempId: (0,sentry_utils_guid__WEBPACK_IMPORTED_MODULE_1__.uniqueId)(),
    layout: {
      h: 4,
      minH: 2,
      w: 2,
      x: 2,
      y: 2
    },
    queries: [{
      name: '',
      fields: ['assignee', 'issue', 'title'],
      aggregates: [],
      columns: ['assignee', 'issue', 'title'],
      conditions: 'assigned_or_suggested:me is:unresolved',
      orderby: 'priority'
    }]
  }, {
    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Transactions Ordered by Misery'),
    displayType: _types__WEBPACK_IMPORTED_MODULE_2__.DisplayType.TABLE,
    interval: '5m',
    widgetType: _types__WEBPACK_IMPORTED_MODULE_2__.WidgetType.DISCOVER,
    tempId: (0,sentry_utils_guid__WEBPACK_IMPORTED_MODULE_1__.uniqueId)(),
    layout: {
      h: 4,
      minH: 2,
      w: 2,
      y: 6,
      x: 2
    },
    queries: [{
      name: '',
      fields: ['transaction', 'user_misery(300)'],
      aggregates: ['user_misery(300)'],
      columns: ['transaction'],
      conditions: '',
      orderby: '-user_misery(300)'
    }]
  }, {
    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Errors by Browser Over Time'),
    displayType: _types__WEBPACK_IMPORTED_MODULE_2__.DisplayType.TOP_N,
    interval: '5m',
    widgetType: _types__WEBPACK_IMPORTED_MODULE_2__.WidgetType.DISCOVER,
    tempId: (0,sentry_utils_guid__WEBPACK_IMPORTED_MODULE_1__.uniqueId)(),
    layout: {
      h: 4,
      minH: 2,
      w: 1,
      x: 4,
      y: 2
    },
    queries: [{
      name: '',
      fields: ['browser.name', 'count()'],
      aggregates: ['count()'],
      columns: ['browser.name'],
      conditions: 'event.type:error has:browser.name',
      orderby: '-count()'
    }]
  }]
}, {
  id: 'frontend-template',
  title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Frontend Template'),
  dateCreated: '',
  createdBy: undefined,
  description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Erroring URLs and Web Vitals'),
  projects: [],
  filters: {},
  widgets: [{
    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Top 5 Issues by Unique Users Over Time'),
    displayType: _types__WEBPACK_IMPORTED_MODULE_2__.DisplayType.TOP_N,
    interval: '5m',
    widgetType: _types__WEBPACK_IMPORTED_MODULE_2__.WidgetType.DISCOVER,
    tempId: (0,sentry_utils_guid__WEBPACK_IMPORTED_MODULE_1__.uniqueId)(),
    layout: {
      h: 2,
      minH: 2,
      w: 4,
      x: 0,
      y: 4
    },
    queries: [{
      name: '',
      fields: ['issue', 'count_unique(user)'],
      aggregates: ['count_unique(user)'],
      columns: ['issue'],
      conditions: '',
      orderby: '-count_unique(user)'
    }]
  }, {
    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Errors by Browser as Percentage'),
    displayType: _types__WEBPACK_IMPORTED_MODULE_2__.DisplayType.AREA,
    interval: '5m',
    widgetType: _types__WEBPACK_IMPORTED_MODULE_2__.WidgetType.DISCOVER,
    tempId: (0,sentry_utils_guid__WEBPACK_IMPORTED_MODULE_1__.uniqueId)(),
    layout: {
      h: 4,
      minH: 2,
      w: 2,
      x: 0,
      y: 9
    },
    queries: [{
      name: '',
      fields: ['equation|count_if(browser.name,equals,Chrome)/count() * 100', 'equation|count_if(browser.name,equals,Firefox)/count() * 100', 'equation|count_if(browser.name,equals,Safari)/count() * 100'],
      aggregates: ['equation|count_if(browser.name,equals,Chrome)/count() * 100', 'equation|count_if(browser.name,equals,Firefox)/count() * 100', 'equation|count_if(browser.name,equals,Safari)/count() * 100'],
      columns: [],
      conditions: 'has:browser.name',
      orderby: ''
    }]
  }, {
    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Issues Assigned to Me or My Teams'),
    displayType: _types__WEBPACK_IMPORTED_MODULE_2__.DisplayType.TABLE,
    interval: '5m',
    widgetType: _types__WEBPACK_IMPORTED_MODULE_2__.WidgetType.ISSUE,
    tempId: (0,sentry_utils_guid__WEBPACK_IMPORTED_MODULE_1__.uniqueId)(),
    layout: {
      h: 4,
      minH: 2,
      w: 2,
      x: 4,
      y: 4
    },
    queries: [{
      name: '',
      fields: ['assignee', 'issue', 'title'],
      aggregates: [],
      columns: ['assignee', 'issue', 'title'],
      conditions: 'assigned_or_suggested:me is:unresolved',
      orderby: 'priority'
    }]
  }, {
    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Top 5 Issues by Unique Users'),
    displayType: _types__WEBPACK_IMPORTED_MODULE_2__.DisplayType.TABLE,
    interval: '5m',
    widgetType: _types__WEBPACK_IMPORTED_MODULE_2__.WidgetType.DISCOVER,
    tempId: (0,sentry_utils_guid__WEBPACK_IMPORTED_MODULE_1__.uniqueId)(),
    layout: {
      h: 3,
      minH: 2,
      w: 4,
      x: 0,
      y: 6
    },
    queries: [{
      name: '',
      fields: ['issue', 'count_unique(user)', 'title'],
      aggregates: ['count_unique(user)'],
      columns: ['issue', 'title'],
      conditions: '',
      orderby: '-count_unique(user)'
    }]
  }, {
    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('URLs grouped by Issue'),
    displayType: _types__WEBPACK_IMPORTED_MODULE_2__.DisplayType.TABLE,
    interval: '5m',
    widgetType: _types__WEBPACK_IMPORTED_MODULE_2__.WidgetType.DISCOVER,
    tempId: (0,sentry_utils_guid__WEBPACK_IMPORTED_MODULE_1__.uniqueId)(),
    layout: {
      h: 5,
      minH: 2,
      w: 2,
      x: 4,
      y: 8
    },
    queries: [{
      name: '',
      fields: ['http.url', 'issue', 'count_unique(user)'],
      aggregates: ['count_unique(user)'],
      columns: ['http.url', 'issue'],
      conditions: 'event.type:error',
      orderby: '-count_unique(user)'
    }]
  }, {
    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Transactions 404ing'),
    displayType: _types__WEBPACK_IMPORTED_MODULE_2__.DisplayType.TABLE,
    interval: '5m',
    widgetType: _types__WEBPACK_IMPORTED_MODULE_2__.WidgetType.DISCOVER,
    tempId: (0,sentry_utils_guid__WEBPACK_IMPORTED_MODULE_1__.uniqueId)(),
    layout: {
      h: 4,
      minH: 2,
      w: 2,
      x: 2,
      y: 9
    },
    queries: [{
      name: '',
      fields: ['transaction', 'count()'],
      aggregates: ['count()'],
      columns: ['transaction'],
      conditions: 'transaction.status:not_found',
      orderby: '-count()'
    }]
  }, {
    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Layout Shift Over Time'),
    displayType: _types__WEBPACK_IMPORTED_MODULE_2__.DisplayType.LINE,
    interval: '5m',
    widgetType: _types__WEBPACK_IMPORTED_MODULE_2__.WidgetType.DISCOVER,
    tempId: (0,sentry_utils_guid__WEBPACK_IMPORTED_MODULE_1__.uniqueId)(),
    layout: {
      h: 2,
      minH: 2,
      w: 1,
      x: 2,
      y: 0
    },
    queries: [{
      name: '',
      fields: ['p75(measurements.cls)'],
      aggregates: ['p75(measurements.cls)'],
      columns: [],
      conditions: '',
      orderby: ''
    }]
  }, {
    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('LCP by Country'),
    displayType: _types__WEBPACK_IMPORTED_MODULE_2__.DisplayType.WORLD_MAP,
    interval: '5m',
    widgetType: _types__WEBPACK_IMPORTED_MODULE_2__.WidgetType.DISCOVER,
    tempId: (0,sentry_utils_guid__WEBPACK_IMPORTED_MODULE_1__.uniqueId)(),
    layout: {
      h: 2,
      minH: 2,
      w: 2,
      x: 2,
      y: 2
    },
    queries: [{
      name: '',
      fields: ['p75(measurements.lcp)'],
      aggregates: ['p75(measurements.lcp)'],
      columns: [],
      conditions: 'has:geo.country_code',
      orderby: ''
    }]
  }, {
    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Page Load Over Time'),
    displayType: _types__WEBPACK_IMPORTED_MODULE_2__.DisplayType.LINE,
    interval: '5m',
    widgetType: _types__WEBPACK_IMPORTED_MODULE_2__.WidgetType.DISCOVER,
    tempId: (0,sentry_utils_guid__WEBPACK_IMPORTED_MODULE_1__.uniqueId)(),
    layout: {
      h: 2,
      minH: 2,
      w: 1,
      x: 3,
      y: 0
    },
    queries: [{
      name: '',
      fields: ['p75(measurements.lcp)', 'p75(measurements.fcp)'],
      aggregates: ['p75(measurements.lcp)', 'p75(measurements.fcp)'],
      columns: [],
      conditions: 'transaction.op:pageload',
      orderby: ''
    }]
  }, {
    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Slowest Pageloads'),
    displayType: _types__WEBPACK_IMPORTED_MODULE_2__.DisplayType.TABLE,
    interval: '5m',
    layout: {
      h: 2,
      minH: 2,
      w: 2,
      x: 0,
      y: 2
    },
    queries: [{
      name: '',
      fields: ['transaction', 'count()'],
      aggregates: ['count()'],
      columns: ['transaction'],
      conditions: 'transaction.op:pageload p75(measurements.lcp):>4s',
      orderby: '-count()'
    }]
  }, {
    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Overall LCP'),
    displayType: _types__WEBPACK_IMPORTED_MODULE_2__.DisplayType.BIG_NUMBER,
    interval: '5m',
    widgetType: _types__WEBPACK_IMPORTED_MODULE_2__.WidgetType.DISCOVER,
    tempId: (0,sentry_utils_guid__WEBPACK_IMPORTED_MODULE_1__.uniqueId)(),
    layout: {
      h: 1,
      minH: 1,
      w: 1,
      x: 0,
      y: 0
    },
    queries: [{
      name: '',
      fields: ['p75(measurements.lcp)'],
      aggregates: ['p75(measurements.lcp)'],
      columns: [],
      conditions: '',
      orderby: ''
    }]
  }, {
    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Slow Page Navigations'),
    displayType: _types__WEBPACK_IMPORTED_MODULE_2__.DisplayType.TABLE,
    interval: '5m',
    widgetType: _types__WEBPACK_IMPORTED_MODULE_2__.WidgetType.DISCOVER,
    tempId: (0,sentry_utils_guid__WEBPACK_IMPORTED_MODULE_1__.uniqueId)(),
    layout: {
      h: 4,
      minH: 2,
      w: 2,
      x: 4,
      y: 0
    },
    queries: [{
      name: '',
      fields: ['transaction', 'count()'],
      aggregates: ['count()'],
      columns: ['transaction'],
      conditions: 'transaction.duration:>2s',
      orderby: '-count()'
    }]
  }, {
    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Overall FCP'),
    displayType: _types__WEBPACK_IMPORTED_MODULE_2__.DisplayType.BIG_NUMBER,
    interval: '5m',
    widgetType: _types__WEBPACK_IMPORTED_MODULE_2__.WidgetType.DISCOVER,
    tempId: (0,sentry_utils_guid__WEBPACK_IMPORTED_MODULE_1__.uniqueId)(),
    layout: {
      h: 1,
      minH: 1,
      w: 1,
      x: 1,
      y: 0
    },
    queries: [{
      name: '',
      fields: ['p75(measurements.fcp)'],
      aggregates: ['p75(measurements.fcp)'],
      columns: [],
      conditions: '',
      orderby: ''
    }]
  }, {
    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Overall CLS'),
    displayType: _types__WEBPACK_IMPORTED_MODULE_2__.DisplayType.BIG_NUMBER,
    interval: '5m',
    widgetType: _types__WEBPACK_IMPORTED_MODULE_2__.WidgetType.DISCOVER,
    tempId: (0,sentry_utils_guid__WEBPACK_IMPORTED_MODULE_1__.uniqueId)(),
    layout: {
      h: 1,
      minH: 1,
      w: 1,
      x: 0,
      y: 1
    },
    queries: [{
      name: '',
      fields: ['p75(measurements.cls)'],
      aggregates: ['p75(measurements.cls)'],
      columns: [],
      conditions: '',
      orderby: ''
    }]
  }, {
    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Overall FID'),
    displayType: _types__WEBPACK_IMPORTED_MODULE_2__.DisplayType.BIG_NUMBER,
    interval: '5m',
    widgetType: _types__WEBPACK_IMPORTED_MODULE_2__.WidgetType.DISCOVER,
    tempId: (0,sentry_utils_guid__WEBPACK_IMPORTED_MODULE_1__.uniqueId)(),
    layout: {
      h: 1,
      minH: 1,
      w: 1,
      x: 1,
      y: 1
    },
    queries: [{
      name: '',
      fields: ['p75(measurements.fid)'],
      aggregates: ['p75(measurements.fid)'],
      columns: [],
      conditions: '',
      orderby: ''
    }]
  }]
}, {
  id: 'backend-template',
  title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Backend Template'),
  dateCreated: '',
  createdBy: undefined,
  description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Issues and Performance'),
  projects: [],
  filters: {},
  widgets: [{
    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Top 5 Issues by Unique Users Over Time'),
    displayType: _types__WEBPACK_IMPORTED_MODULE_2__.DisplayType.TOP_N,
    interval: '5m',
    widgetType: _types__WEBPACK_IMPORTED_MODULE_2__.WidgetType.DISCOVER,
    tempId: (0,sentry_utils_guid__WEBPACK_IMPORTED_MODULE_1__.uniqueId)(),
    layout: {
      h: 4,
      minH: 2,
      w: 2,
      x: 0,
      y: 6
    },
    queries: [{
      name: '',
      fields: ['issue', 'count_unique(user)'],
      aggregates: ['count_unique(user)'],
      columns: ['issue'],
      conditions: '',
      orderby: '-count_unique(user)'
    }]
  }, {
    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Transactions Erroring Over Time'),
    displayType: _types__WEBPACK_IMPORTED_MODULE_2__.DisplayType.TOP_N,
    interval: '5m',
    widgetType: _types__WEBPACK_IMPORTED_MODULE_2__.WidgetType.DISCOVER,
    tempId: (0,sentry_utils_guid__WEBPACK_IMPORTED_MODULE_1__.uniqueId)(),
    layout: {
      h: 2,
      minH: 2,
      w: 4,
      x: 2,
      y: 8
    },
    queries: [{
      name: '',
      fields: ['transaction', 'count()'],
      aggregates: ['count()'],
      columns: ['transaction'],
      conditions: 'transaction.status:internal_error',
      orderby: '-count()'
    }]
  }, {
    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Erroring Transactions by Percentage'),
    displayType: _types__WEBPACK_IMPORTED_MODULE_2__.DisplayType.TABLE,
    interval: '5m',
    widgetType: _types__WEBPACK_IMPORTED_MODULE_2__.WidgetType.DISCOVER,
    tempId: (0,sentry_utils_guid__WEBPACK_IMPORTED_MODULE_1__.uniqueId)(),
    layout: {
      h: 5,
      minH: 2,
      w: 2,
      x: 4,
      y: 10
    },
    queries: [{
      name: '',
      fields: ['equation|count_if(transaction.status,equals,internal_error) / count() * 100', 'transaction', 'count_if(transaction.status,equals,internal_error)', 'count()'],
      aggregates: ['equation|count_if(transaction.status,equals,internal_error) / count() * 100', 'count_if(transaction.status,equals,internal_error)', 'count()'],
      columns: ['transaction'],
      conditions: 'count():>100',
      orderby: '-equation[0]'
    }]
  }, {
    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Top 5 Issues by Unique Users'),
    displayType: _types__WEBPACK_IMPORTED_MODULE_2__.DisplayType.TABLE,
    interval: '5m',
    widgetType: _types__WEBPACK_IMPORTED_MODULE_2__.WidgetType.DISCOVER,
    tempId: (0,sentry_utils_guid__WEBPACK_IMPORTED_MODULE_1__.uniqueId)(),
    layout: {
      h: 5,
      minH: 2,
      w: 2,
      x: 0,
      y: 10
    },
    queries: [{
      name: '',
      fields: ['issue', 'count_unique(user)', 'title'],
      aggregates: ['count_unique(user)'],
      columns: ['issue', 'title'],
      conditions: '',
      orderby: '-count_unique(user)'
    }]
  }, {
    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Transactions Erroring'),
    displayType: _types__WEBPACK_IMPORTED_MODULE_2__.DisplayType.TABLE,
    interval: '5m',
    widgetType: _types__WEBPACK_IMPORTED_MODULE_2__.WidgetType.DISCOVER,
    tempId: (0,sentry_utils_guid__WEBPACK_IMPORTED_MODULE_1__.uniqueId)(),
    layout: {
      h: 5,
      minH: 2,
      w: 2,
      x: 2,
      y: 10
    },
    queries: [{
      name: '',
      fields: ['count()', 'transaction'],
      aggregates: ['count()'],
      columns: ['transaction'],
      conditions: 'transaction.status:internal_error',
      orderby: '-count()'
    }]
  }, {
    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Issues Assigned to Me or My Teams'),
    displayType: _types__WEBPACK_IMPORTED_MODULE_2__.DisplayType.TABLE,
    interval: '5m',
    widgetType: _types__WEBPACK_IMPORTED_MODULE_2__.WidgetType.ISSUE,
    tempId: (0,sentry_utils_guid__WEBPACK_IMPORTED_MODULE_1__.uniqueId)(),
    layout: {
      h: 7,
      minH: 2,
      w: 6,
      x: 0,
      y: 15
    },
    queries: [{
      name: '',
      fields: ['assignee', 'issue', 'title'],
      aggregates: [],
      columns: ['assignee', 'issue', 'title'],
      conditions: 'assigned_or_suggested:me is:unresolved',
      orderby: 'priority'
    }]
  }, {
    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('p75 Over Time'),
    displayType: _types__WEBPACK_IMPORTED_MODULE_2__.DisplayType.LINE,
    interval: '5m',
    widgetType: _types__WEBPACK_IMPORTED_MODULE_2__.WidgetType.DISCOVER,
    tempId: (0,sentry_utils_guid__WEBPACK_IMPORTED_MODULE_1__.uniqueId)(),
    layout: {
      h: 2,
      minH: 2,
      w: 4,
      x: 2,
      y: 2
    },
    queries: [{
      name: '',
      fields: ['p75(transaction.duration)'],
      aggregates: ['p75(transaction.duration)'],
      columns: [],
      conditions: '',
      orderby: ''
    }]
  }, {
    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Throughput (Events Per Minute)'),
    displayType: _types__WEBPACK_IMPORTED_MODULE_2__.DisplayType.LINE,
    interval: '5m',
    widgetType: _types__WEBPACK_IMPORTED_MODULE_2__.WidgetType.DISCOVER,
    tempId: (0,sentry_utils_guid__WEBPACK_IMPORTED_MODULE_1__.uniqueId)(),
    layout: {
      h: 2,
      minH: 2,
      w: 4,
      x: 2,
      y: 0
    },
    queries: [{
      name: 'Transactions',
      fields: ['epm()'],
      aggregates: ['epm()'],
      columns: [],
      conditions: 'event.type:transaction',
      orderby: ''
    }, {
      name: 'Errors',
      fields: ['epm()'],
      aggregates: ['epm()'],
      columns: [],
      conditions: 'event.type:error',
      orderby: ''
    }]
  }, {
    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Tasks Transactions with Poor Apdex'),
    displayType: _types__WEBPACK_IMPORTED_MODULE_2__.DisplayType.TABLE,
    interval: '5m',
    widgetType: _types__WEBPACK_IMPORTED_MODULE_2__.WidgetType.DISCOVER,
    tempId: (0,sentry_utils_guid__WEBPACK_IMPORTED_MODULE_1__.uniqueId)(),
    layout: {
      h: 4,
      minH: 2,
      w: 2,
      x: 0,
      y: 2
    },
    queries: [{
      name: '',
      fields: ['count()', 'transaction'],
      aggregates: ['count()'],
      columns: ['transaction'],
      conditions: 'apdex():<0.5 transaction.op:*task*',
      orderby: '-count()'
    }]
  }, {
    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('HTTP Transactions with Poor Apdex'),
    displayType: _types__WEBPACK_IMPORTED_MODULE_2__.DisplayType.TABLE,
    interval: '5m',
    widgetType: _types__WEBPACK_IMPORTED_MODULE_2__.WidgetType.DISCOVER,
    tempId: (0,sentry_utils_guid__WEBPACK_IMPORTED_MODULE_1__.uniqueId)(),
    layout: {
      h: 4,
      minH: 2,
      w: 4,
      x: 2,
      y: 4
    },
    queries: [{
      name: '',
      fields: ['epm()', 'http.method', 'http.status_code', 'transaction'],
      aggregates: ['epm()'],
      columns: ['http.method', 'http.status_code', 'transaction'],
      conditions: 'apdex():<0.5 transaction.op:*http* has:http.method has:http.status_code',
      orderby: '-epm()'
    }]
  }, {
    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Overall Apdex'),
    displayType: _types__WEBPACK_IMPORTED_MODULE_2__.DisplayType.BIG_NUMBER,
    interval: '5m',
    widgetType: _types__WEBPACK_IMPORTED_MODULE_2__.WidgetType.DISCOVER,
    tempId: (0,sentry_utils_guid__WEBPACK_IMPORTED_MODULE_1__.uniqueId)(),
    layout: {
      h: 1,
      minH: 1,
      w: 1,
      x: 0,
      y: 0
    },
    queries: [{
      name: '',
      fields: ['apdex(300)'],
      aggregates: ['apdex(300)'],
      columns: [],
      conditions: '',
      orderby: ''
    }]
  }, {
    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Overall Duration'),
    displayType: _types__WEBPACK_IMPORTED_MODULE_2__.DisplayType.BIG_NUMBER,
    interval: '5m',
    widgetType: _types__WEBPACK_IMPORTED_MODULE_2__.WidgetType.DISCOVER,
    tempId: (0,sentry_utils_guid__WEBPACK_IMPORTED_MODULE_1__.uniqueId)(),
    layout: {
      h: 1,
      minH: 1,
      w: 1,
      x: 1,
      y: 0
    },
    queries: [{
      name: '',
      fields: ['p75(transaction.duration)'],
      aggregates: ['p75(transaction.duration)'],
      columns: [],
      conditions: '',
      orderby: ''
    }]
  }, {
    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Overall HTTP Spans'),
    displayType: _types__WEBPACK_IMPORTED_MODULE_2__.DisplayType.BIG_NUMBER,
    interval: '5m',
    widgetType: _types__WEBPACK_IMPORTED_MODULE_2__.WidgetType.DISCOVER,
    tempId: (0,sentry_utils_guid__WEBPACK_IMPORTED_MODULE_1__.uniqueId)(),
    layout: {
      h: 1,
      minH: 1,
      w: 1,
      x: 0,
      y: 1
    },
    queries: [{
      name: '',
      fields: ['p75(spans.http)'],
      aggregates: ['p75(spans.http)'],
      columns: [],
      conditions: '',
      orderby: ''
    }]
  }, {
    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Overall DB Spans'),
    displayType: _types__WEBPACK_IMPORTED_MODULE_2__.DisplayType.BIG_NUMBER,
    interval: '5m',
    widgetType: _types__WEBPACK_IMPORTED_MODULE_2__.WidgetType.DISCOVER,
    tempId: (0,sentry_utils_guid__WEBPACK_IMPORTED_MODULE_1__.uniqueId)(),
    layout: {
      h: 1,
      minH: 1,
      w: 1,
      x: 1,
      y: 1
    },
    queries: [{
      name: '',
      fields: ['p75(spans.db)'],
      aggregates: ['p75(spans.db)'],
      columns: [],
      conditions: '',
      orderby: ''
    }]
  }]
}, {
  id: 'mobile-template',
  title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Mobile Template'),
  dateCreated: '',
  createdBy: undefined,
  description: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Crash Details and Performance Vitals'),
  projects: [],
  filters: {},
  widgets: [{
    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Total Crashes'),
    displayType: _types__WEBPACK_IMPORTED_MODULE_2__.DisplayType.BIG_NUMBER,
    interval: '5m',
    widgetType: _types__WEBPACK_IMPORTED_MODULE_2__.WidgetType.DISCOVER,
    tempId: (0,sentry_utils_guid__WEBPACK_IMPORTED_MODULE_1__.uniqueId)(),
    layout: {
      h: 1,
      minH: 1,
      w: 1,
      x: 0,
      y: 0
    },
    queries: [{
      name: '',
      fields: ['count()'],
      aggregates: ['count()'],
      columns: [],
      conditions: 'error.handled:false event.type:error',
      orderby: ''
    }]
  }, {
    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Unique Users Who Crashed'),
    displayType: _types__WEBPACK_IMPORTED_MODULE_2__.DisplayType.BIG_NUMBER,
    interval: '5m',
    widgetType: _types__WEBPACK_IMPORTED_MODULE_2__.WidgetType.DISCOVER,
    tempId: (0,sentry_utils_guid__WEBPACK_IMPORTED_MODULE_1__.uniqueId)(),
    layout: {
      h: 1,
      minH: 1,
      w: 1,
      x: 1,
      y: 0
    },
    queries: [{
      name: '',
      fields: ['count_unique(user)'],
      aggregates: ['count_unique(user)'],
      columns: [],
      conditions: 'error.handled:false event.type:error',
      orderby: ''
    }]
  }, {
    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Unique Issues Causing Crashes'),
    displayType: _types__WEBPACK_IMPORTED_MODULE_2__.DisplayType.BIG_NUMBER,
    interval: '5m',
    widgetType: _types__WEBPACK_IMPORTED_MODULE_2__.WidgetType.DISCOVER,
    tempId: (0,sentry_utils_guid__WEBPACK_IMPORTED_MODULE_1__.uniqueId)(),
    layout: {
      h: 1,
      minH: 1,
      w: 1,
      x: 2,
      y: 0
    },
    queries: [{
      name: '',
      fields: ['count_unique(issue)'],
      aggregates: ['count_unique(issue)'],
      columns: [],
      conditions: 'error.handled:false event.type:error',
      orderby: ''
    }]
  }, {
    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Overall Number of Errors'),
    displayType: _types__WEBPACK_IMPORTED_MODULE_2__.DisplayType.BIG_NUMBER,
    interval: '5m',
    widgetType: _types__WEBPACK_IMPORTED_MODULE_2__.WidgetType.DISCOVER,
    tempId: (0,sentry_utils_guid__WEBPACK_IMPORTED_MODULE_1__.uniqueId)(),
    layout: {
      h: 1,
      minH: 1,
      w: 1,
      x: 3,
      y: 0
    },
    queries: [{
      name: '',
      fields: ['count()'],
      aggregates: ['count()'],
      columns: [],
      conditions: 'event.type:error',
      orderby: ''
    }]
  }, {
    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Issues Causing Crashes'),
    displayType: _types__WEBPACK_IMPORTED_MODULE_2__.DisplayType.TABLE,
    interval: '5m',
    widgetType: _types__WEBPACK_IMPORTED_MODULE_2__.WidgetType.DISCOVER,
    tempId: (0,sentry_utils_guid__WEBPACK_IMPORTED_MODULE_1__.uniqueId)(),
    layout: {
      h: 2,
      minH: 2,
      w: 3,
      x: 0,
      y: 1
    },
    queries: [{
      name: '',
      fields: ['issue', 'count()', 'count_unique(user)'],
      aggregates: ['count()', 'count_unique(user)'],
      columns: ['issue'],
      conditions: 'error.handled:false',
      orderby: '-count_unique(user)'
    }]
  }, {
    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Crashes Over Time'),
    displayType: _types__WEBPACK_IMPORTED_MODULE_2__.DisplayType.LINE,
    interval: '5m',
    widgetType: _types__WEBPACK_IMPORTED_MODULE_2__.WidgetType.DISCOVER,
    tempId: (0,sentry_utils_guid__WEBPACK_IMPORTED_MODULE_1__.uniqueId)(),
    layout: {
      h: 3,
      minH: 2,
      w: 2,
      x: 4,
      y: 0
    },
    queries: [{
      name: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Crashes'),
      fields: ['count()', 'count_unique(user)'],
      aggregates: ['count()', 'count_unique(user)'],
      columns: [],
      conditions: 'error.handled:false',
      orderby: ''
    }]
  }, {
    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Crashes by OS'),
    displayType: _types__WEBPACK_IMPORTED_MODULE_2__.DisplayType.TABLE,
    interval: '5m',
    widgetType: _types__WEBPACK_IMPORTED_MODULE_2__.WidgetType.DISCOVER,
    tempId: (0,sentry_utils_guid__WEBPACK_IMPORTED_MODULE_1__.uniqueId)(),
    layout: {
      h: 2,
      minH: 2,
      w: 1,
      x: 3,
      y: 1
    },
    queries: [{
      name: '',
      fields: ['os', 'count()'],
      aggregates: ['count()'],
      columns: ['os'],
      conditions: 'has:os error.handled:false',
      orderby: '-count()'
    }]
  }, {
    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Overall Warm Startup Time'),
    displayType: _types__WEBPACK_IMPORTED_MODULE_2__.DisplayType.BIG_NUMBER,
    interval: '5m',
    widgetType: _types__WEBPACK_IMPORTED_MODULE_2__.WidgetType.DISCOVER,
    tempId: (0,sentry_utils_guid__WEBPACK_IMPORTED_MODULE_1__.uniqueId)(),
    layout: {
      h: 1,
      minH: 1,
      w: 1,
      x: 0,
      y: 3
    },
    queries: [{
      name: '',
      fields: ['p75(measurements.app_start_warm)'],
      aggregates: ['p75(measurements.app_start_warm)'],
      columns: [],
      conditions: 'has:measurements.app_start_warm',
      orderby: ''
    }]
  }, {
    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Overall Cold Startup Time'),
    displayType: _types__WEBPACK_IMPORTED_MODULE_2__.DisplayType.BIG_NUMBER,
    interval: '5m',
    widgetType: _types__WEBPACK_IMPORTED_MODULE_2__.WidgetType.DISCOVER,
    tempId: (0,sentry_utils_guid__WEBPACK_IMPORTED_MODULE_1__.uniqueId)(),
    layout: {
      h: 1,
      minH: 1,
      w: 1,
      x: 2,
      y: 3
    },
    queries: [{
      name: '',
      fields: ['p75(measurements.app_start_cold)'],
      aggregates: ['p75(measurements.app_start_cold)'],
      columns: [],
      conditions: 'has:measurements.app_start_cold',
      orderby: ''
    }]
  }, {
    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Warm Startup Times'),
    displayType: _types__WEBPACK_IMPORTED_MODULE_2__.DisplayType.TABLE,
    interval: '5m',
    widgetType: _types__WEBPACK_IMPORTED_MODULE_2__.WidgetType.DISCOVER,
    tempId: (0,sentry_utils_guid__WEBPACK_IMPORTED_MODULE_1__.uniqueId)(),
    layout: {
      h: 4,
      minH: 2,
      w: 2,
      x: 0,
      y: 4
    },
    queries: [{
      name: '',
      fields: ['transaction', 'p75(measurements.app_start_warm)'],
      aggregates: ['p75(measurements.app_start_warm)'],
      columns: ['transaction'],
      conditions: 'has:measurements.app_start_warm',
      orderby: ''
    }]
  }, {
    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Cold Startup Times'),
    displayType: _types__WEBPACK_IMPORTED_MODULE_2__.DisplayType.TABLE,
    interval: '5m',
    widgetType: _types__WEBPACK_IMPORTED_MODULE_2__.WidgetType.DISCOVER,
    tempId: (0,sentry_utils_guid__WEBPACK_IMPORTED_MODULE_1__.uniqueId)(),
    layout: {
      h: 4,
      minH: 2,
      w: 2,
      x: 2,
      y: 4
    },
    queries: [{
      name: '',
      fields: ['transaction', 'p75(measurements.app_start_cold)'],
      aggregates: ['p75(measurements.app_start_cold)'],
      columns: ['transaction'],
      conditions: 'has:measurements.app_start_cold',
      orderby: ''
    }]
  }, {
    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Overall Frozen Frames'),
    displayType: _types__WEBPACK_IMPORTED_MODULE_2__.DisplayType.BIG_NUMBER,
    interval: '5m',
    widgetType: _types__WEBPACK_IMPORTED_MODULE_2__.WidgetType.DISCOVER,
    tempId: (0,sentry_utils_guid__WEBPACK_IMPORTED_MODULE_1__.uniqueId)(),
    layout: {
      h: 1,
      minH: 1,
      w: 1,
      x: 4,
      y: 3
    },
    queries: [{
      name: '',
      fields: ['p75(measurements.frames_frozen_rate)'],
      aggregates: ['p75(measurements.frames_frozen_rate)'],
      columns: [],
      conditions: '',
      orderby: ''
    }]
  }, {
    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Max Warm Startup Time'),
    displayType: _types__WEBPACK_IMPORTED_MODULE_2__.DisplayType.BIG_NUMBER,
    interval: '5m',
    widgetType: _types__WEBPACK_IMPORTED_MODULE_2__.WidgetType.DISCOVER,
    tempId: (0,sentry_utils_guid__WEBPACK_IMPORTED_MODULE_1__.uniqueId)(),
    layout: {
      h: 1,
      minH: 1,
      w: 1,
      x: 1,
      y: 3
    },
    queries: [{
      name: '',
      fields: ['max(measurements.app_start_warm)'],
      aggregates: ['max(measurements.app_start_warm)'],
      columns: [],
      conditions: '',
      orderby: ''
    }]
  }, {
    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Max Cold Startup Time'),
    displayType: _types__WEBPACK_IMPORTED_MODULE_2__.DisplayType.BIG_NUMBER,
    interval: '5m',
    widgetType: _types__WEBPACK_IMPORTED_MODULE_2__.WidgetType.DISCOVER,
    tempId: (0,sentry_utils_guid__WEBPACK_IMPORTED_MODULE_1__.uniqueId)(),
    layout: {
      h: 1,
      minH: 1,
      w: 1,
      x: 3,
      y: 3
    },
    queries: [{
      name: '',
      fields: ['max(measurements.app_start_cold)'],
      aggregates: ['max(measurements.app_start_cold)'],
      columns: [],
      conditions: '',
      orderby: ''
    }]
  }, {
    title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Frozen Frames Rate'),
    displayType: _types__WEBPACK_IMPORTED_MODULE_2__.DisplayType.TABLE,
    interval: '5m',
    widgetType: _types__WEBPACK_IMPORTED_MODULE_2__.WidgetType.DISCOVER,
    tempId: (0,sentry_utils_guid__WEBPACK_IMPORTED_MODULE_1__.uniqueId)(),
    layout: {
      h: 4,
      minH: 2,
      w: 2,
      x: 4,
      y: 4
    },
    queries: [{
      name: '',
      fields: ['transaction', 'p75(measurements.frames_frozen_rate)'],
      aggregates: ['p75(measurements.frames_frozen_rate)'],
      columns: ['transaction'],
      conditions: 'has:measurements.frames_frozen_rate',
      orderby: '-p75(measurements.frames_frozen_rate)'
    }]
  }]
}];
const DISPLAY_TYPE_CHOICES = [{
  label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Area Chart'),
  value: 'area'
}, {
  label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Bar Chart'),
  value: 'bar'
}, {
  label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Line Chart'),
  value: 'line'
}, {
  label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Table'),
  value: 'table'
}, {
  label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('World Map'),
  value: 'world_map'
}, {
  label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Big Number'),
  value: 'big_number'
}, {
  label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Top 5 Events'),
  value: 'top_n'
}];
const INTERVAL_CHOICES = [{
  label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('1 Minute'),
  value: '1m'
}, {
  label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('5 Minutes'),
  value: '5m'
}, {
  label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('15 Minutes'),
  value: '15m'
}, {
  label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('30 Minutes'),
  value: '30m'
}, {
  label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('1 Hour'),
  value: '1h'
}, {
  label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('1 Day'),
  value: '1d'
}];
const DEFAULT_STATS_PERIOD = '24h';

/***/ }),

/***/ "../node_modules/lodash/_baseExtremum.js":
/*!***********************************************!*\
  !*** ../node_modules/lodash/_baseExtremum.js ***!
  \***********************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

var isSymbol = __webpack_require__(/*! ./isSymbol */ "../node_modules/lodash/isSymbol.js");

/**
 * The base implementation of methods like `_.max` and `_.min` which accepts a
 * `comparator` to determine the extremum value.
 *
 * @private
 * @param {Array} array The array to iterate over.
 * @param {Function} iteratee The iteratee invoked per iteration.
 * @param {Function} comparator The comparator used to compare values.
 * @returns {*} Returns the extremum value.
 */
function baseExtremum(array, iteratee, comparator) {
  var index = -1,
      length = array.length;

  while (++index < length) {
    var value = array[index],
        current = iteratee(value);

    if (current != null && (computed === undefined
          ? (current === current && !isSymbol(current))
          : comparator(current, computed)
        )) {
      var computed = current,
          result = value;
    }
  }
  return result;
}

module.exports = baseExtremum;


/***/ }),

/***/ "../node_modules/lodash/_baseGt.js":
/*!*****************************************!*\
  !*** ../node_modules/lodash/_baseGt.js ***!
  \*****************************************/
/***/ ((module) => {

/**
 * The base implementation of `_.gt` which doesn't coerce arguments.
 *
 * @private
 * @param {*} value The value to compare.
 * @param {*} other The other value to compare.
 * @returns {boolean} Returns `true` if `value` is greater than `other`,
 *  else `false`.
 */
function baseGt(value, other) {
  return value > other;
}

module.exports = baseGt;


/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_components_modals_addDashboardWidgetModal_tsx-app_utils_discover_charts_tsx-app_utils_wit-3c3c39.8ac5413212c251f5bb27710b6b6f0aaf.js.map