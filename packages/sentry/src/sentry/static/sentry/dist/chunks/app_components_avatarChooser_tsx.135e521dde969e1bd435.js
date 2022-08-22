"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_components_avatarChooser_tsx"],{

/***/ "./app/components/avatarChooser.tsx":
/*!******************************************!*\
  !*** ./app/components/avatarChooser.tsx ***!
  \******************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/actionCreators/indicator */ "./app/actionCreators/indicator.tsx");
/* harmony import */ var sentry_components_avatar__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/avatar */ "./app/components/avatar/index.tsx");
/* harmony import */ var sentry_components_avatarCropper__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/avatarCropper */ "./app/components/avatarCropper.tsx");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_forms_controls_radioGroup__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/forms/controls/radioGroup */ "./app/components/forms/controls/radioGroup.tsx");
/* harmony import */ var sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/links/externalLink */ "./app/components/links/externalLink.tsx");
/* harmony import */ var sentry_components_loadingError__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/loadingError */ "./app/components/loadingError.tsx");
/* harmony import */ var sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/components/loadingIndicator */ "./app/components/loadingIndicator.tsx");
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var sentry_components_well__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/components/well */ "./app/components/well.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/utils/withApi */ "./app/utils/withApi.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




















class AvatarChooser extends react__WEBPACK_IMPORTED_MODULE_3__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", {
      model: this.props.model,
      savedDataUrl: null,
      dataUrl: null,
      hasError: false
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleSaveSettings", ev => {
      var _model$avatar;

      const {
        endpoint,
        api,
        type
      } = this.props;
      const {
        model,
        dataUrl
      } = this.state;
      ev.preventDefault();
      const avatarType = model === null || model === void 0 ? void 0 : (_model$avatar = model.avatar) === null || _model$avatar === void 0 ? void 0 : _model$avatar.avatarType;
      const avatarPhoto = dataUrl === null || dataUrl === void 0 ? void 0 : dataUrl.split(',')[1];
      const data = {
        avatar_type: avatarType
      }; // If an image has been uploaded, then another option is selected, we should not submit the uploaded image

      if (avatarType === 'upload') {
        data.avatar_photo = avatarPhoto;
      }

      if (type !== null && type !== void 0 && type.startsWith('sentryApp')) {
        data.color = type === 'sentryAppColor';
      }

      api.request(endpoint, {
        method: 'PUT',
        data,
        success: resp => {
          this.setState({
            savedDataUrl: this.state.dataUrl
          });
          this.handleSuccess(this.getModelFromResponse(resp));
        },
        error: resp => {
          var _resp$responseJSON;

          const avatarPhotoErrors = (resp === null || resp === void 0 ? void 0 : (_resp$responseJSON = resp.responseJSON) === null || _resp$responseJSON === void 0 ? void 0 : _resp$responseJSON.avatar_photo) || [];
          avatarPhotoErrors.length ? avatarPhotoErrors.map(this.handleError) : this.handleError.bind(this, (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)('There was an error saving your preferences.'));
        }
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleChange", id => {
      var _this$state$model$ava, _this$state$model$ava2;

      return this.updateState({ ...this.state.model,
        avatar: {
          avatarUuid: (_this$state$model$ava = (_this$state$model$ava2 = this.state.model.avatar) === null || _this$state$model$ava2 === void 0 ? void 0 : _this$state$model$ava2.avatarUuid) !== null && _this$state$model$ava !== void 0 ? _this$state$model$ava : '',
          avatarType: id
        }
      });
    });
  }

  UNSAFE_componentWillReceiveProps(nextProps) {
    // Update local state if defined in props
    if (typeof nextProps.model !== 'undefined') {
      this.setState({
        model: nextProps.model
      });
    }
  }

  updateState(model) {
    this.setState({
      model
    });
  }

  getModelFromResponse(resp) {
    var _resp$avatars$find, _resp$avatars;

    const {
      type
    } = this.props;
    const isSentryApp = type === null || type === void 0 ? void 0 : type.startsWith('sentryApp'); // SentryApp endpoint returns all avatars, we need to return only the edited one

    if (!isSentryApp) {
      return resp;
    }

    const isColor = type === 'sentryAppColor';
    return {
      avatar: (_resp$avatars$find = resp === null || resp === void 0 ? void 0 : (_resp$avatars = resp.avatars) === null || _resp$avatars === void 0 ? void 0 : _resp$avatars.find(_ref => {
        let {
          color
        } = _ref;
        return color === isColor;
      })) !== null && _resp$avatars$find !== void 0 ? _resp$avatars$find : undefined
    };
  }

  handleError(msg) {
    (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_4__.addErrorMessage)(msg);
  }

  handleSuccess(model) {
    const {
      onSave
    } = this.props;
    this.setState({
      model
    });
    onSave(model);
    (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_4__.addSuccessMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)('Successfully saved avatar preferences'));
  }

  render() {
    var _model$avatar$avatarT, _model$avatar2;

    const {
      allowGravatar,
      allowUpload,
      allowLetter,
      savedDataUrl,
      type,
      isUser,
      disabled,
      title,
      help,
      defaultChoice
    } = this.props;
    const {
      hasError,
      model
    } = this.state;

    if (hasError) {
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_components_loadingError__WEBPACK_IMPORTED_MODULE_10__["default"], {});
    }

    if (!model) {
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_11__["default"], {});
    }

    const {
      allowDefault,
      preview,
      choiceText: defaultChoiceText
    } = defaultChoice || {};
    const avatarType = (_model$avatar$avatarT = (_model$avatar2 = model.avatar) === null || _model$avatar2 === void 0 ? void 0 : _model$avatar2.avatarType) !== null && _model$avatar$avatarT !== void 0 ? _model$avatar$avatarT : 'letter_avatar';
    const isLetter = avatarType === 'letter_avatar';
    const isDefault = Boolean(preview && avatarType === 'default');
    const isTeam = type === 'team';
    const isOrganization = type === 'organization';
    const isSentryApp = type === null || type === void 0 ? void 0 : type.startsWith('sentryApp');
    const choices = [];

    if (allowDefault && preview) {
      choices.push(['default', defaultChoiceText !== null && defaultChoiceText !== void 0 ? defaultChoiceText : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)('Use default avatar')]);
    }

    if (allowLetter) {
      choices.push(['letter_avatar', (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)('Use initials')]);
    }

    if (allowUpload) {
      choices.push(['upload', (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)('Upload an image')]);
    }

    if (allowGravatar) {
      choices.push(['gravatar', (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)('Use Gravatar')]);
    }

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsxs)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_12__.Panel, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_12__.PanelHeader, {
        children: title || (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)('Avatar')
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_12__.PanelBody, {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsxs)(AvatarForm, {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsxs)(AvatarGroup, {
            inline: isLetter || isDefault,
            children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_components_forms_controls_radioGroup__WEBPACK_IMPORTED_MODULE_8__["default"], {
              style: {
                flex: 1
              },
              choices: choices,
              value: avatarType,
              label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)('Avatar Type'),
              onChange: this.handleChange,
              disabled: disabled
            }), isLetter && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_components_avatar__WEBPACK_IMPORTED_MODULE_5__["default"], {
              gravatar: false,
              style: {
                width: 90,
                height: 90
              },
              user: isUser ? model : undefined,
              organization: isOrganization ? model : undefined,
              team: isTeam ? model : undefined,
              sentryApp: isSentryApp ? model : undefined
            }), isDefault && preview]
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsxs)(AvatarUploadSection, {
            children: [allowGravatar && avatarType === 'gravatar' && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsxs)(sentry_components_well__WEBPACK_IMPORTED_MODULE_13__["default"], {
              children: [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)('Gravatars are managed through '), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_9__["default"], {
                href: "http://gravatar.com",
                children: "Gravatar.com"
              })]
            }), model.avatar && avatarType === 'upload' && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_components_avatarCropper__WEBPACK_IMPORTED_MODULE_6__["default"], { ...this.props,
              type: type,
              model: model,
              savedDataUrl: savedDataUrl,
              updateDataUrlState: dataState => this.setState(dataState)
            }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsxs)(AvatarSubmit, {
              className: "form-actions",
              children: [help && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(AvatarHelp, {
                children: help
              }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_17__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_7__["default"], {
                type: "button",
                priority: "primary",
                onClick: this.handleSaveSettings,
                disabled: disabled,
                children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_14__.t)('Save Avatar')
              })]
            })]
          })]
        })
      })]
    });
  }

}

