"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_views_monitors_create_tsx"],{

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

/***/ "./app/views/monitors/create.tsx":
/*!***************************************!*\
  !*** ./app/views/monitors/create.tsx ***!
  \***************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ CreateMonitor)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var react_router__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react-router */ "../node_modules/react-router/es/index.js");
/* harmony import */ var sentry_views_asyncView__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/views/asyncView */ "./app/views/asyncView.tsx");
/* harmony import */ var _monitorForm__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ./monitorForm */ "./app/views/monitors/monitorForm.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");








class CreateMonitor extends sentry_views_asyncView__WEBPACK_IMPORTED_MODULE_4__["default"] {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "onSubmitSuccess", data => {
      react_router__WEBPACK_IMPORTED_MODULE_3__.browserHistory.push(`/organizations/${this.props.params.orgId}/monitors/${data.id}/`);
    });
  }

  getTitle() {
    return `Monitors - ${this.props.params.orgId}`;
  }

  renderBody() {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsxs)(react__WEBPACK_IMPORTED_MODULE_2__.Fragment, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)("h1", {
        children: "New Monitor"
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(_monitorForm__WEBPACK_IMPORTED_MODULE_5__["default"], {
        apiMethod: "POST",
        apiEndpoint: `/organizations/${this.props.params.orgId}/monitors/`,
        onSubmitSuccess: this.onSubmitSuccess
      })]
    });
  }

}

/***/ }),

/***/ "./app/views/monitors/monitorForm.tsx":
/*!********************************************!*\
  !*** ./app/views/monitors/monitorForm.tsx ***!
  \********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var mobx_react__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! mobx-react */ "../node_modules/mobx-react-lite/es/index.js");
/* harmony import */ var sentry_components_acl_access__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/acl/access */ "./app/components/acl/access.tsx");
/* harmony import */ var sentry_components_forms_field__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/forms/field */ "./app/components/forms/field/index.tsx");
/* harmony import */ var sentry_components_forms_form__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/forms/form */ "./app/components/forms/form.tsx");
/* harmony import */ var sentry_components_forms_numberField__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/forms/numberField */ "./app/components/forms/numberField.tsx");
/* harmony import */ var sentry_components_forms_selectField__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/forms/selectField */ "./app/components/forms/selectField.tsx");
/* harmony import */ var sentry_components_forms_textCopyInput__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/forms/textCopyInput */ "./app/components/forms/textCopyInput.tsx");
/* harmony import */ var sentry_components_forms_textField__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/forms/textField */ "./app/components/forms/textField.tsx");
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils_withPageFilters__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/utils/withPageFilters */ "./app/utils/withPageFilters.tsx");
/* harmony import */ var sentry_utils_withProjects__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/utils/withProjects */ "./app/utils/withProjects.tsx");
/* harmony import */ var _monitorModel__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! ./monitorModel */ "./app/views/monitors/monitorModel.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


















const SCHEDULE_TYPES = [{
  value: 'crontab',
  label: 'Crontab'
}, {
  value: 'interval',
  label: 'Interval'
}];
const MONITOR_TYPES = [{
  value: 'cron_job',
  label: 'Cron Job'
}];
const INTERVALS = [{
  value: 'minute',
  label: 'minute(s)'
}, {
  value: 'hour',
  label: 'hour(s)'
}, {
  value: 'day',
  label: 'day(s)'
}, {
  value: 'week',
  label: 'week(s)'
}, {
  value: 'month',
  label: 'month(s)'
}, {
  value: 'year',
  label: 'year(s)'
}];

