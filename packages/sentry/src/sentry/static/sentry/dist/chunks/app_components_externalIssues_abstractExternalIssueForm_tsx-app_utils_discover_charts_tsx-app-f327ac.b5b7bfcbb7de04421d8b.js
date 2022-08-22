"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_components_externalIssues_abstractExternalIssueForm_tsx-app_utils_discover_charts_tsx-app-f327ac"],{

/***/ "./app/components/externalIssues/abstractExternalIssueForm.tsx":
/*!*********************************************************************!*\
  !*** ./app/components/externalIssues/abstractExternalIssueForm.tsx ***!
  \*********************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ AbstractExternalIssueForm)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/es.error.cause.js */ "../node_modules/core-js/modules/es.error.cause.js");
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var lodash_debounce__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! lodash/debounce */ "../node_modules/lodash/debounce.js");
/* harmony import */ var lodash_debounce__WEBPACK_IMPORTED_MODULE_5___default = /*#__PURE__*/__webpack_require__.n(lodash_debounce__WEBPACK_IMPORTED_MODULE_5__);
/* harmony import */ var query_string__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! query-string */ "../node_modules/query-string/index.js");
/* harmony import */ var sentry_components_asyncComponent__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/asyncComponent */ "./app/components/asyncComponent.tsx");
/* harmony import */ var sentry_components_forms_fieldFromConfig__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/forms/fieldFromConfig */ "./app/components/forms/fieldFromConfig.tsx");
/* harmony import */ var sentry_components_forms_form__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/forms/form */ "./app/components/forms/form.tsx");
/* harmony import */ var sentry_components_forms_model__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/forms/model */ "./app/components/forms/model.tsx");
/* harmony import */ var sentry_components_questionTooltip__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/components/questionTooltip */ "./app/components/questionTooltip.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");















const DEBOUNCE_MS = 200;
/**
 * @abstract
 */