AvatarChooser.displayName = "AvatarChooser";

(0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(AvatarChooser, "defaultProps", {
  allowGravatar: true,
  allowLetter: true,
  allowUpload: true,
  type: 'user',
  onSave: () => {},
  defaultChoice: {
    allowDefault: false
  }
});

const AvatarHelp = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('p',  true ? {
  target: "ecp1fla4"
} : 0)("margin-right:auto;color:", p => p.theme.gray300, ";font-size:14px;width:50%;" + ( true ? "" : 0));

const AvatarGroup = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "ecp1fla3"
} : 0)("display:flex;flex-direction:", p => p.inline ? 'row' : 'column', ";" + ( true ? "" : 0));

const AvatarForm = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "ecp1fla2"
} : 0)("line-height:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_15__["default"])(3), ";padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_15__["default"])(1.5), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_15__["default"])(2), ";margin:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_15__["default"])(1.5), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_15__["default"])(1), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_15__["default"])(0.5), ";" + ( true ? "" : 0));

const AvatarSubmit = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('fieldset',  true ? {
  target: "ecp1fla1"
} : 0)("display:flex;align-items:center;margin-top:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_15__["default"])(4), ";padding-top:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_15__["default"])(1.5), ";" + ( true ? "" : 0));

const AvatarUploadSection = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "ecp1fla0"
} : 0)("margin-top:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_15__["default"])(1.5), ";" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_16__["default"])(AvatarChooser));

/***/ }),

