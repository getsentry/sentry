"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_views_admin_adminUserEdit_tsx"],{

/***/ "./app/views/admin/adminUserEdit.tsx":
/*!*******************************************!*\
  !*** ./app/views/admin/adminUserEdit.tsx ***!
  \*******************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! core-js/modules/es.string.replace.js */ "../node_modules/core-js/modules/es.string.replace.js");
/* harmony import */ var core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_string_replace_js__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var react_router__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! react-router */ "../node_modules/react-router/es/index.js");
/* harmony import */ var sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/actionCreators/indicator */ "./app/actionCreators/indicator.tsx");
/* harmony import */ var sentry_actionCreators_modal__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/actionCreators/modal */ "./app/actionCreators/modal.tsx");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_forms_controls_radioGroup__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/forms/controls/radioGroup */ "./app/components/forms/controls/radioGroup.tsx");
/* harmony import */ var sentry_components_forms_form__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/forms/form */ "./app/components/forms/form.tsx");
/* harmony import */ var sentry_components_forms_jsonForm__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/components/forms/jsonForm */ "./app/components/forms/jsonForm.tsx");
/* harmony import */ var sentry_components_forms_model__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/components/forms/model */ "./app/components/forms/model.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_views_asyncView__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/views/asyncView */ "./app/views/asyncView.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");


















const userEditForm = {
  title: 'User details',
  fields: [{
    name: 'name',
    type: 'string',
    required: true,
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('Name')
  }, {
    name: 'username',
    type: 'string',
    required: true,
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('Username'),
    help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('The username is the unique id of the user in the system')
  }, {
    name: 'email',
    type: 'string',
    required: true,
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('Email'),
    help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('The users primary email address')
  }, {
    name: 'isActive',
    type: 'boolean',
    required: true,
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('Active'),
    help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('Designates whether this user should be treated as active. Unselect this instead of deleting accounts.')
  }, {
    name: 'isStaff',
    type: 'boolean',
    required: true,
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('Admin'),
    help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('Designates whether this user can perform administrative functions.')
  }, {
    name: 'isSuperuser',
    type: 'boolean',
    required: true,
    label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('Superuser'),
    help: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('Designates whether this user has all permissions without explicitly assigning them.')
  }]
};
const REMOVE_BUTTON_LABEL = {
  disable: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('Disable User'),
  delete: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('Permanently Delete User')
};

class RemoveUserModal extends react__WEBPACK_IMPORTED_MODULE_4__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", {
      deleteType: 'disable'
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "onRemove", () => {
      this.props.onRemove(this.state.deleteType);
      this.props.closeModal();
    });
  }

  render() {
    const {
      user
    } = this.props;
    const {
      deleteType
    } = this.state;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsxs)(react__WEBPACK_IMPORTED_MODULE_4__.Fragment, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_components_forms_controls_radioGroup__WEBPACK_IMPORTED_MODULE_9__["default"], {
        value: deleteType,
        label: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('Remove user %s', user.email),
        onChange: type => this.setState({
          deleteType: type
        }),
        choices: [['disable', (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('Disable the account.')], ['delete', (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('Permanently remove the user and their data.')]]
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsxs)(ModalFooter, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_8__["default"], {
          priority: "danger",
          onClick: this.onRemove,
          children: REMOVE_BUTTON_LABEL[deleteType]
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_8__["default"], {
          onClick: this.props.closeModal,
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('Cancel')
        })]
      })]
    });
  }

}

RemoveUserModal.displayName = "RemoveUserModal";

class AdminUserEdit extends sentry_views_asyncView__WEBPACK_IMPORTED_MODULE_15__["default"] {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "removeUser", actionTypes => actionTypes === 'delete' ? this.deleteUser() : this.deactivateUser());

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "formModel", new sentry_components_forms_model__WEBPACK_IMPORTED_MODULE_12__["default"]());
  }

  get userEndpoint() {
    const {
      params
    } = this.props;
    return `/users/${params.id}/`;
  }

  getEndpoints() {
    return [['user', this.userEndpoint]];
  }

  async deleteUser() {
    var _this$state$user;

    await this.api.requestPromise(this.userEndpoint, {
      method: 'DELETE',
      data: {
        hardDelete: true,
        organizations: []
      }
    });
    (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_6__.addSuccessMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)("%s's account has been deleted.", (_this$state$user = this.state.user) === null || _this$state$user === void 0 ? void 0 : _this$state$user.email));
    react_router__WEBPACK_IMPORTED_MODULE_5__.browserHistory.replace('/manage/users/');
  }

  async deactivateUser() {
    const response = await this.api.requestPromise(this.userEndpoint, {
      method: 'PUT',
      data: {
        isActive: false
      }
    });
    this.setState({
      user: response
    });
    this.formModel.setInitialData(response);
    (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_6__.addSuccessMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)("%s's account has been deactivated.", response.email));
  }

  renderBody() {
    const {
      user
    } = this.state;

    if (user === null) {
      return null;
    }

    const openDeleteModal = () => (0,sentry_actionCreators_modal__WEBPACK_IMPORTED_MODULE_7__.openModal)(opts => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(RemoveUserModal, {
      user: user,
      onRemove: this.removeUser,
      ...opts
    }));

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsxs)(react__WEBPACK_IMPORTED_MODULE_4__.Fragment, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)("h3", {
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('Users')
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)("p", {
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('Editing user: %s', user.email)
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_components_forms_form__WEBPACK_IMPORTED_MODULE_10__["default"], {
        model: this.formModel,
        initialData: user,
        apiMethod: "PUT",
        apiEndpoint: this.userEndpoint,
        requireChanges: true,
        onSubmitError: sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_6__.addErrorMessage,
        onSubmitSuccess: data => {
          this.setState({
            user: data
          });
          (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_6__.addSuccessMessage)('User account updated.');
        },
        extraButton: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_8__["default"], {
          type: "button",
          onClick: openDeleteModal,
          style: {
            marginLeft: (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_14__["default"])(1)
          },
          priority: "danger",
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_13__.t)('Remove User')
        }),
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_components_forms_jsonForm__WEBPACK_IMPORTED_MODULE_11__["default"], {
          forms: [userEditForm]
        })
      })]
    });
  }

}

const ModalFooter = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "e1wmf500"
} : 0)("display:grid;grid-auto-flow:column;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_14__["default"])(1), ";justify-content:end;padding:20px 30px;margin:20px -30px -30px;border-top:1px solid ", p => p.theme.border, ";" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (AdminUserEdit);

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

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_views_admin_adminUserEdit_tsx.ce7b13b157706c589e6ec366f704f9e8.js.map