class AbstractExternalIssueForm extends sentry_components_asyncComponent__WEBPACK_IMPORTED_MODULE_7__["default"] {
  constructor() {
    var _this;

    super(...arguments);
    _this = this;

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "shouldRenderBadRequests", true);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "model", new sentry_components_forms_model__WEBPACK_IMPORTED_MODULE_10__["default"]());

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "refetchConfig", () => {
      const {
        action,
        dynamicFieldValues
      } = this.state;
      const query = {
        action,
        ...dynamicFieldValues
      };
      const endpoint = this.getEndPointString();
      this.api.request(endpoint, {
        method: 'GET',
        query,
        success: (data, _, resp) => {
          this.handleRequestSuccess({
            stateKey: 'integrationDetails',
            data,
            resp
          }, true);
        },
        error: error => {
          this.handleError(error, ['integrationDetails', endpoint, null, null]);
        }
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "getConfigName", () => {
      // Explicitly returning a non-interpolated string for clarity.
      const {
        action
      } = this.state;

      switch (action) {
        case 'create':
          return 'createIssueConfig';

        case 'link':
          return 'linkIssueConfig';

        default:
          throw new Error('illegal action');
      }
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "getDynamicFields", integrationDetailsParam => {
      const {
        integrationDetails: integrationDetailsFromState
      } = this.state;
      const integrationDetails = integrationDetailsParam || integrationDetailsFromState;
      const config = (integrationDetails || {})[this.getConfigName()];
      return Object.fromEntries((config || []).filter(field => field.updatesForm).map(field => [field.name, field.default || null]));
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "onRequestSuccess", _ref => {
      let {
        stateKey,
        data
      } = _ref;

      if (stateKey === 'integrationDetails') {
        this.handleReceiveIntegrationDetails(data);
        this.setState({
          dynamicFieldValues: this.getDynamicFields(data)
        });
      }
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "onFieldChange", (fieldName, value) => {
      const {
        dynamicFieldValues
      } = this.state;
      const dynamicFields = this.getDynamicFields();

      if (dynamicFields.hasOwnProperty(fieldName) && dynamicFieldValues) {
        dynamicFieldValues[fieldName] = value;
        this.setState({
          dynamicFieldValues,
          reloading: true,
          error: false,
          remainingRequests: 1
        }, this.refetchConfig);
      }
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "updateFetchedFieldOptionsCache", (field, result) => {
      const {
        fetchedFieldOptionsCache
      } = this.state;
      this.setState({
        fetchedFieldOptionsCache: { ...fetchedFieldOptionsCache,
          [field.name]: result.map(obj => [obj.value, obj.label])
        }
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "ensureCurrentOption", (field, result) => {
      const currentOption = this.getDefaultOptions(field).find(option => option.value === this.model.getValue(field.name));

      if (!currentOption) {
        return result;
      }

      if (typeof currentOption.label === 'string') {
        currentOption.label = (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsxs)(react__WEBPACK_IMPORTED_MODULE_4__.Fragment, {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_components_questionTooltip__WEBPACK_IMPORTED_MODULE_11__["default"], {
            title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.tct)('This is your current [label].', {
              label: field.label
            }),
            size: "xs"
          }), ' ', currentOption.label]
        });
      }

      const currentOptionResultIndex = result.findIndex(obj => obj.value === (currentOption === null || currentOption === void 0 ? void 0 : currentOption.value)); // Has a selected option, and it is in API results

      if (currentOptionResultIndex >= 0) {
        const newResult = result;
        newResult[currentOptionResultIndex] = currentOption;
        return newResult;
      } // Has a selected option, and it is not in API results


      return [...result, currentOption];
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "getOptions", (field, input) => new Promise((resolve, reject) => {
      if (!input) {
        return resolve(this.getDefaultOptions(field));
      }

      return this.debouncedOptionLoad(field, input, (err, result) => {
        if (err) {
          reject(err);
        } else {
          result = this.ensureCurrentOption(field, result);
          this.updateFetchedFieldOptionsCache(field, result);
          resolve(result);
        }
      });
    }));

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "debouncedOptionLoad", lodash_debounce__WEBPACK_IMPORTED_MODULE_5___default()(async (field, input, cb) => {
      const {
        dynamicFieldValues
      } = this.state;
      const query = query_string__WEBPACK_IMPORTED_MODULE_6__.stringify({ ...dynamicFieldValues,
        field: field.name,
        query: input
      });
      const url = field.url || '';
      const separator = url.includes('?') ? '&' : '?'; // We can't use the API client here since the URL is not scoped under the
      // API endpoints (which the client prefixes)

      try {
        const response = await fetch(url + separator + query);
        cb(null, response.ok ? await response.json() : []);
      } catch (err) {
        cb(err);
      }
    }, DEBOUNCE_MS, {
      trailing: true
    }));

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "getDefaultOptions", field => {
      const choices = field.choices || [];
      return choices.map(_ref2 => {
        let [value, label] = _ref2;
        return {
          value,
          label
        };
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "getFieldProps", field => field.url ? {
      async: true,
      autoload: true,
      cache: false,
      loadOptions: input => this.getOptions(field, input),
      defaultOptions: this.getDefaultOptions(field),
      onBlurResetsInput: false,
      onCloseResetsInput: false,
      onSelectResetsInput: false
    } : {});

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleReceiveIntegrationDetails", _data => {// Do nothing.
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "renderNavTabs", () => null);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "renderBodyText", () => null);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "getTitle", () => (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.tct)('Issue Link Settings', {}));

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "getFormProps", () => {
      throw new Error("Method 'getFormProps()' must be implemented.");
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "getDefaultFormProps", () => {
      return {
        footerClass: 'modal-footer',
        onFieldChange: this.onFieldChange,
        submitDisabled: this.state.reloading,
        model: this.model // Other form props implemented by child classes.

      };
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "getCleanedFields", () => {
      const {
        fetchedFieldOptionsCache,
        integrationDetails
      } = this.state;
      const configsFromAPI = (integrationDetails || {})[this.getConfigName()];
      return (configsFromAPI || []).map(field => {
        const fieldCopy = { ...field
        }; // Overwrite choices from cache.

        if (fetchedFieldOptionsCache !== null && fetchedFieldOptionsCache !== void 0 && fetchedFieldOptionsCache.hasOwnProperty(field.name)) {
          fieldCopy.choices = fetchedFieldOptionsCache[field.name];
        }

        return fieldCopy;
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "renderForm", function (formFields) {
      let errors = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
      const initialData = (formFields || []).reduce((accumulator, field) => {
        accumulator[field.name] = // Passing an empty array breaks MultiSelect.
        field.multiple && field.default === [] ? '' : field.default;
        return accumulator;
      }, {});
      const {
        Header,
        Body
      } = _this.props;
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsxs)(react__WEBPACK_IMPORTED_MODULE_4__.Fragment, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(Header, {
          closeButton: true,
          children: _this.getTitle()
        }), _this.renderNavTabs(), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(Body, {
          children: _this.shouldRenderLoading ? _this.renderLoading() : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsxs)(react__WEBPACK_IMPORTED_MODULE_4__.Fragment, {
            children: [_this.renderBodyText(), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_components_forms_form__WEBPACK_IMPORTED_MODULE_9__["default"], {
              initialData: initialData,
              ..._this.getFormProps(),
              children: (formFields || []).filter(field => field.hasOwnProperty('name')).map(fields => ({ ...fields,
                noOptionsMessage: () => 'No options. Type to search.'
              })).map((field, i) => {
                return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsxs)(react__WEBPACK_IMPORTED_MODULE_4__.Fragment, {
                  children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_components_forms_fieldFromConfig__WEBPACK_IMPORTED_MODULE_8__["default"], {
                    disabled: _this.state.reloading,
                    field: field,
                    flexibleControlStateSize: true,
                    inline: false,
                    stacked: true,
                    ..._this.getFieldProps(field)
                  }), errors[field.name] && errors[field.name]]
                }, `${field.name}-${i}`);
              })
            })]
          })
        })]
      });
    });
  }

  getDefaultState() {
    return { ...super.getDefaultState(),
      action: 'create',
      dynamicFieldValues: null,
      fetchedFieldOptionsCache: {},
      integrationDetails: null
    };
  }

  getEndPointString() {
    throw new Error("Method 'getEndPointString()' must be implemented.");
  }

  renderComponent() {
    return this.state.error ? this.renderError(new Error('Unable to load all required endpoints')) : this.renderBody();
  }

}