/***/ "./app/components/avatarCropper.tsx":
/*!******************************************!*\
  !*** ./app/components/avatarCropper.tsx ***!
  \******************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var core_js_modules_web_url_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! core-js/modules/web.url.js */ "../node_modules/core-js/modules/web.url.js");
/* harmony import */ var core_js_modules_web_url_js__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_url_js__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var core_js_modules_web_url_search_params_js__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! core-js/modules/web.url-search-params.js */ "../node_modules/core-js/modules/web.url-search-params.js");
/* harmony import */ var core_js_modules_web_url_search_params_js__WEBPACK_IMPORTED_MODULE_4___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_url_search_params_js__WEBPACK_IMPORTED_MODULE_4__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/actionCreators/indicator */ "./app/actionCreators/indicator.tsx");
/* harmony import */ var sentry_components_well__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/well */ "./app/components/well.tsx");
/* harmony import */ var sentry_constants__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/constants */ "./app/constants/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");






function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }








const resizerPositions = {
  nw: ['top', 'left'],
  ne: ['top', 'right'],
  se: ['bottom', 'right'],
  sw: ['bottom', 'left']
};

class AvatarCropper extends react__WEBPACK_IMPORTED_MODULE_5__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", {
      file: null,
      objectURL: null,
      mousePosition: {
        pageX: 0,
        pageY: 0
      },
      resizeDimensions: {
        top: 0,
        left: 0,
        size: 0
      },
      resizeDirection: null
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "file", /*#__PURE__*/(0,react__WEBPACK_IMPORTED_MODULE_5__.createRef)());

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "canvas", /*#__PURE__*/(0,react__WEBPACK_IMPORTED_MODULE_5__.createRef)());

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "image", /*#__PURE__*/(0,react__WEBPACK_IMPORTED_MODULE_5__.createRef)());

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "cropContainer", /*#__PURE__*/(0,react__WEBPACK_IMPORTED_MODULE_5__.createRef)());

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "MIN_DIMENSION", 256);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "MAX_DIMENSION", 1024);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "ALLOWED_MIMETYPES", 'image/gif,image/jpeg,image/png');

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "onSelectFile", ev => {
      const file = ev.target.files && ev.target.files[0]; // No file selected (e.g. user clicked "cancel")

      if (!file) {
        return;
      }

      if (!/^image\//.test(file.type)) {
        (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_6__.addErrorMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('That is not a supported file type.'));
        return;
      }

      this.revokeObjectUrl();
      const {
        updateDataUrlState
      } = this.props;
      const objectURL = window.URL.createObjectURL(file);
      this.setState({
        file,
        objectURL
      }, () => updateDataUrlState({
        savedDataUrl: null
      }));
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "revokeObjectUrl", () => this.state.objectURL && window.URL.revokeObjectURL(this.state.objectURL));

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "onImageLoad", () => {
      const error = this.validateImage();

      if (error) {
        this.revokeObjectUrl();
        this.setState({
          objectURL: null
        });
        (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_6__.addErrorMessage)(error);
        return;
      }

      const image = this.image.current;

      if (!image) {
        return;
      }

      const dimension = Math.min(image.clientHeight, image.clientWidth);
      const state = {
        resizeDimensions: {
          size: dimension,
          top: 0,
          left: 0
        }
      };
      this.setState(state, this.drawToCanvas);
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "updateDimensions", ev => {
      const cropContainer = this.cropContainer.current;

      if (!cropContainer) {
        return;
      }

      const {
        mousePosition,
        resizeDimensions
      } = this.state;
      let pageY = ev.pageY;
      let pageX = ev.pageX;
      let top = resizeDimensions.top + (pageY - mousePosition.pageY);
      let left = resizeDimensions.left + (pageX - mousePosition.pageX);

      if (top < 0) {
        top = 0;
        pageY = mousePosition.pageY;
      } else if (top + resizeDimensions.size > cropContainer.clientHeight) {
        top = cropContainer.clientHeight - resizeDimensions.size;
        pageY = mousePosition.pageY;
      }

      if (left < 0) {
        left = 0;
        pageX = mousePosition.pageX;
      } else if (left + resizeDimensions.size > cropContainer.clientWidth) {
        left = cropContainer.clientWidth - resizeDimensions.size;
        pageX = mousePosition.pageX;
      }

      this.setState(state => ({
        resizeDimensions: { ...state.resizeDimensions,
          top,
          left
        },
        mousePosition: {
          pageX,
          pageY
        }
      }));
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "onMouseDown", ev => {
      ev.preventDefault();
      this.setState({
        mousePosition: {
          pageY: ev.pageY,
          pageX: ev.pageX
        }
      });
      document.addEventListener('mousemove', this.updateDimensions);
      document.addEventListener('mouseup', this.onMouseUp);
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "onMouseUp", ev => {
      ev.preventDefault();
      document.removeEventListener('mousemove', this.updateDimensions);
      document.removeEventListener('mouseup', this.onMouseUp);
      this.drawToCanvas();
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "startResize", (direction, ev) => {
      ev.stopPropagation();
      ev.preventDefault();
      document.addEventListener('mousemove', this.updateSize);
      document.addEventListener('mouseup', this.stopResize);
      this.setState({
        resizeDirection: direction,
        mousePosition: {
          pageY: ev.pageY,
          pageX: ev.pageX
        }
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "stopResize", ev => {
      ev.stopPropagation();
      ev.preventDefault();
      document.removeEventListener('mousemove', this.updateSize);
      document.removeEventListener('mouseup', this.stopResize);
      this.setState({
        resizeDirection: null
      });
      this.drawToCanvas();
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "updateSize", ev => {
      const cropContainer = this.cropContainer.current;

      if (!cropContainer) {
        return;
      }

      const {
        mousePosition
      } = this.state;
      const yDiff = ev.pageY - mousePosition.pageY;
      const xDiff = ev.pageX - mousePosition.pageX;
      this.setState({
        resizeDimensions: this.getNewDimensions(cropContainer, yDiff, xDiff),
        mousePosition: {
          pageX: ev.pageX,
          pageY: ev.pageY
        }
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "getDiffNW", (yDiff, xDiff) => (yDiff - yDiff * 2 + (xDiff - xDiff * 2)) / 2);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "getDiffNE", (yDiff, xDiff) => (yDiff - yDiff * 2 + xDiff) / 2);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "getDiffSW", (yDiff, xDiff) => (yDiff + (xDiff - xDiff * 2)) / 2);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "getDiffSE", (yDiff, xDiff) => (yDiff + xDiff) / 2);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "getNewDimensions", (container, yDiff, xDiff) => {
      const {
        resizeDimensions: oldDimensions,
        resizeDirection
      } = this.state;
      const diff = this['getDiff' + resizeDirection.toUpperCase()](yDiff, xDiff);
      let height = container.clientHeight - oldDimensions.top;
      let width = container.clientWidth - oldDimensions.left; // Depending on the direction, we update different dimensions:
      // nw: size, top, left
      // ne: size, top
      // sw: size, left
      // se: size

      const editingTop = resizeDirection === 'nw' || resizeDirection === 'ne';
      const editingLeft = resizeDirection === 'nw' || resizeDirection === 'sw';
      const newDimensions = {
        top: 0,
        left: 0,
        size: oldDimensions.size + diff
      };

      if (editingTop) {
        newDimensions.top = oldDimensions.top - diff;
        height = container.clientHeight - newDimensions.top;
      }

      if (editingLeft) {
        newDimensions.left = oldDimensions.left - diff;
        width = container.clientWidth - newDimensions.left;
      }

      if (newDimensions.top < 0) {
        newDimensions.size = newDimensions.size + newDimensions.top;

        if (editingLeft) {
          newDimensions.left = newDimensions.left - newDimensions.top;
        }

        newDimensions.top = 0;
      }

      if (newDimensions.left < 0) {
        newDimensions.size = newDimensions.size + newDimensions.left;

        if (editingTop) {
          newDimensions.top = newDimensions.top - newDimensions.left;
        }

        newDimensions.left = 0;
      }

      const maxSize = Math.min(width, height);

      if (newDimensions.size > maxSize) {
        if (editingTop) {
          newDimensions.top = newDimensions.top + newDimensions.size - maxSize;
        }

        if (editingLeft) {
          newDimensions.left = newDimensions.left + newDimensions.size - maxSize;
        }

        newDimensions.size = maxSize;
      } else if (newDimensions.size < this.MIN_DIMENSION) {
        if (editingTop) {
          newDimensions.top = newDimensions.top + newDimensions.size - this.MIN_DIMENSION;
        }

        if (editingLeft) {
          newDimensions.left = newDimensions.left + newDimensions.size - this.MIN_DIMENSION;
        }

        newDimensions.size = this.MIN_DIMENSION;
      }

      return { ...oldDimensions,
        ...newDimensions
      };
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "uploadClick", ev => {
      ev.preventDefault();
      this.file.current && this.file.current.click();
    });
  }

  componentWillUnmount() {
    this.revokeObjectUrl();
  }

  validateImage() {
    const img = this.image.current;

    if (!img) {
      return null;
    }

    if (img.naturalWidth < this.MIN_DIMENSION || img.naturalHeight < this.MIN_DIMENSION) {
      return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.tct)('Please upload an image larger than [size]px by [size]px.', {
        size: this.MIN_DIMENSION - 1
      });
    }

    if (img.naturalWidth > this.MAX_DIMENSION || img.naturalHeight > this.MAX_DIMENSION) {
      return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.tct)('Please upload an image smaller than [size]px by [size]px.', {
        size: this.MAX_DIMENSION
      });
    }

    return null;
  }

  drawToCanvas() {
    const canvas = this.canvas.current;

    if (!canvas) {
      return;
    }

    const image = this.image.current;

    if (!image) {
      return;
    }

    const {
      left,
      top,
      size
    } = this.state.resizeDimensions; // Calculate difference between natural dimensions and rendered dimensions

    const ratio = (image.naturalHeight / image.clientHeight + image.naturalWidth / image.clientWidth) / 2;
    canvas.width = size * ratio;
    canvas.height = size * ratio;
    canvas.getContext('2d').drawImage(image, left * ratio, top * ratio, size * ratio, size * ratio, 0, 0, size * ratio, size * ratio);
    this.props.updateDataUrlState({
      dataUrl: canvas.toDataURL()
    });
  }

  get imageSrc() {
    var _model$avatar;

    const {
      savedDataUrl,
      model,
      type
    } = this.props;
    const uuid = (_model$avatar = model.avatar) === null || _model$avatar === void 0 ? void 0 : _model$avatar.avatarUuid;
    const photoUrl = uuid && `/${sentry_constants__WEBPACK_IMPORTED_MODULE_8__.AVATAR_URL_MAP[type] || 'avatar'}/${uuid}/`;
    return savedDataUrl || this.state.objectURL || photoUrl;
  }

  renderImageCrop() {
    const src = this.imageSrc;

    if (!src) {
      return null;
    }

    const {
      resizeDimensions,
      resizeDirection
    } = this.state;
    const style = {
      top: resizeDimensions.top,
      left: resizeDimensions.left,
      width: resizeDimensions.size,
      height: resizeDimensions.size
    };
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(ImageCropper, {
      resizeDirection: resizeDirection,
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsxs)(CropContainer, {
        ref: this.cropContainer,
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)("img", {
          ref: this.image,
          src: src,
          onLoad: this.onImageLoad,
          onDragStart: e => e.preventDefault()
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(Cropper, {
          style: style,
          onMouseDown: this.onMouseDown,
          children: Object.keys(resizerPositions).map(pos => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(Resizer, {
            position: pos,
            onMouseDown: this.startResize.bind(this, pos)
          }, pos))
        })]
      })
    });
  }

  render() {
    const src = this.imageSrc;

    const upload = (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)("a", {
      onClick: this.uploadClick
    });

    const uploader = (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(sentry_components_well__WEBPACK_IMPORTED_MODULE_7__["default"], {
      hasImage: true,
      centered: true,
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)("p", {
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.tct)('[upload:Upload an image] to get started.', {
          upload
        })
      })
    });

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsxs)(react__WEBPACK_IMPORTED_MODULE_5__.Fragment, {
      children: [!src && uploader, src && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(HiddenCanvas, {
        ref: this.canvas
      }), this.renderImageCrop(), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsxs)("div", {
        className: "form-group",
        children: [src && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)("a", {
          onClick: this.uploadClick,
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Change Photo')
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(UploadInput, {
          ref: this.file,
          type: "file",
          accept: this.ALLOWED_MIMETYPES,
          onChange: this.onSelectFile
        })]
      })]
    });
  }

}