class MonitorForm extends react__WEBPACK_IMPORTED_MODULE_2__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "form", new _monitorModel__WEBPACK_IMPORTED_MODULE_14__["default"]());
  }

  formDataFromConfig(type, config) {
    const rv = {};

    switch (type) {
      case 'cron_job':
        rv['config.schedule_type'] = config.schedule_type;
        rv['config.checkin_margin'] = config.checkin_margin;
        rv['config.max_runtime'] = config.max_runtime;

        switch (config.schedule_type) {
          case 'interval':
            rv['config.schedule.frequency'] = config.schedule[0];
            rv['config.schedule.interval'] = config.schedule[1];
            break;

          case 'crontab':
          default:
            rv['config.schedule'] = config.schedule;
        }

        break;

      default:
    }

    return rv;
  }

  render() {
    const {
      monitor
    } = this.props;
    const selectedProjectId = this.props.selection.projects[0];
    const selectedProject = selectedProjectId ? this.props.projects.find(p => p.id === selectedProjectId + '') : null;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_components_acl_access__WEBPACK_IMPORTED_MODULE_3__["default"], {
      access: ['project:write'],
      children: _ref => {
        let {
          hasAccess
        } = _ref;
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsxs)(sentry_components_forms_form__WEBPACK_IMPORTED_MODULE_5__["default"], {
          allowUndo: true,
          requireChanges: true,
          apiEndpoint: this.props.apiEndpoint,
          apiMethod: this.props.apiMethod,
          model: this.form,
          initialData: monitor ? {
            name: monitor.name,
            type: monitor.type,
            project: monitor.project.slug,
            ...this.formDataFromConfig(monitor.type, monitor.config)
          } : {
            project: selectedProject ? selectedProject.slug : null
          },
          onSubmitSuccess: this.props.onSubmitSuccess,
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsxs)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_10__.Panel, {
            children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_10__.PanelHeader, {
              children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Details')
            }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsxs)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_10__.PanelBody, {
              children: [monitor && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_components_forms_field__WEBPACK_IMPORTED_MODULE_4__["default"], {
                label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('ID'),
                children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)("div", {
                  className: "controls",
                  children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_components_forms_textCopyInput__WEBPACK_IMPORTED_MODULE_8__["default"], {
                    children: monitor.id
                  })
                })
              }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_components_forms_selectField__WEBPACK_IMPORTED_MODULE_7__["default"], {
                name: "project",
                label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Project'),
                disabled: !hasAccess,
                options: this.props.projects.filter(p => p.isMember).map(p => ({
                  value: p.slug,
                  label: p.slug
                })),
                required: true
              }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_components_forms_textField__WEBPACK_IMPORTED_MODULE_9__["default"], {
                name: "name",
                placeholder: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('My Cron Job'),
                label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Name'),
                disabled: !hasAccess,
                required: true
              })]
            })]
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsxs)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_10__.Panel, {
            children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_10__.PanelHeader, {
              children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Config')
            }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsxs)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_10__.PanelBody, {
              children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_components_forms_selectField__WEBPACK_IMPORTED_MODULE_7__["default"], {
                name: "type",
                label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Type'),
                disabled: !hasAccess,
                options: MONITOR_TYPES,
                required: true
              }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(mobx_react__WEBPACK_IMPORTED_MODULE_16__.Observer, {
                children: () => {
                  switch (this.form.getValue('type')) {
                    case 'cron_job':
                      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsxs)(react__WEBPACK_IMPORTED_MODULE_2__.Fragment, {
                        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_components_forms_numberField__WEBPACK_IMPORTED_MODULE_6__["default"], {
                          name: "config.max_runtime",
                          label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Max Runtime'),
                          disabled: !hasAccess,
                          help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)("The maximum runtime (in minutes) a check-in is allowed before it's marked as a failure."),
                          placeholder: "e.g. 30"
                        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_components_forms_selectField__WEBPACK_IMPORTED_MODULE_7__["default"], {
                          name: "config.schedule_type",
                          label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Schedule Type'),
                          disabled: !hasAccess,
                          options: SCHEDULE_TYPES,
                          required: true
                        })]
                      });

                    default:
                      return null;
                  }
                }
              }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(mobx_react__WEBPACK_IMPORTED_MODULE_16__.Observer, {
                children: () => {
                  switch (this.form.getValue('config.schedule_type')) {
                    case 'crontab':
                      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsxs)(react__WEBPACK_IMPORTED_MODULE_2__.Fragment, {
                        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_components_forms_textField__WEBPACK_IMPORTED_MODULE_9__["default"], {
                          name: "config.schedule",
                          label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Schedule'),
                          disabled: !hasAccess,
                          placeholder: "*/5 * * * *",
                          required: true,
                          help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.tct)('Changes to the schedule will apply on the next check-in. See [link:Wikipedia] for crontab syntax.', {
                            link: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)("a", {
                              href: "https://en.wikipedia.org/wiki/Cron"
                            })
                          })
                        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_components_forms_numberField__WEBPACK_IMPORTED_MODULE_6__["default"], {
                          name: "config.checkin_margin",
                          label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Check-in Margin'),
                          disabled: !hasAccess,
                          help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)("The margin (in minutes) a check-in is allowed to exceed it's scheduled window before being treated as missed."),
                          placeholder: "e.g. 30"
                        })]
                      });

                    case 'interval':
                      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsxs)(react__WEBPACK_IMPORTED_MODULE_2__.Fragment, {
                        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_components_forms_numberField__WEBPACK_IMPORTED_MODULE_6__["default"], {
                          name: "config.schedule.frequency",
                          label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Frequency'),
                          disabled: !hasAccess,
                          placeholder: "e.g. 1",
                          required: true
                        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_components_forms_selectField__WEBPACK_IMPORTED_MODULE_7__["default"], {
                          name: "config.schedule.interval",
                          label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Interval'),
                          disabled: !hasAccess,
                          options: INTERVALS,
                          required: true
                        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_15__.jsx)(sentry_components_forms_numberField__WEBPACK_IMPORTED_MODULE_6__["default"], {
                          name: "config.checkin_margin",
                          label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)('Check-in Margin'),
                          disabled: !hasAccess,
                          help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_11__.t)("The margin (in minutes) a check-in is allowed to exceed it's scheduled window before being treated as missed."),
                          placeholder: "e.g. 30"
                        })]
                      });

                    default:
                      return null;
                  }
                }
              })]
            })]
          })]
        });
      }
    });
  }

}