/***/ }),

/***/ "./app/utils/discover/charts.tsx":
/*!***************************************!*\
  !*** ./app/utils/discover/charts.tsx ***!
  \***************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

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

/***/ "./app/utils/environment.tsx":
/*!***********************************!*\
  !*** ./app/utils/environment.tsx ***!
  \***********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "getDisplayName": () => (/* binding */ getDisplayName),
/* harmony export */   "getUrlRoutingName": () => (/* binding */ getUrlRoutingName)
/* harmony export */ });
const DEFAULT_EMPTY_ROUTING_NAME = 'none';
const DEFAULT_EMPTY_ENV_NAME = '(No Environment)';
function getUrlRoutingName(env) {
  if (env.name) {
    return encodeURIComponent(env.name);
  }

  if (env.displayName) {
    return encodeURIComponent(env.displayName);
  }

  return DEFAULT_EMPTY_ROUTING_NAME;
}
function getDisplayName(env) {
  return env.name || env.displayName || DEFAULT_EMPTY_ENV_NAME;
}

/***/ }),

/***/ "./app/utils/replaceAtArrayIndex.tsx":
/*!*******************************************!*\
  !*** ./app/utils/replaceAtArrayIndex.tsx ***!
  \*******************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "replaceAtArrayIndex": () => (/* binding */ replaceAtArrayIndex)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);


/**
 * Replace item at `index` in `array` with `obj`
 */
function replaceAtArrayIndex(array, index, obj) {
  const newArray = [...array];
  newArray.splice(index, 1, obj);
  return newArray;
}

/***/ }),