AvatarCropper.displayName = "AvatarCropper";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (AvatarCropper);

const UploadInput = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('input',  true ? {
  target: "e12i7tw55"
} : 0)( true ? {
  name: "1trwphv",
  styles: "position:absolute;opacity:0"
} : 0);

const ImageCropper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e12i7tw54"
} : 0)("cursor:", p => p.resizeDirection ? `${p.resizeDirection}-resize` : 'default', ";text-align:center;margin-bottom:20px;background-size:20px 20px;background-position:0 0,0 10px,10px -10px,-10px 0px;background-color:", p => p.theme.background, ";background-image:linear-gradient(\n      45deg,\n      ", p => p.theme.backgroundSecondary, " 25%,\n      rgba(0, 0, 0, 0) 25%\n    ),linear-gradient(-45deg, ", p => p.theme.backgroundSecondary, " 25%, rgba(0, 0, 0, 0) 25%),linear-gradient(45deg, rgba(0, 0, 0, 0) 75%, ", p => p.theme.backgroundSecondary, " 75%),linear-gradient(-45deg, rgba(0, 0, 0, 0) 75%, ", p => p.theme.backgroundSecondary, " 75%);" + ( true ? "" : 0));

const CropContainer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e12i7tw53"
} : 0)( true ? {
  name: "nycxdm",
  styles: "display:inline-block;position:relative;max-width:100%"
} : 0);

const Cropper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e12i7tw52"
} : 0)("position:absolute;border:2px dashed ", p => p.theme.gray300, ";" + ( true ? "" : 0));

const Resizer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e12i7tw51"
} : 0)("border-radius:5px;width:10px;height:10px;position:absolute;background-color:", p => p.theme.gray300, ";cursor:", p => `${p.position}-resize`, ";", p => resizerPositions[p.position].map(pos => `${pos}: -5px;`), ";" + ( true ? "" : 0));

const HiddenCanvas = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('canvas',  true ? {
  target: "e12i7tw50"
} : 0)( true ? {
  name: "eivff4",
  styles: "display:none"
} : 0);

/***/ }),

/***/ "./app/components/well.tsx":
/*!*********************************!*\
  !*** ./app/components/well.tsx ***!
  \*********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");


const Well = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1tfl33i0"
} : 0)("border:1px solid ", p => p.theme.border, ";box-shadow:none;background:", p => p.theme.backgroundSecondary, ";padding:", p => p.hasImage ? '80px 30px' : '15px 20px', ";margin-bottom:20px;border-radius:3px;", p => p.centered && 'text-align: center', ";" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (Well);

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_components_avatarChooser_tsx.3f9ce3fc5e34992456c32b73d89909fb.js.map