MonitorForm.displayName = "MonitorForm";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withPageFilters__WEBPACK_IMPORTED_MODULE_12__["default"])((0,sentry_utils_withProjects__WEBPACK_IMPORTED_MODULE_13__["default"])(MonitorForm)));

/***/ }),

/***/ "./app/views/monitors/monitorModel.tsx":
/*!*********************************************!*\
  !*** ./app/views/monitors/monitorModel.tsx ***!
  \*********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ MonitorModel)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_url_to_json_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.url.to-json.js */ "../node_modules/core-js/modules/web.url.to-json.js");
/* harmony import */ var core_js_modules_web_url_to_json_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_url_to_json_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var sentry_components_forms_model__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/forms/model */ "./app/components/forms/model.tsx");



class MonitorModel extends sentry_components_forms_model__WEBPACK_IMPORTED_MODULE_2__["default"] {
  getTransformedData() {
    return this.fields.toJSON().reduce((data, _ref) => {
      let [k, v] = _ref;

      if (k.indexOf('config.') !== 0) {
        data[k] = v;
        return data;
      }

      if (!data.config) {
        data.config = {};
      }

      if (k === 'config.schedule.frequency' || k === 'config.schedule.interval') {
        if (!Array.isArray(data.config.schedule)) {
          data.config.schedule = [null, null];
        }
      }

      if (k === 'config.schedule.frequency') {
        data.config.schedule[0] = parseInt(v, 10);
      } else if (k === 'config.schedule.interval') {
        data.config.schedule[1] = v;
      } else {
        data.config[k.substr(7)] = v;
      }

      return data;
    }, {});
  }

  getTransformedValue(id) {
    return id.indexOf('config') === 0 ? this.getValue(id) : super.getTransformedValue(id);
  }

}

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_views_monitors_create_tsx.2d080d0e2f3ff0cea45da2522918cbcd.js.map