/***/ "./app/views/organizationIntegrations/sentryAppExternalForm.tsx":
/*!**********************************************************************!*\
  !*** ./app/views/organizationIntegrations/sentryAppExternalForm.tsx ***!
  \**********************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "SentryAppExternalForm": () => (/* binding */ SentryAppExternalForm),
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var react_select__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! react-select */ "../node_modules/react-select/dist/Select-9fdb8cd0.browser.esm.js");
/* harmony import */ var lodash_debounce__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! lodash/debounce */ "../node_modules/lodash/debounce.js");
/* harmony import */ var lodash_debounce__WEBPACK_IMPORTED_MODULE_4___default = /*#__PURE__*/__webpack_require__.n(lodash_debounce__WEBPACK_IMPORTED_MODULE_4__);
/* harmony import */ var sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/actionCreators/indicator */ "./app/actionCreators/indicator.tsx");
/* harmony import */ var sentry_components_forms_fieldFromConfig__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/forms/fieldFromConfig */ "./app/components/forms/fieldFromConfig.tsx");
/* harmony import */ var sentry_components_forms_form__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/forms/form */ "./app/components/forms/form.tsx");
/* harmony import */ var sentry_components_forms_model__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/forms/model */ "./app/components/forms/model.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_replaceAtArrayIndex__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/utils/replaceAtArrayIndex */ "./app/utils/replaceAtArrayIndex.tsx");
/* harmony import */ var sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/utils/withApi */ "./app/utils/withApi.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");












 // 0 is a valid choice but empty string, undefined, and null are not




const hasValue = value => !!value || value === 0; // See docs: https://docs.sentry.io/product/integrations/integration-platform/ui-components/formfield/


/**
 *  This component is the result of a refactor of sentryAppExternalIssueForm.tsx.
 *  Most of it contains a direct copy of the code from that original file (comments included)
 *  to allow for an abstract way of turning Sentry App Schema -> Form UI, rather than being
 *  specific to Issue Linking.
 *
 *  See (#28465) for more details.
 */
