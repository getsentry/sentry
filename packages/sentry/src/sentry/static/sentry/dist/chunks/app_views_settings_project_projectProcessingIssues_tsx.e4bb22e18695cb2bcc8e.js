"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_views_settings_project_projectProcessingIssues_tsx"],{

/***/ "./app/data/forms/processingIssues.tsx":
/*!*********************************************!*\
  !*** ./app/data/forms/processingIssues.tsx ***!
  \*********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__),
/* harmony export */   "route": () => (/* binding */ route)
/* harmony export */ });
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
// Export route to make these forms searchable by label/help

const route = '/settings/:orgId/projects/:projectId/processing-issues/';
const formGroups = [{
  // Form "section"/"panel"
  title: 'Settings',
  fields: [{
    name: 'sentry:reprocessing_active',
    type: 'boolean',
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Reprocessing active'),
    disabled: _ref => {
      let {
        access
      } = _ref;
      return !access.has('project:write');
    },
    disabledReason: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Only admins may change reprocessing settings'),
    help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)(`If reprocessing is enabled, Events with fixable issues will be
                held back until you resolve them. Processing issues will then
                show up in the list above with hints how to fix them.
                If reprocessing is disabled, Events with unresolved issues will
                also show up in the stream.
                `),
    saveOnBlur: false,
    saveMessage: _ref2 => {
      let {
        value
      } = _ref2;
      return value ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)('Reprocessing applies to future events only.') : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_0__.t)(`All events with errors will be flushed into your issues stream.
                Beware that this process may take some time and cannot be undone.`);
    },
    getData: form => ({
      options: form
    })
  }]
}];
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (formGroups);

/***/ }),

/***/ "./app/views/settings/project/projectProcessingIssues.tsx":
/*!****************************************************************!*\
  !*** ./app/views/settings/project/projectProcessingIssues.tsx ***!
  \****************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "ProjectProcessingIssues": () => (/* binding */ ProjectProcessingIssues),
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__),
/* harmony export */   "projectProcessingIssuesMessages": () => (/* binding */ projectProcessingIssuesMessages)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/actionCreators/indicator */ "./app/actionCreators/indicator.tsx");
/* harmony import */ var sentry_components_acl_access__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/acl/access */ "./app/components/acl/access.tsx");
/* harmony import */ var sentry_components_alertLink__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/alertLink */ "./app/components/alertLink.tsx");
/* harmony import */ var sentry_components_autoSelectText__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/autoSelectText */ "./app/components/autoSelectText.tsx");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_emptyStateWarning__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/emptyStateWarning */ "./app/components/emptyStateWarning.tsx");
/* harmony import */ var sentry_components_forms_form__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/forms/form */ "./app/components/forms/form.tsx");
/* harmony import */ var sentry_components_forms_jsonForm__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/components/forms/jsonForm */ "./app/components/forms/jsonForm.tsx");
/* harmony import */ var sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/components/links/externalLink */ "./app/components/links/externalLink.tsx");
/* harmony import */ var sentry_components_loadingError__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/components/loadingError */ "./app/components/loadingError.tsx");
/* harmony import */ var sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/components/loadingIndicator */ "./app/components/loadingIndicator.tsx");
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var sentry_components_sentryDocumentTitle__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/components/sentryDocumentTitle */ "./app/components/sentryDocumentTitle.tsx");
/* harmony import */ var sentry_components_timeSince__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! sentry/components/timeSince */ "./app/components/timeSince.tsx");
/* harmony import */ var sentry_data_forms_processingIssues__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! sentry/data/forms/processingIssues */ "./app/data/forms/processingIssues.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_20__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_input__WEBPACK_IMPORTED_MODULE_21__ = __webpack_require__(/*! sentry/styles/input */ "./app/styles/input.tsx");
/* harmony import */ var sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_22__ = __webpack_require__(/*! sentry/utils/withApi */ "./app/utils/withApi.tsx");
/* harmony import */ var sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_23__ = __webpack_require__(/*! sentry/utils/withOrganization */ "./app/utils/withOrganization.tsx");
/* harmony import */ var sentry_views_settings_components_settingsPageHeader__WEBPACK_IMPORTED_MODULE_24__ = __webpack_require__(/*! sentry/views/settings/components/settingsPageHeader */ "./app/views/settings/components/settingsPageHeader.tsx");
/* harmony import */ var sentry_views_settings_components_text_textBlock__WEBPACK_IMPORTED_MODULE_25__ = __webpack_require__(/*! sentry/views/settings/components/text/textBlock */ "./app/views/settings/components/text/textBlock.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }


























const projectProcessingIssuesMessages = {
  native_no_crashed_thread: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_20__.t)('No crashed thread found in crash report'),
  native_internal_failure: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_20__.t)('Internal failure when attempting to symbolicate: {error}'),
  native_bad_dsym: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_20__.t)('The debug information file used was broken.'),
  native_missing_optionally_bundled_dsym: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_20__.t)('An optional debug information file was missing.'),
  native_missing_dsym: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_20__.t)('A required debug information file was missing.'),
  native_missing_system_dsym: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_20__.t)('A system debug information file was missing.'),
  native_missing_symbol: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_20__.t)('Could not resolve one or more frames in debug information file.'),
  native_simulator_frame: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_20__.t)('Encountered an unprocessable simulator frame.'),
  native_unknown_image: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_20__.t)('A binary image is referenced that is unknown.'),
  proguard_missing_mapping: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_20__.t)('A proguard mapping file was missing.'),
  proguard_missing_lineno: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_20__.t)('A proguard mapping file does not contain line info.')
};
const HELP_LINKS = {
  native_missing_dsym: 'https://docs.sentry.io/platforms/apple/dsym/',
  native_bad_dsym: 'https://docs.sentry.io/platforms/apple/dsym/',
  native_missing_system_dsym: 'https://develop.sentry.dev/self-hosted/',
  native_missing_symbol: 'https://develop.sentry.dev/self-hosted/'
};