class SentryAppExternalForm extends react__WEBPACK_IMPORTED_MODULE_3__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", {
      optionsByField: new Map(),
      selectedOptions: {}
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "model", new sentry_components_forms_model__WEBPACK_IMPORTED_MODULE_8__["default"]());

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "onSubmitError", () => {
      const {
        action,
        appName
      } = this.props;
      (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_5__.addErrorMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Unable to %s %s %s.', action, appName, this.getElementText()));
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "getOptions", (field, input) => new Promise(resolve => {
      this.debouncedOptionLoad(field, input, resolve);
    }));

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "getElementText", () => {
      const {
        element
      } = this.props;

      switch (element) {
        case 'issue-link':
          return 'issue';

        case 'alert-rule-action':
          return 'alert';

        default:
          return 'connection';
      }
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "getDefaultOptions", field => {
      const savedOption = ((this.props.resetValues || {}).settings || []).find(value => value.name === field.name);
      const currentOptions = (field.choices || []).map(_ref => {
        let [value, label] = _ref;
        return {
          value,
          label
        };
      });
      const shouldAddSavedOption = // We only render saved options if they have preserved the label, otherwise it appears unselcted.
      // The next time the user saves, the label should be preserved.
      (savedOption === null || savedOption === void 0 ? void 0 : savedOption.value) && (savedOption === null || savedOption === void 0 ? void 0 : savedOption.label) && // The option isn't in the current options already
      !currentOptions.some(option => option.value === (savedOption === null || savedOption === void 0 ? void 0 : savedOption.value));
      return shouldAddSavedOption ? [{
        value: savedOption.value,
        label: savedOption.label
      }, ...currentOptions] : currentOptions;
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "getDefaultFieldValue", field => {
      // Interpret the default if a getFieldDefault function is provided.
      const {
        resetValues,
        getFieldDefault
      } = this.props;
      let defaultValue = field === null || field === void 0 ? void 0 : field.defaultValue; // Override this default if a reset value is provided

      if (field.default && getFieldDefault) {
        defaultValue = getFieldDefault(field);
      }

      const reset = ((resetValues || {}).settings || []).find(value => value.name === field.name);

      if (reset) {
        defaultValue = reset.value;
      }

      return defaultValue;
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "debouncedOptionLoad", lodash_debounce__WEBPACK_IMPORTED_MODULE_4___default()( // debounce is used to prevent making a request for every input change and
    // instead makes the requests every 200ms
    async (field, input, resolve) => {
      const choices = await this.makeExternalRequest(field, input);
      const options = choices.map(_ref2 => {
        let [value, label] = _ref2;
        return {
          value,
          label
        };
      });
      const optionsByField = new Map(this.state.optionsByField);
      optionsByField.set(field.name, options);
      this.setState({
        optionsByField
      });
      return resolve(options);
    }, 200, {
      trailing: true
    }));

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "makeExternalRequest", async (field, input) => {
      const {
        extraRequestBody = {},
        sentryAppInstallationUuid
      } = this.props;
      const query = { ...extraRequestBody,
        uri: field.uri,
        query: input
      };

      if (field.depends_on) {
        const dependentData = field.depends_on.reduce((accum, dependentField) => {
          accum[dependentField] = this.model.getValue(dependentField);
          return accum;
        }, {}); // stringify the data

        query.dependentData = JSON.stringify(dependentData);
      }

      const {
        choices
      } = await this.props.api.requestPromise(`/sentry-app-installations/${sentryAppInstallationUuid}/external-requests/`, {
        query
      });
      return choices || [];
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleFieldChange", async id => {
      const config = this.state;
      let requiredFields = config.required_fields || [];
      let optionalFields = config.optional_fields || [];
      const fieldList = requiredFields.concat(optionalFields); // could have multiple impacted fields

      const impactedFields = fieldList.filter(_ref3 => {
        let {
          depends_on
        } = _ref3;

        if (!depends_on) {
          return false;
        } // must be dependent on the field we just set


        return depends_on.includes(id);
      }); // load all options in parallel

      const choiceArray = await Promise.all(impactedFields.map(field => {
        // reset all impacted fields first
        this.model.setValue(field.name || '', '', {
          quiet: true
        });
        return this.makeExternalRequest(field, '');
      }));
      this.setState(state => {
        // pull the field lists from latest state
        requiredFields = state.required_fields || [];
        optionalFields = state.optional_fields || []; // iterate through all the impacted fields and get new values

        impactedFields.forEach((impactedField, i) => {
          const choices = choiceArray[i];
          const requiredIndex = requiredFields.indexOf(impactedField);
          const optionalIndex = optionalFields.indexOf(impactedField);
          const updatedField = { ...impactedField,
            choices
          }; // immutably update the lists with the updated field depending where we got it from

          if (requiredIndex > -1) {
            requiredFields = (0,sentry_utils_replaceAtArrayIndex__WEBPACK_IMPORTED_MODULE_10__.replaceAtArrayIndex)(requiredFields, requiredIndex, updatedField);
          } else if (optionalIndex > -1) {
            optionalFields = (0,sentry_utils_replaceAtArrayIndex__WEBPACK_IMPORTED_MODULE_10__.replaceAtArrayIndex)(optionalFields, optionalIndex, updatedField);
          }
        });
        return {
          required_fields: requiredFields,
          optional_fields: optionalFields
        };
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "createPreserveOptionFunction", name => (option, _event) => {
      this.setState({
        selectedOptions: { ...this.state.selectedOptions,
          [name]: option
        }
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "renderField", (field, required) => {
      var _field$async;

      // This function converts the field we get from the backend into
      // the field we need to pass down
      let fieldToPass = { ...field,
        inline: false,
        stacked: true,
        flexibleControlStateSize: true,
        required
      };

      if (field !== null && field !== void 0 && field.uri && field !== null && field !== void 0 && field.async) {
        fieldToPass.type = 'select_async';
      }

      if (['select', 'select_async'].includes(fieldToPass.type || '')) {
        // find the options from state to pass down
        const defaultOptions = this.getDefaultOptions(field);
        const options = this.state.optionsByField.get(field.name) || defaultOptions;
        fieldToPass = { ...fieldToPass,
          options,
          defaultOptions,
          defaultValue: this.getDefaultFieldValue(field),
          // filter by what the user is typing
          filterOption: (0,react_select__WEBPACK_IMPORTED_MODULE_12__.c)({}),
          allowClear: !required,
          placeholder: 'Type to search'
        };

        if (field.depends_on) {
          // check if this is dependent on other fields which haven't been set yet
          const shouldDisable = field.depends_on.some(dependentField => !hasValue(this.model.getValue(dependentField)));

          if (shouldDisable) {
            fieldToPass = { ...fieldToPass,
              disabled: true
            };
          }
        }
      }

      if (['text', 'textarea'].includes(fieldToPass.type || '')) {
        fieldToPass = { ...fieldToPass,
          defaultValue: this.getDefaultFieldValue(field)
        };
      } // if we have a uri, we need to set extra parameters


      const extraProps = field.uri ? {
        loadOptions: input => this.getOptions(field, input),
        async: (_field$async = field === null || field === void 0 ? void 0 : field.async) !== null && _field$async !== void 0 ? _field$async : true,
        cache: false,
        onSelectResetsInput: false,
        onCloseResetsInput: false,
        onBlurResetsInput: false,
        autoload: false,
        onChangeOption: this.createPreserveOptionFunction(field.name)
      } : {};
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsx)(sentry_components_forms_fieldFromConfig__WEBPACK_IMPORTED_MODULE_6__["default"], {
        field: fieldToPass,
        "data-test-id": field.name,
        ...extraProps
      }, field.name);
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleAlertRuleSubmit", (formData, onSubmitSuccess) => {
      const {
        sentryAppInstallationUuid
      } = this.props;

      if (this.model.validateForm()) {
        onSubmitSuccess({
          // The form data must be nested in 'settings' to ensure they don't overlap with any other field names.
          settings: Object.entries(formData).map(_ref4 => {
            let [name, value] = _ref4;
            const savedSetting = {
              name,
              value
            };
            const stateOption = this.state.selectedOptions[name]; // If the field is a SelectAsync, we need to preserve the label since the next time it's rendered,
            // we can't be sure the options will contain this selection

            if ((stateOption === null || stateOption === void 0 ? void 0 : stateOption.value) === value) {
              savedSetting.label = `${stateOption === null || stateOption === void 0 ? void 0 : stateOption.label}`;
            }

            return savedSetting;
          }),
          sentryAppInstallationUuid,
          // Used on the backend to explicitly associate with a different rule than those without a custom form.
          hasSchemaFormConfig: true
        });
      }
    });
  }

  componentDidMount() {
    this.resetStateFromProps();
  }

  componentDidUpdate(prevProps) {
    if (prevProps.action !== this.props.action) {
      this.model.reset();
      this.resetStateFromProps();
    }
  }

  // reset the state when we mount or the action changes
  resetStateFromProps() {
    const {
      config,
      action,
      extraFields,
      element
    } = this.props;
    this.setState({
      required_fields: config.required_fields,
      optional_fields: config.optional_fields
    }); // For alert-rule-actions, the forms are entirely custom, extra fields are
    // passed in on submission, not as part of the form. See handleAlertRuleSubmit().

    if (element === 'alert-rule-action') {
      const defaultResetValues = (this.props.resetValues || {}).settings || [];
      const initialData = defaultResetValues.reduce((acc, curr) => {
        acc[curr.name] = curr.value;
        return acc;
      }, {});
      this.model.setInitialData({ ...initialData
      });
    } else {
      this.model.setInitialData({ ...extraFields,
        // we need to pass these fields in the API so just set them as values so we don't need hidden form fields
        action,
        uri: config.uri
      });
    }
  }

  render() {
    const {
      sentryAppInstallationUuid,
      action,
      element,
      onSubmitSuccess
    } = this.props;
    const requiredFields = this.state.required_fields || [];
    const optionalFields = this.state.optional_fields || [];

    if (!sentryAppInstallationUuid) {
      return '';
    }

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_13__.jsxs)(sentry_components_forms_form__WEBPACK_IMPORTED_MODULE_7__["default"], {
      apiEndpoint: `/sentry-app-installations/${sentryAppInstallationUuid}/external-issue-actions/`,
      apiMethod: "POST" // Without defining onSubmit, the Form will send an `apiMethod` request to the above `apiEndpoint`
      ,
      onSubmit: element === 'alert-rule-action' ? this.handleAlertRuleSubmit : undefined,
      onSubmitSuccess: function () {
        onSubmitSuccess(...arguments);
      },
      onSubmitError: this.onSubmitError,
      onFieldChange: this.handleFieldChange,
      model: this.model,
      children: [requiredFields.map(field => {
        return this.renderField(field, true);
      }), optionalFields.map(field => {
        return this.renderField(field, false);
      })]
    }, action);
  }

}
SentryAppExternalForm.displayName = "SentryAppExternalForm";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_11__["default"])(SentryAppExternalForm));

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_components_externalIssues_abstractExternalIssueForm_tsx-app_utils_discover_charts_tsx-app-f327ac.fabc971b6fd3c7802b682d347a3c483b.js.map