class ProjectProcessingIssues extends react__WEBPACK_IMPORTED_MODULE_3__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", {
      formData: {},
      loading: true,
      reprocessing: false,
      expected: 0,
      error: false,
      processingIssues: null,
      pageLinks: null
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "fetchData", () => {
      const {
        orgId,
        projectId
      } = this.props.params;
      this.setState({
        expected: this.state.expected + 2
      });
      this.props.api.request(`/projects/${orgId}/${projectId}/`, {
        success: data => {
          const expected = this.state.expected - 1;
          this.setState({
            expected,
            loading: expected > 0,
            formData: data.options
          });
        },
        error: () => {
          const expected = this.state.expected - 1;
          this.setState({
            expected,
            error: true,
            loading: expected > 0
          });
        }
      });
      this.props.api.request(`/projects/${orgId}/${projectId}/processingissues/?detailed=1`, {
        success: (data, _, resp) => {
          var _resp$getResponseHead;

          const expected = this.state.expected - 1;
          this.setState({
            expected,
            error: false,
            loading: expected > 0,
            processingIssues: data,
            pageLinks: (_resp$getResponseHead = resp === null || resp === void 0 ? void 0 : resp.getResponseHeader('Link')) !== null && _resp$getResponseHead !== void 0 ? _resp$getResponseHead : null
          });
        },
        error: () => {
          const expected = this.state.expected - 1;
          this.setState({
            expected,
            error: true,
            loading: expected > 0
          });
        }
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "sendReprocessing", e => {
      e.preventDefault();
      this.setState({
        loading: true,
        reprocessing: true
      });
      (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_4__.addLoadingMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_20__.t)('Started reprocessing\u2026'));
      const {
        orgId,
        projectId
      } = this.props.params;
      this.props.api.request(`/projects/${orgId}/${projectId}/reprocessing/`, {
        method: 'POST',
        success: () => {
          this.fetchData();
          this.setState({
            reprocessing: false
          });
        },
        error: () => {
          this.setState({
            reprocessing: false
          });
        },
        complete: () => {
          (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_4__.clearIndicators)();
        }
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "discardEvents", () => {
      const {
        orgId,
        projectId
      } = this.props.params;
      this.setState({
        expected: this.state.expected + 1
      });
      this.props.api.request(`/projects/${orgId}/${projectId}/processingissues/discard/`, {
        method: 'DELETE',
        success: () => {
          const expected = this.state.expected - 1;
          this.setState({
            expected,
            error: false,
            loading: expected > 0
          }); // TODO (billyvg): Need to fix this
          // we reload to get rid of the badge in the sidebar

          window.location.reload();
        },
        error: () => {
          const expected = this.state.expected - 1;
          this.setState({
            expected,
            error: true,
            loading: expected > 0
          });
        }
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "deleteProcessingIssues", () => {
      const {
        orgId,
        projectId
      } = this.props.params;
      this.setState({
        expected: this.state.expected + 1
      });
      this.props.api.request(`/projects/${orgId}/${projectId}/processingissues/`, {
        method: 'DELETE',
        success: () => {
          const expected = this.state.expected - 1;
          this.setState({
            expected,
            error: false,
            loading: expected > 0
          }); // TODO (billyvg): Need to fix this
          // we reload to get rid of the badge in the sidebar

          window.location.reload();
        },
        error: () => {
          const expected = this.state.expected - 1;
          this.setState({
            expected,
            error: true,
            loading: expected > 0
          });
        }
      });
    });
  }

  componentDidMount() {
    this.fetchData();
  }

  renderDebugTable() {
    let body;
    const {
      loading,
      error,
      processingIssues
    } = this.state;

    if (loading) {
      body = this.renderLoading();
    } else if (error) {
      body = (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)(sentry_components_loadingError__WEBPACK_IMPORTED_MODULE_13__["default"], {
        onRetry: this.fetchData
      });
    } else if (processingIssues !== null && processingIssues !== void 0 && processingIssues.hasIssues || processingIssues !== null && processingIssues !== void 0 && processingIssues.resolveableIssues || processingIssues !== null && processingIssues !== void 0 && processingIssues.issuesProcessing) {
      body = this.renderResults();
    } else {
      body = this.renderEmpty();
    }

    return body;
  }

  renderLoading() {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_15__.Panel, {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)(sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_14__["default"], {})
    });
  }

  renderEmpty() {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_15__.Panel, {
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)(sentry_components_emptyStateWarning__WEBPACK_IMPORTED_MODULE_9__["default"], {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)("p", {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_20__.t)('Good news! There are no processing issues.')
        })
      })
    });
  }

  getProblemDescription(item) {
    const msg = projectProcessingIssuesMessages[item.type];
    return msg || (0,sentry_locale__WEBPACK_IMPORTED_MODULE_20__.t)('Unknown Error');
  }

  getImageName(path) {
    const pathSegments = path.split(/^([a-z]:\\|\\\\)/i.test(path) ? '\\' : '/');
    return pathSegments[pathSegments.length - 1];
  }

  renderProblem(item) {
    const description = this.getProblemDescription(item);
    const helpLink = HELP_LINKS[item.type];
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsxs)("div", {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)("span", {
        children: description
      }), ' ', helpLink && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)(sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_12__["default"], {
        href: helpLink,
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_19__.IconQuestion, {
          size: "xs"
        })
      })]
    });
  }

  renderDetails(item) {
    let dsymUUID = null;
    let dsymName = null;
    let dsymArch = null;

    if (item.data._scope === 'native') {
      if (item.data.image_uuid) {
        dsymUUID = (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)("code", {
          className: "uuid",
          children: item.data.image_uuid
        });
      }

      if (item.data.image_path) {
        dsymName = (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)("em", {
          children: this.getImageName(item.data.image_path)
        });
      }

      if (item.data.image_arch) {
        dsymArch = item.data.image_arch;
      }
    }

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsxs)("span", {
      children: [dsymUUID && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsxs)("span", {
        children: [" ", dsymUUID]
      }), dsymArch && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsxs)("span", {
        children: [" ", dsymArch]
      }), dsymName && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsxs)("span", {
        children: [" (for ", dsymName, ")"]
      })]
    });
  }

  renderResolveButton() {
    const issues = this.state.processingIssues;

    if (issues === null || this.state.reprocessing) {
      return null;
    }

    if (issues.resolveableIssues <= 0) {
      return null;
    }

    const fixButton = (0,sentry_locale__WEBPACK_IMPORTED_MODULE_20__.tn)('Click here to trigger processing for %s pending event', 'Click here to trigger processing for %s pending events', issues.resolveableIssues);
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsxs)(sentry_components_alertLink__WEBPACK_IMPORTED_MODULE_6__["default"], {
      priority: "info",
      onClick: this.sendReprocessing,
      children: [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_20__.t)('Pro Tip'), ": ", fixButton]
    });
  }

  renderResults() {
    var _processingIssues$iss;

    const {
      processingIssues
    } = this.state;
    const fixLink = processingIssues ? processingIssues.signedLink : false;
    let fixLinkBlock = null;

    if (fixLink) {
      fixLinkBlock = (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsxs)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_15__.Panel, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_15__.PanelHeader, {
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_20__.t)('Having trouble uploading debug informations? We can help!')
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsxs)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_15__.PanelBody, {
          withPadding: true,
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)("label", {
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_20__.t)("Paste this command into your shell and we'll attempt to upload the missing symbols from your machine:")
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsxs)(AutoSelectTextInput, {
            readOnly: true,
            children: ["curl -sL \"", fixLink, "\" | bash"]
          })]
        })]
      });
    }

    let processingRow = null;

    if (processingIssues && processingIssues.issuesProcessing > 0) {
      processingRow = (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)(StyledPanelAlert, {
        type: "info",
        showIcon: true,
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_20__.tn)('Reprocessing %s event …', 'Reprocessing %s events …', processingIssues.issuesProcessing)
      });
    }

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsxs)(react__WEBPACK_IMPORTED_MODULE_3__.Fragment, {
      children: [fixLinkBlock, (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsxs)("h3", {
        children: [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_20__.t)('Pending Issues'), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)(sentry_components_acl_access__WEBPACK_IMPORTED_MODULE_5__["default"], {
          access: ['project:write'],
          children: _ref => {
            let {
              hasAccess
            } = _ref;
            return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_8__["default"], {
              size: "sm",
              className: "pull-right",
              disabled: !hasAccess,
              onClick: () => this.discardEvents(),
              children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_20__.t)('Discard all')
            });
          }
        })]
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsxs)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_15__.PanelTable, {
        headers: [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_20__.t)('Problem'), (0,sentry_locale__WEBPACK_IMPORTED_MODULE_20__.t)('Details'), (0,sentry_locale__WEBPACK_IMPORTED_MODULE_20__.t)('Events'), (0,sentry_locale__WEBPACK_IMPORTED_MODULE_20__.t)('Last seen')],
        children: [processingRow, processingIssues === null || processingIssues === void 0 ? void 0 : (_processingIssues$iss = processingIssues.issues) === null || _processingIssues$iss === void 0 ? void 0 : _processingIssues$iss.map((item, idx) => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsxs)(react__WEBPACK_IMPORTED_MODULE_3__.Fragment, {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)("div", {
            children: this.renderProblem(item)
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)("div", {
            children: this.renderDetails(item)
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)("div", {
            children: item.numEvents + ''
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)("div", {
            children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)(sentry_components_timeSince__WEBPACK_IMPORTED_MODULE_17__["default"], {
              date: item.lastSeen
            })
          })]
        }, idx))]
      })]
    });
  }

  renderReprocessingSettings() {
    const access = new Set(this.props.organization.access);

    if (this.state.loading) {
      return this.renderLoading();
    }

    const {
      formData
    } = this.state;
    const {
      orgId,
      projectId
    } = this.props.params;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)(sentry_components_forms_form__WEBPACK_IMPORTED_MODULE_10__["default"], {
      saveOnBlur: true,
      onSubmitSuccess: this.deleteProcessingIssues,
      apiEndpoint: `/projects/${orgId}/${projectId}/`,
      apiMethod: "PUT",
      initialData: formData,
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)(sentry_components_forms_jsonForm__WEBPACK_IMPORTED_MODULE_11__["default"], {
        access: access,
        forms: sentry_data_forms_processingIssues__WEBPACK_IMPORTED_MODULE_18__["default"],
        renderHeader: () => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_15__.PanelAlert, {
          type: "warning",
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)(sentry_views_settings_components_text_textBlock__WEBPACK_IMPORTED_MODULE_25__["default"], {
            noMargin: true,
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_20__.t)(`Reprocessing does not apply to Minidumps. Even when enabled,
                    Minidump events with processing issues will show up in the
                    issues stream immediately and cannot be reprocessed.`)
          })
        })
      })
    });
  }

  render() {
    const {
      projectId
    } = this.props.params;
    const title = (0,sentry_locale__WEBPACK_IMPORTED_MODULE_20__.t)('Processing Issues');
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsxs)("div", {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)(sentry_components_sentryDocumentTitle__WEBPACK_IMPORTED_MODULE_16__["default"], {
        title: title,
        projectSlug: projectId
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)(sentry_views_settings_components_settingsPageHeader__WEBPACK_IMPORTED_MODULE_24__["default"], {
        title: title
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_26__.jsx)(sentry_views_settings_components_text_textBlock__WEBPACK_IMPORTED_MODULE_25__["default"], {
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_20__.t)(`For some platforms the event processing requires configuration or
          manual action.  If a misconfiguration happens or some necessary
          steps are skipped, issues can occur during processing. (The most common
          reason for this is missing debug symbols.) In these cases you can see
          all the problems here with guides of how to correct them.`)
      }), this.renderDebugTable(), this.renderResolveButton(), this.renderReprocessingSettings()]
    });
  }

}

ProjectProcessingIssues.displayName = "ProjectProcessingIssues";

const StyledPanelAlert = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_panels__WEBPACK_IMPORTED_MODULE_15__.PanelAlert,  true ? {
  target: "e63kjta1"
} : 0)( true ? {
  name: "1xtwnfq",
  styles: "grid-column:1/5"
} : 0);

const AutoSelectTextInput = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_autoSelectText__WEBPACK_IMPORTED_MODULE_7__["default"],  true ? {
  target: "e63kjta0"
} : 0)("font-family:", p => p.theme.text.familyMono, ";", p => (0,sentry_styles_input__WEBPACK_IMPORTED_MODULE_21__.inputStyles)(p), ";" + ( true ? "" : 0));


/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_22__["default"])((0,sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_23__["default"])(ProjectProcessingIssues)));

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_views_settings_project_projectProcessingIssues_tsx.8737dcc4499c104976a74df931fc126b.js.map