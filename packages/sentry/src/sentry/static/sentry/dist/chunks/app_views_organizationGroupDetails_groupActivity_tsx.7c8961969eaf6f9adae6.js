"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_views_organizationGroupDetails_groupActivity_tsx"],{

/***/ "./app/components/activity/note/body.tsx":
/*!***********************************************!*\
  !*** ./app/components/activity/note/body.tsx ***!
  \***********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var sentry_utils_marked__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/utils/marked */ "./app/utils/marked.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");



const NoteBody = _ref => {
  let {
    className,
    text
  } = _ref;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_1__.jsx)("div", {
    className: className,
    "data-test-id": "activity-note-body",
    dangerouslySetInnerHTML: {
      __html: (0,sentry_utils_marked__WEBPACK_IMPORTED_MODULE_0__["default"])(text)
    }
  });
};

NoteBody.displayName = "NoteBody";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (NoteBody);

/***/ }),

/***/ "./app/components/activity/note/editorTools.tsx":
/*!******************************************************!*\
  !*** ./app/components/activity/note/editorTools.tsx ***!
  \******************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");


function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }

const EditorTools = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('span',  true ? {
  target: "el2wm7k0"
} : 0)( true ? {
  name: "eivff4",
  styles: "display:none"
} : 0);

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (EditorTools);

/***/ }),

/***/ "./app/components/activity/note/header.tsx":
/*!*************************************************!*\
  !*** ./app/components/activity/note/header.tsx ***!
  \*************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var sentry_components_activity_author__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/activity/author */ "./app/components/activity/author.tsx");
/* harmony import */ var sentry_components_links_linkWithConfirmation__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/links/linkWithConfirmation */ "./app/components/links/linkWithConfirmation.tsx");
/* harmony import */ var sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/tooltip */ "./app/components/tooltip.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_stores_configStore__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/stores/configStore */ "./app/stores/configStore.tsx");
/* harmony import */ var _editorTools__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! ./editorTools */ "./app/components/activity/note/editorTools.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");










const NoteHeader = _ref => {
  let {
    authorName,
    user,
    onEdit,
    onDelete
  } = _ref;
  const activeUser = sentry_stores_configStore__WEBPACK_IMPORTED_MODULE_5__["default"].get('user');
  const canEdit = activeUser && (activeUser.isSuperuser || (user === null || user === void 0 ? void 0 : user.id) === activeUser.id);
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsxs)("div", {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(sentry_components_activity_author__WEBPACK_IMPORTED_MODULE_1__["default"], {
      children: authorName
    }), canEdit && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsxs)(_editorTools__WEBPACK_IMPORTED_MODULE_6__["default"], {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_3__["default"], {
        title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('You can edit this comment due to your superuser status'),
        disabled: !activeUser.isSuperuser,
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(Edit, {
          onClick: onEdit,
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Edit')
        })
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_3__["default"], {
        title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('You can delete this comment due to your superuser status'),
        disabled: !activeUser.isSuperuser,
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(sentry_components_links_linkWithConfirmation__WEBPACK_IMPORTED_MODULE_2__["default"], {
          title: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Remove'),
          message: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Are you sure you wish to delete this comment?'),
          onConfirm: onDelete,
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(Remove, {
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Remove')
          })
        })
      })]
    })]
  });
};

NoteHeader.displayName = "NoteHeader";

const getActionStyle = p => `
  padding: 0 7px;
  color: ${p.theme.gray200};
  font-weight: normal;
`;

const Edit = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('a',  true ? {
  target: "e1u67hq51"
} : 0)(getActionStyle, ";margin-left:7px;&:hover{color:", p => p.theme.gray300, ";}" + ( true ? "" : 0));

const Remove = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('span',  true ? {
  target: "e1u67hq50"
} : 0)(getActionStyle, ";border-left:1px solid ", p => p.theme.border, ";&:hover{color:", p => p.theme.error, ";}" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (NoteHeader);

/***/ }),

/***/ "./app/components/activity/note/index.tsx":
/*!************************************************!*\
  !*** ./app/components/activity/note/index.tsx ***!
  \************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_activity_item__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/activity/item */ "./app/components/activity/item/index.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var _body__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ./body */ "./app/components/activity/note/body.tsx");
/* harmony import */ var _editorTools__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! ./editorTools */ "./app/components/activity/note/editorTools.tsx");
/* harmony import */ var _header__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! ./header */ "./app/components/activity/note/header.tsx");
/* harmony import */ var _input__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! ./input */ "./app/components/activity/note/input.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");











function Note(props) {
  const [editing, setEditing] = (0,react__WEBPACK_IMPORTED_MODULE_2__.useState)(false);
  const {
    modelId,
    user,
    dateCreated,
    text,
    authorName,
    hideDate,
    minHeight,
    showTime,
    projectSlugs,
    onDelete,
    onCreate,
    onUpdate
  } = props;
  const activityItemProps = {
    hideDate,
    showTime,
    id: `activity-item-${modelId}`,
    author: {
      type: 'user',
      user
    },
    date: dateCreated
  };

  if (!editing) {
    const header = (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(_header__WEBPACK_IMPORTED_MODULE_7__["default"], {
      authorName,
      user,
      onEdit: () => setEditing(true),
      onDelete: () => onDelete(props)
    });

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(ActivityItemWithEditing, { ...activityItemProps,
      header: header,
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(_body__WEBPACK_IMPORTED_MODULE_5__["default"], {
        text: text
      })
    });
  } // When editing, `NoteInput` has its own header, pass render func to control
  // rendering of bubble body


  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(ActivityItemNote, { ...activityItemProps,
    children: () => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(_input__WEBPACK_IMPORTED_MODULE_8__["default"], {
      modelId,
      minHeight,
      text,
      projectSlugs,
      onEditFinish: () => setEditing(false),
      onUpdate: note => {
        onUpdate(note, props);
        setEditing(false);
      },
      onCreate: note => onCreate === null || onCreate === void 0 ? void 0 : onCreate(note)
    })
  });
}

Note.displayName = "Note";

const ActivityItemNote = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_activity_item__WEBPACK_IMPORTED_MODULE_3__["default"],  true ? {
  target: "e1hfgqls1"
} : 0)("ul{list-style:disc;}h1,h2,h3,h4,p,ul:not(.nav),ol,pre,hr,blockquote{margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_4__["default"])(2), ";}ul:not(.nav),ol{padding-left:20px;}p{a{word-wrap:break-word;}}blockquote{font-size:15px;border-left:5px solid ", p => p.theme.innerBorder, ";padding-left:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_4__["default"])(1), ";margin-left:0;}" + ( true ? "" : 0));

const ActivityItemWithEditing = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(ActivityItemNote,  true ? {
  target: "e1hfgqls0"
} : 0)("&:hover{", _editorTools__WEBPACK_IMPORTED_MODULE_6__["default"], "{display:inline-block;}}" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (Note);

/***/ }),

/***/ "./app/components/activity/note/input.tsx":
/*!************************************************!*\
  !*** ./app/components/activity/note/input.tsx ***!
  \************************************************/
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
/* harmony import */ var react_mentions__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! react-mentions */ "../node_modules/react-mentions/dist/react-mentions.esm.js");
/* harmony import */ var _emotion_react__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! @emotion/react */ "../node_modules/@emotion/react/dist/emotion-element-cbed451f.browser.esm.js");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_navTabs__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/navTabs */ "./app/components/navTabs.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_stores_configStore__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/stores/configStore */ "./app/stores/configStore.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_styles_text__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/styles/text */ "./app/styles/text.tsx");
/* harmony import */ var sentry_utils_marked__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/utils/marked */ "./app/utils/marked.tsx");
/* harmony import */ var _mentionables__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! ./mentionables */ "./app/components/activity/note/mentionables.tsx");
/* harmony import */ var _mentionStyle__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! ./mentionStyle */ "./app/components/activity/note/mentionStyle.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");





function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }
















const defaultProps = {
  placeholder: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Add a comment.\nTag users with @, or teams with #'),
  minHeight: 140,
  busy: false
};

class NoteInputComponent extends react__WEBPACK_IMPORTED_MODULE_4__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", {
      preview: false,
      value: this.props.text || '',
      memberMentions: [],
      teamMentions: []
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleToggleEdit", () => {
      this.setState({
        preview: false
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleTogglePreview", () => {
      this.setState({
        preview: true
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleSubmit", e => {
      e.preventDefault();
      this.submitForm();
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleChange", e => {
      this.setState({
        value: e.target.value
      });

      if (this.props.onChange) {
        this.props.onChange(e, {
          updating: !!this.props.modelId
        });
      }
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleKeyDown", e => {
      // Auto submit the form on [meta,ctrl] + Enter
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && this.canSubmit) {
        this.submitForm();
      }
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleCancel", e => {
      e.preventDefault();
      this.finish();
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleAddMember", (id, display) => {
      this.setState(_ref => {
        let {
          memberMentions
        } = _ref;
        return {
          memberMentions: [...memberMentions, [`${id}`, display]]
        };
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleAddTeam", (id, display) => {
      this.setState(_ref2 => {
        let {
          teamMentions
        } = _ref2;
        return {
          teamMentions: [...teamMentions, [`${id}`, display]]
        };
      });
    });
  }

  get canSubmit() {
    return this.state.value.trim() !== '';
  }

  cleanMarkdown(text) {
    return text.replace(/\[sentry\.strip:member\]/g, '@').replace(/\[sentry\.strip:team\]/g, '');
  }

  submitForm() {
    if (!!this.props.modelId) {
      this.update();
      return;
    }

    this.create();
  }

  create() {
    const {
      onCreate
    } = this.props;

    if (onCreate) {
      onCreate({
        text: this.cleanMarkdown(this.state.value),
        mentions: this.finalizeMentions()
      });
    }
  }

  update() {
    const {
      onUpdate
    } = this.props;

    if (onUpdate) {
      onUpdate({
        text: this.cleanMarkdown(this.state.value),
        mentions: this.finalizeMentions()
      });
    }
  }

  finish() {
    this.props.onEditFinish && this.props.onEditFinish();
  }

  finalizeMentions() {
    const {
      memberMentions,
      teamMentions
    } = this.state; // each mention looks like [id, display]

    return [...memberMentions, ...teamMentions].filter(mention => this.state.value.indexOf(mention[1]) !== -1).map(mention => mention[0]);
  }

  render() {
    const {
      preview,
      value
    } = this.state;
    const {
      modelId,
      busy,
      placeholder,
      minHeight,
      errorJSON,
      memberList,
      teams,
      theme
    } = this.props;
    const existingItem = !!modelId;
    const btnText = existingItem ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Save Comment') : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Post Comment');
    const errorMessage = errorJSON && (typeof errorJSON.detail === 'string' ? errorJSON.detail : errorJSON.detail && errorJSON.detail.message || (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Unable to post comment')) || null;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsxs)(NoteInputForm, {
      "data-test-id": "note-input-form",
      noValidate: true,
      onSubmit: this.handleSubmit,
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsxs)(NoteInputNavTabs, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(NoteInputNavTab, {
          className: !preview ? 'active' : '',
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(NoteInputNavTabLink, {
            onClick: this.handleToggleEdit,
            children: existingItem ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Edit') : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Write')
          })
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(NoteInputNavTab, {
          className: preview ? 'active' : '',
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(NoteInputNavTabLink, {
            onClick: this.handleTogglePreview,
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Preview')
          })
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsxs)(MarkdownTab, {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_8__.IconMarkdown, {}), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(MarkdownSupported, {
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Markdown supported')
          })]
        })]
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(NoteInputBody, {
        children: preview ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(NotePreview, {
          minHeight: minHeight,
          dangerouslySetInnerHTML: {
            __html: (0,sentry_utils_marked__WEBPACK_IMPORTED_MODULE_13__["default"])(this.cleanMarkdown(value))
          }
        }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsxs)(react_mentions__WEBPACK_IMPORTED_MODULE_5__.MentionsInput, {
          style: (0,_mentionStyle__WEBPACK_IMPORTED_MODULE_15__["default"])({
            theme,
            minHeight
          }),
          placeholder: placeholder,
          onChange: this.handleChange,
          onKeyDown: this.handleKeyDown,
          value: value,
          required: true,
          autoFocus: true,
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(react_mentions__WEBPACK_IMPORTED_MODULE_5__.Mention, {
            trigger: "@",
            data: memberList,
            onAdd: this.handleAddMember,
            displayTransform: (_id, display) => `@${display}`,
            markup: "**[sentry.strip:member]__display__**",
            appendSpaceOnAdd: true
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(react_mentions__WEBPACK_IMPORTED_MODULE_5__.Mention, {
            trigger: "#",
            data: teams,
            onAdd: this.handleAddTeam,
            markup: "**[sentry.strip:team]__display__**",
            appendSpaceOnAdd: true
          })]
        })
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsxs)(Footer, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)("div", {
          children: errorMessage && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(ErrorMessage, {
            children: errorMessage
          })
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsxs)("div", {
          children: [existingItem && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(FooterButton, {
            priority: "danger",
            type: "button",
            onClick: this.handleCancel,
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_9__.t)('Cancel')
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(FooterButton, {
            error: errorMessage,
            type: "submit",
            disabled: busy || !this.canSubmit,
            children: btnText
          })]
        })]
      })]
    });
  }

}

NoteInputComponent.displayName = "NoteInputComponent";
const NoteInput = (0,_emotion_react__WEBPACK_IMPORTED_MODULE_17__.d)(NoteInputComponent);

class NoteInputContainer extends react__WEBPACK_IMPORTED_MODULE_4__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "renderInput", _ref3 => {
      let {
        members,
        teams
      } = _ref3;
      const {
        projectSlugs: _,
        ...props
      } = this.props;
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(NoteInput, {
        memberList: members,
        teams: teams,
        ...props
      });
    });
  }

  render() {
    const {
      projectSlugs
    } = this.props;
    const me = sentry_stores_configStore__WEBPACK_IMPORTED_MODULE_10__["default"].get('user');
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(_mentionables__WEBPACK_IMPORTED_MODULE_14__["default"], {
      me: me,
      projectSlugs: projectSlugs,
      children: this.renderInput
    });
  }

}

NoteInputContainer.displayName = "NoteInputContainer";

(0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(NoteInputContainer, "defaultProps", defaultProps);

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (NoteInputContainer);

// This styles both the note preview and the note editor input
const getNotePreviewCss = p => {
  const {
    minHeight,
    padding,
    overflow,
    border
  } = (0,_mentionStyle__WEBPACK_IMPORTED_MODULE_15__["default"])(p)['&multiLine'].input;
  return `
  max-height: 1000px;
  max-width: 100%;
  ${minHeight && `min-height: ${minHeight}px` || ''};
  padding: ${padding};
  overflow: ${overflow};
  border: ${border};
`;
};

const getNoteInputErrorStyles = p => {
  if (!p.error) {
    return '';
  }

  return `
  color: ${p.theme.error};
  margin: -1px;
  border: 1px solid ${p.theme.error};
  border-radius: ${p.theme.borderRadius};

    &:before {
      display: block;
      content: '';
      width: 0;
      height: 0;
      border-top: 7px solid transparent;
      border-bottom: 7px solid transparent;
      border-right: 7px solid ${p.theme.red300};
      position: absolute;
      left: -7px;
      top: 12px;
    }

    &:after {
      display: block;
      content: '';
      width: 0;
      height: 0;
      border-top: 6px solid transparent;
      border-bottom: 6px solid transparent;
      border-right: 6px solid #fff;
      position: absolute;
      left: -5px;
      top: 12px;
    }
  `;
};

const NoteInputForm = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('form',  true ? {
  target: "ewxfxsb10"
} : 0)("font-size:15px;line-height:22px;transition:padding 0.2s ease-in-out;", p => getNoteInputErrorStyles(p), ";" + ( true ? "" : 0));

const NoteInputBody = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "ewxfxsb9"
} : 0)(sentry_styles_text__WEBPACK_IMPORTED_MODULE_12__["default"], ";" + ( true ? "" : 0));

const Footer = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "ewxfxsb8"
} : 0)("display:flex;border-top:1px solid ", p => p.theme.border, ";justify-content:space-between;transition:opacity 0.2s ease-in-out;padding-left:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_11__["default"])(1.5), ";" + ( true ? "" : 0));

const FooterButton = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_button__WEBPACK_IMPORTED_MODULE_6__["default"],  true ? {
  target: "ewxfxsb7"
} : 0)("font-size:13px;margin:-1px -1px -1px;border-radius:0 0 ", p => p.theme.borderRadius, ";", p => p.error && `
  &, &:active, &:focus, &:hover {
  border-bottom-color: ${p.theme.error};
  border-right-color: ${p.theme.error};
  }
  `, ";" + ( true ? "" : 0));

const ErrorMessage = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('span',  true ? {
  target: "ewxfxsb6"
} : 0)("display:flex;align-items:center;height:100%;color:", p => p.theme.error, ";font-size:0.9em;" + ( true ? "" : 0));

const NoteInputNavTabs = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_navTabs__WEBPACK_IMPORTED_MODULE_7__["default"],  true ? {
  target: "ewxfxsb5"
} : 0)("padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_11__["default"])(1), " ", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_11__["default"])(2), " 0;border-bottom:1px solid ", p => p.theme.border, ";margin-bottom:0;" + ( true ? "" : 0));

const NoteInputNavTab = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('li',  true ? {
  target: "ewxfxsb4"
} : 0)( true ? {
  name: "1uwyn4z",
  styles: "margin-right:13px"
} : 0);

const NoteInputNavTabLink = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('a',  true ? {
  target: "ewxfxsb3"
} : 0)( true ? {
  name: "k7xpx9",
  styles: ".nav-tabs>li>&{font-size:15px;padding-bottom:5px;}"
} : 0);

const MarkdownTab = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(NoteInputNavTab,  true ? {
  target: "ewxfxsb2"
} : 0)(".nav-tabs>&{display:flex;align-items:center;margin-right:0;color:", p => p.theme.subText, ";float:right;}" + ( true ? "" : 0));

const MarkdownSupported = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('span',  true ? {
  target: "ewxfxsb1"
} : 0)("margin-left:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_11__["default"])(0.5), ";font-size:14px;" + ( true ? "" : 0));

const NotePreview = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])('div',  true ? {
  target: "ewxfxsb0"
} : 0)(p => getNotePreviewCss(p), ";padding-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_11__["default"])(1), ";" + ( true ? "" : 0));

/***/ }),

/***/ "./app/components/activity/note/inputWithStorage.tsx":
/*!***********************************************************!*\
  !*** ./app/components/activity/note/inputWithStorage.tsx ***!
  \***********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var _sentry_react__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! @sentry/react */ "../node_modules/@sentry/hub/esm/exports.js");
/* harmony import */ var lodash_debounce__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! lodash/debounce */ "../node_modules/lodash/debounce.js");
/* harmony import */ var lodash_debounce__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(lodash_debounce__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var sentry_components_activity_note_input__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/activity/note/input */ "./app/components/activity/note/input.tsx");
/* harmony import */ var sentry_utils_localStorage__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/utils/localStorage */ "./app/utils/localStorage.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");








const defaultProps = {
  /**
   * Triggered when local storage has been loaded and parsed.
   */
  onLoad: data => data,
  onSave: data => data
};

class NoteInputWithStorage extends react__WEBPACK_IMPORTED_MODULE_2__.Component {
  constructor() {
    var _this;

    super(...arguments);
    _this = this;

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "save", lodash_debounce__WEBPACK_IMPORTED_MODULE_3___default()(value => {
      const {
        itemKey,
        onSave
      } = this.props;
      const currentObj = this.fetchFromStorage() || {};
      this.saveToStorage({ ...currentObj,
        [itemKey]: onSave(value)
      });
    }, 150));

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleChange", function (e) {
      let options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
      const {
        onChange
      } = _this.props;

      if (onChange) {
        onChange(e, options);
      }

      if (options.updating) {
        return;
      }

      _this.save(e.target.value);
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleCreate", data => {
      const {
        itemKey,
        onCreate
      } = this.props;

      if (onCreate) {
        onCreate(data);
      } // Remove from local storage


      const storageObj = this.fetchFromStorage() || {}; // Nothing from this `itemKey` is saved to storage, do nothing

      if (!storageObj.hasOwnProperty(itemKey)) {
        return;
      } // Remove `itemKey` from stored object and save to storage
      // eslint-disable-next-line no-unused-vars


      const {
        [itemKey]: _oldItem,
        ...newStorageObj
      } = storageObj;
      this.saveToStorage(newStorageObj);
    });
  }

  fetchFromStorage() {
    const {
      storageKey
    } = this.props;
    const storage = sentry_utils_localStorage__WEBPACK_IMPORTED_MODULE_5__["default"].getItem(storageKey);

    if (!storage) {
      return null;
    }

    try {
      return JSON.parse(storage);
    } catch (err) {
      _sentry_react__WEBPACK_IMPORTED_MODULE_6__.withScope(scope => {
        scope.setExtra('storage', storage);
        _sentry_react__WEBPACK_IMPORTED_MODULE_6__.captureException(err);
      });
      return null;
    }
  }

  saveToStorage(obj) {
    const {
      storageKey
    } = this.props;

    try {
      sentry_utils_localStorage__WEBPACK_IMPORTED_MODULE_5__["default"].setItem(storageKey, JSON.stringify(obj));
    } catch (err) {
      _sentry_react__WEBPACK_IMPORTED_MODULE_6__.captureException(err);
      _sentry_react__WEBPACK_IMPORTED_MODULE_6__.withScope(scope => {
        scope.setExtra('storage', obj);
        _sentry_react__WEBPACK_IMPORTED_MODULE_6__.captureException(err);
      });
    }
  }

  getValue() {
    const {
      itemKey,
      text,
      onLoad
    } = this.props;

    if (text) {
      return text;
    }

    const storageObj = this.fetchFromStorage();

    if (!storageObj) {
      return '';
    }

    if (!storageObj.hasOwnProperty(itemKey)) {
      return '';
    }

    if (!onLoad) {
      return storageObj[itemKey];
    }

    return onLoad(storageObj[itemKey]);
  }

  render() {
    // Make sure `this.props` does not override `onChange` and `onCreate`
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(sentry_components_activity_note_input__WEBPACK_IMPORTED_MODULE_4__["default"], { ...this.props,
      text: this.getValue(),
      onCreate: this.handleCreate,
      onChange: this.handleChange
    });
  }

}

NoteInputWithStorage.displayName = "NoteInputWithStorage";

(0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(NoteInputWithStorage, "defaultProps", defaultProps);

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (NoteInputWithStorage);

/***/ }),

/***/ "./app/components/activity/note/mentionStyle.tsx":
/*!*******************************************************!*\
  !*** ./app/components/activity/note/mentionStyle.tsx ***!
  \*******************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ mentionStyle)
/* harmony export */ });
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");

/**
 * Note this is an object for `react-mentions` component and
 * not a styled component/emotion style
 */

function mentionStyle(_ref) {
  let {
    theme,
    minHeight
  } = _ref;
  return {
    control: {
      backgroundColor: `${theme.background}`,
      fontSize: 15,
      fontWeight: 'normal'
    },
    input: {
      margin: 0
    },
    '&singleLine': {
      control: {
        display: 'inline-block',
        width: 130
      },
      highlighter: {
        padding: 1,
        border: '2px inset transparent'
      },
      input: {
        padding: 1,
        border: '2px inset'
      }
    },
    '&multiLine': {
      control: {
        fontFamily: 'Rubik, Avenir Next, Helvetica Neue, sans-serif',
        minHeight
      },
      highlighter: {
        padding: 20,
        minHeight
      },
      input: {
        padding: `${(0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_0__["default"])(1.5)} ${(0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_0__["default"])(2)} 0`,
        minHeight,
        overflow: 'auto',
        outline: 0,
        border: 0
      }
    },
    suggestions: {
      list: {
        maxHeight: 150,
        overflow: 'auto',
        backgroundColor: `${theme.background}`,
        border: '1px solid rgba(0,0,0,0.15)',
        fontSize: 12
      },
      item: {
        padding: '5px 15px',
        borderBottom: '1px solid rgba(0,0,0,0.15)',
        '&focused': {
          backgroundColor: `${theme.backgroundSecondary}`
        }
      }
    }
  };
}

/***/ }),

/***/ "./app/components/activity/note/mentionables.tsx":
/*!*******************************************************!*\
  !*** ./app/components/activity/note/mentionables.tsx ***!
  \*******************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var lodash_uniqBy__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! lodash/uniqBy */ "../node_modules/lodash/uniqBy.js");
/* harmony import */ var lodash_uniqBy__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(lodash_uniqBy__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var sentry_stores_memberListStore__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/stores/memberListStore */ "./app/stores/memberListStore.tsx");
/* harmony import */ var sentry_utils_callIfFunction__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/utils/callIfFunction */ "./app/utils/callIfFunction.tsx");
/* harmony import */ var sentry_utils_isRenderFunc__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/utils/isRenderFunc */ "./app/utils/isRenderFunc.tsx");
/* harmony import */ var sentry_utils_projects__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/utils/projects */ "./app/utils/projects.tsx");
/* harmony import */ var sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/utils/withOrganization */ "./app/utils/withOrganization.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");











const buildUserId = id => `user:${id}`;

const buildTeamId = id => `team:${id}`;

/**
 * Make sure the actionCreator, `fetchOrgMembers`, has been called somewhere
 * higher up the component chain.
 *
 * Will provide a list of users and teams that can be used for @-mentions
 * */
class Mentionables extends react__WEBPACK_IMPORTED_MODULE_2__.PureComponent {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", {
      members: sentry_stores_memberListStore__WEBPACK_IMPORTED_MODULE_4__["default"].getAll()
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "listeners", [sentry_stores_memberListStore__WEBPACK_IMPORTED_MODULE_4__["default"].listen(users => {
      this.handleMemberListUpdate(users);
    }, undefined)]);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleMemberListUpdate", members => {
      if (members === this.state.members) {
        return;
      }

      this.setState({
        members
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "renderChildren", _ref => {
      let {
        projects
      } = _ref;
      const {
        children,
        me
      } = this.props;

      if ((0,sentry_utils_isRenderFunc__WEBPACK_IMPORTED_MODULE_6__.isRenderFunc)(children)) {
        return children({
          members: this.getMemberList(this.state.members, me),
          teams: this.getTeams(projects)
        });
      }

      return null;
    });
  }

  componentWillUnmount() {
    this.listeners.forEach(sentry_utils_callIfFunction__WEBPACK_IMPORTED_MODULE_5__.callIfFunction);
  }

  getMemberList(memberList, sessionUser) {
    const members = lodash_uniqBy__WEBPACK_IMPORTED_MODULE_3___default()(memberList, _ref2 => {
      let {
        id
      } = _ref2;
      return id;
    }).filter(_ref3 => {
      let {
        id
      } = _ref3;
      return !sessionUser || sessionUser.id !== id;
    });
    return members.map(member => ({
      id: buildUserId(member.id),
      display: member.name,
      email: member.email
    }));
  }

  getTeams(projects) {
    const uniqueTeams = lodash_uniqBy__WEBPACK_IMPORTED_MODULE_3___default()(projects.map(_ref4 => {
      let {
        teams
      } = _ref4;
      return teams;
    }).reduce((acc, teams) => acc.concat(teams || []), []), 'id');
    return uniqueTeams.map(team => ({
      id: buildTeamId(team.id),
      display: `#${team.slug}`,
      email: team.id
    }));
  }

  render() {
    const {
      organization,
      projectSlugs
    } = this.props;

    if (!projectSlugs || !projectSlugs.length) {
      return this.renderChildren({
        projects: []
      });
    }

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(sentry_utils_projects__WEBPACK_IMPORTED_MODULE_7__["default"], {
      slugs: projectSlugs,
      orgId: organization.slug,
      children: this.renderChildren
    });
  }

}

Mentionables.displayName = "Mentionables";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_8__["default"])(Mentionables));

/***/ }),

/***/ "./app/components/commitLink.tsx":
/*!***************************************!*\
  !*** ./app/components/commitLink.tsx ***!
  \***************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/links/externalLink */ "./app/components/links/externalLink.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");








// TODO(epurkhiser, jess): This should be moved into plugins.
const SUPPORTED_PROVIDERS = [{
  icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_3__.IconGithub, {
    size: "xs"
  }),
  providerIds: ['github', 'integrations:github', 'integrations:github_enterprise'],
  commitUrl: _ref => {
    let {
      baseUrl,
      commitId
    } = _ref;
    return `${baseUrl}/commit/${commitId}`;
  }
}, {
  icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_3__.IconBitbucket, {
    size: "xs"
  }),
  providerIds: ['bitbucket', 'integrations:bitbucket'],
  commitUrl: _ref2 => {
    let {
      baseUrl,
      commitId
    } = _ref2;
    return `${baseUrl}/commits/${commitId}`;
  }
}, {
  icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_3__.IconVsts, {
    size: "xs"
  }),
  providerIds: ['visualstudio', 'integrations:vsts'],
  commitUrl: _ref3 => {
    let {
      baseUrl,
      commitId
    } = _ref3;
    return `${baseUrl}/commit/${commitId}`;
  }
}, {
  icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_3__.IconGitlab, {
    size: "xs"
  }),
  providerIds: ['gitlab', 'integrations:gitlab'],
  commitUrl: _ref4 => {
    let {
      baseUrl,
      commitId
    } = _ref4;
    return `${baseUrl}/commit/${commitId}`;
  }
}];

function CommitLink(_ref5) {
  let {
    inline,
    commitId,
    repository,
    showIcon = true
  } = _ref5;

  if (!commitId || !repository) {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)("span", {
      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Unknown Commit')
    });
  }

  const shortId = (0,sentry_utils__WEBPACK_IMPORTED_MODULE_5__.getShortCommitHash)(commitId);
  const providerData = SUPPORTED_PROVIDERS.find(provider => {
    if (!repository.provider) {
      return false;
    }

    return provider.providerIds.includes(repository.provider.id);
  });

  if (providerData === undefined) {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)("span", {
      children: shortId
    });
  }

  const commitUrl = repository.url && providerData.commitUrl({
    commitId,
    baseUrl: repository.url
  });
  return !inline ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_1__["default"], {
    external: true,
    href: commitUrl,
    size: "sm",
    icon: showIcon ? providerData.icon : null,
    children: shortId
  }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsxs)(sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_2__["default"], {
    href: commitUrl,
    children: [showIcon ? providerData.icon : null, ' ' + shortId]
  });
}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (CommitLink);

/***/ }),

/***/ "./app/components/links/linkWithConfirmation.tsx":
/*!*******************************************************!*\
  !*** ./app/components/links/linkWithConfirmation.tsx ***!
  \*******************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var sentry_components_confirm__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sentry/components/confirm */ "./app/components/confirm.tsx");
/* harmony import */ var _anchor__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./anchor */ "./app/components/links/anchor.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




/**
 * <Confirm> is a more generic version of this component
 */
function LinkWithConfirmation(_ref) {
  let {
    className,
    disabled,
    title,
    children,
    ...otherProps
  } = _ref;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)(sentry_components_confirm__WEBPACK_IMPORTED_MODULE_0__["default"], { ...otherProps,
    disabled: disabled,
    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)(_anchor__WEBPACK_IMPORTED_MODULE_1__["default"], {
      href: "#",
      className: className,
      disabled: disabled,
      title: title,
      children: children
    })
  });
}

LinkWithConfirmation.displayName = "LinkWithConfirmation";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (LinkWithConfirmation);

/***/ }),

/***/ "./app/components/pullRequestLink.tsx":
/*!********************************************!*\
  !*** ./app/components/pullRequestLink.tsx ***!
  \********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/links/externalLink */ "./app/components/links/externalLink.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");









function renderIcon(repo) {
  if (!repo.provider) {
    return null;
  }

  const {
    id
  } = repo.provider;
  const providerId = id.includes(':') ? id.split(':').pop() : id;

  switch (providerId) {
    case 'github':
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_4__.IconGithub, {
        size: "xs",
        "data-test-id": "pull-request-github"
      });

    case 'gitlab':
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_4__.IconGitlab, {
        size: "xs",
        "data-test-id": "pull-request-gitlab"
      });

    case 'bitbucket':
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_4__.IconBitbucket, {
        size: "xs"
      });

    default:
      return null;
  }
}

function PullRequestLink(_ref) {
  let {
    pullRequest,
    repository,
    inline
  } = _ref;
  const displayId = `${repository.name} #${pullRequest.id}: ${pullRequest.title}`;

  if (!pullRequest.externalUrl) {
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)("span", {
      children: displayId
    });
  }

  return !inline ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_2__["default"], {
    external: true,
    href: pullRequest.externalUrl,
    size: "sm",
    icon: renderIcon(repository),
    children: displayId
  }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsxs)(ExternalPullLink, {
    href: pullRequest.externalUrl,
    children: [renderIcon(repository), displayId]
  });
}

const ExternalPullLink = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_3__["default"],  true ? {
  target: "e10ywx4z0"
} : 0)("display:inline-flex;align-items:center;gap:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_5__["default"])(0.5), ";" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (PullRequestLink);

/***/ }),

/***/ "./app/components/reprocessedBox.tsx":
/*!*******************************************!*\
  !*** ./app/components/reprocessedBox.tsx ***!
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
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_components_events_styles__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/events/styles */ "./app/components/events/styles.tsx");
/* harmony import */ var sentry_components_links_link__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/links/link */ "./app/components/links/link.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_localStorage__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/utils/localStorage */ "./app/utils/localStorage.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }











class ReprocessedBox extends react__WEBPACK_IMPORTED_MODULE_3__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", {
      isBannerHidden: sentry_utils_localStorage__WEBPACK_IMPORTED_MODULE_9__["default"].getItem(this.getBannerUniqueId()) === 'true'
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleBannerDismiss", () => {
      sentry_utils_localStorage__WEBPACK_IMPORTED_MODULE_9__["default"].setItem(this.getBannerUniqueId(), 'true');
      this.setState({
        isBannerHidden: true
      });
    });
  }

  getBannerUniqueId() {
    const {
      reprocessActivity
    } = this.props;
    const {
      id
    } = reprocessActivity;
    return `reprocessed-activity-${id}-banner-dismissed`;
  }

  renderMessage() {
    const {
      orgSlug,
      reprocessActivity,
      groupCount,
      groupId
    } = this.props;
    const {
      data
    } = reprocessActivity;
    const {
      eventCount,
      oldGroupId,
      newGroupId
    } = data;
    const reprocessedEventsRoute = `/organizations/${orgSlug}/issues/?query=reprocessing.original_issue_id:${oldGroupId}`;

    if (groupCount === 0) {
      return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.tct)('All events in this issue were moved during reprocessing. [link]', {
        link: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(sentry_components_links_link__WEBPACK_IMPORTED_MODULE_5__["default"], {
          to: reprocessedEventsRoute,
          children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.tn)('See %s new event', 'See %s new events', eventCount)
        })
      });
    }

    return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.tct)('Events in this issue were successfully reprocessed. [link]', {
      link: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(sentry_components_links_link__WEBPACK_IMPORTED_MODULE_5__["default"], {
        to: reprocessedEventsRoute,
        children: newGroupId === Number(groupId) ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.tn)('See %s reprocessed event', 'See %s reprocessed events', eventCount) : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.tn)('See %s new event', 'See %s new events', eventCount)
      })
    });
  }

  render() {
    const {
      isBannerHidden
    } = this.state;

    if (isBannerHidden) {
      return null;
    }

    const {
      className
    } = this.props;
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(sentry_components_events_styles__WEBPACK_IMPORTED_MODULE_4__.BannerContainer, {
      priority: "success",
      className: className,
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsxs)(StyledBannerSummary, {
        children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_6__.IconCheckmark, {
          color: "green300",
          isCircled: true
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)("span", {
          children: this.renderMessage()
        }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_10__.jsx)(StyledIconClose, {
          color: "green300",
          "aria-label": (0,sentry_locale__WEBPACK_IMPORTED_MODULE_7__.t)('Dismiss'),
          isCircled: true,
          onClick: this.handleBannerDismiss
        })]
      })
    });
  }

}

ReprocessedBox.displayName = "ReprocessedBox";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (ReprocessedBox);

const StyledBannerSummary = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_components_events_styles__WEBPACK_IMPORTED_MODULE_4__.BannerSummary,  true ? {
  target: "e17keqf51"
} : 0)("&>svg:last-child{margin-right:0;margin-left:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_8__["default"])(1), ";}" + ( true ? "" : 0));

const StyledIconClose = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_1__["default"])(sentry_icons__WEBPACK_IMPORTED_MODULE_6__.IconClose,  true ? {
  target: "e17keqf50"
} : 0)( true ? {
  name: "e0dnmk",
  styles: "cursor:pointer"
} : 0);

/***/ }),

/***/ "./app/views/organizationGroupDetails/groupActivity.tsx":
/*!**************************************************************!*\
  !*** ./app/views/organizationGroupDetails/groupActivity.tsx ***!
  \**************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "GroupActivity": () => (/* binding */ GroupActivity),
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var lodash_uniq__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! lodash/uniq */ "../node_modules/lodash/uniq.js");
/* harmony import */ var lodash_uniq__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(lodash_uniq__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var sentry_actionCreators_group__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/actionCreators/group */ "./app/actionCreators/group.tsx");
/* harmony import */ var sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/actionCreators/indicator */ "./app/actionCreators/indicator.tsx");
/* harmony import */ var sentry_components_activity_author__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/activity/author */ "./app/components/activity/author.tsx");
/* harmony import */ var sentry_components_activity_item__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/activity/item */ "./app/components/activity/item/index.tsx");
/* harmony import */ var sentry_components_activity_note__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/activity/note */ "./app/components/activity/note/index.tsx");
/* harmony import */ var sentry_components_activity_note_inputWithStorage__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/activity/note/inputWithStorage */ "./app/components/activity/note/inputWithStorage.tsx");
/* harmony import */ var sentry_components_errorBoundary__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/components/errorBoundary */ "./app/components/errorBoundary.tsx");
/* harmony import */ var sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/components/layouts/thirds */ "./app/components/layouts/thirds.tsx");
/* harmony import */ var sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/components/loadingIndicator */ "./app/components/loadingIndicator.tsx");
/* harmony import */ var sentry_components_reprocessedBox__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/components/reprocessedBox */ "./app/components/reprocessedBox.tsx");
/* harmony import */ var sentry_constants__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/constants */ "./app/constants/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_stores_configStore__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/stores/configStore */ "./app/stores/configStore.tsx");
/* harmony import */ var sentry_types__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! sentry/types */ "./app/types/index.tsx");
/* harmony import */ var sentry_utils_guid__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! sentry/utils/guid */ "./app/utils/guid.tsx");
/* harmony import */ var sentry_utils_teams__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! sentry/utils/teams */ "./app/utils/teams.tsx");
/* harmony import */ var sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_20__ = __webpack_require__(/*! sentry/utils/withApi */ "./app/utils/withApi.tsx");
/* harmony import */ var sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_21__ = __webpack_require__(/*! sentry/utils/withOrganization */ "./app/utils/withOrganization.tsx");
/* harmony import */ var _groupActivityItem__WEBPACK_IMPORTED_MODULE_22__ = __webpack_require__(/*! ./groupActivityItem */ "./app/views/organizationGroupDetails/groupActivityItem.tsx");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_23__ = __webpack_require__(/*! ./utils */ "./app/views/organizationGroupDetails/utils.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");



























class GroupActivity extends react__WEBPACK_IMPORTED_MODULE_2__.Component {
  constructor() {
    super(...arguments);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "state", {
      createBusy: false,
      error: false,
      errorJSON: null,
      inputId: (0,sentry_utils_guid__WEBPACK_IMPORTED_MODULE_18__.uniqueId)()
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleNoteDelete", async _ref => {
      let {
        modelId,
        text: oldText
      } = _ref;
      const {
        api,
        group
      } = this.props;
      (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_5__.addLoadingMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)('Removing comment...'));

      try {
        await (0,sentry_actionCreators_group__WEBPACK_IMPORTED_MODULE_4__.deleteNote)(api, group, modelId, oldText);
        (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_5__.clearIndicators)();
      } catch (_err) {
        (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_5__.addErrorMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)('Failed to delete comment'));
      }
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleNoteCreate", async note => {
      const {
        api,
        group
      } = this.props;
      this.setState({
        createBusy: true
      });
      (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_5__.addLoadingMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)('Posting comment...'));

      try {
        await (0,sentry_actionCreators_group__WEBPACK_IMPORTED_MODULE_4__.createNote)(api, group, note);
        this.setState({
          createBusy: false,
          // This is used as a `key` to Note Input so that after successful post
          // we reset the value of the input
          inputId: (0,sentry_utils_guid__WEBPACK_IMPORTED_MODULE_18__.uniqueId)()
        });
        (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_5__.clearIndicators)();
      } catch (error) {
        this.setState({
          createBusy: false,
          error: true,
          errorJSON: error.responseJSON || sentry_constants__WEBPACK_IMPORTED_MODULE_14__.DEFAULT_ERROR_JSON
        });
        (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_5__.addErrorMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)('Unable to post comment'));
      }
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "handleNoteUpdate", async (note, _ref2) => {
      let {
        modelId,
        text: oldText
      } = _ref2;
      const {
        api,
        group
      } = this.props;
      (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_5__.addLoadingMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)('Updating comment...'));

      try {
        await (0,sentry_actionCreators_group__WEBPACK_IMPORTED_MODULE_4__.updateNote)(api, group, note, modelId, oldText);
        (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_5__.clearIndicators)();
      } catch (error) {
        this.setState({
          error: true,
          errorJSON: error.responseJSON || sentry_constants__WEBPACK_IMPORTED_MODULE_14__.DEFAULT_ERROR_JSON
        });
        (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_5__.addErrorMessage)((0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)('Unable to update comment'));
      }
    });
  }

  render() {
    const {
      group,
      organization
    } = this.props;
    const {
      activity: activities,
      count,
      id: groupId
    } = group;
    const groupCount = Number(count);
    const mostRecentActivity = (0,_utils__WEBPACK_IMPORTED_MODULE_23__.getGroupMostRecentActivity)(activities);
    const reprocessingStatus = (0,_utils__WEBPACK_IMPORTED_MODULE_23__.getGroupReprocessingStatus)(group, mostRecentActivity);
    const me = sentry_stores_configStore__WEBPACK_IMPORTED_MODULE_16__["default"].get('user');
    const projectSlugs = group && group.project ? [group.project.slug] : [];
    const noteProps = {
      minHeight: 140,
      group,
      projectSlugs,
      placeholder: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_15__.t)('Add details or updates to this event. \nTag users with @, or teams with #')
    };
    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsxs)(react__WEBPACK_IMPORTED_MODULE_2__.Fragment, {
      children: [(reprocessingStatus === _utils__WEBPACK_IMPORTED_MODULE_23__.ReprocessingStatus.REPROCESSED_AND_HASNT_EVENT || reprocessingStatus === _utils__WEBPACK_IMPORTED_MODULE_23__.ReprocessingStatus.REPROCESSED_AND_HAS_EVENT) && (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsx)(sentry_components_reprocessedBox__WEBPACK_IMPORTED_MODULE_13__["default"], {
        reprocessActivity: mostRecentActivity,
        groupCount: groupCount,
        orgSlug: organization.slug,
        groupId: groupId
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsx)(sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_11__.Body, {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsxs)(sentry_components_layouts_thirds__WEBPACK_IMPORTED_MODULE_11__.Main, {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsx)(sentry_components_activity_item__WEBPACK_IMPORTED_MODULE_7__["default"], {
            author: {
              type: 'user',
              user: me
            },
            children: () => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsx)(sentry_components_activity_note_inputWithStorage__WEBPACK_IMPORTED_MODULE_9__["default"], {
              storageKey: "groupinput:latest",
              itemKey: group.id,
              onCreate: this.handleNoteCreate,
              busy: this.state.createBusy,
              error: this.state.error,
              errorJSON: this.state.errorJSON,
              ...noteProps
            }, this.state.inputId)
          }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsx)(sentry_utils_teams__WEBPACK_IMPORTED_MODULE_19__["default"], {
            ids: lodash_uniq__WEBPACK_IMPORTED_MODULE_3___default()(group.activity.filter(item => {
              var _item$data$assignee;

              return item.type === sentry_types__WEBPACK_IMPORTED_MODULE_17__.GroupActivityType.ASSIGNED && item.data.assigneeType === 'team' && ((_item$data$assignee = item.data.assignee) === null || _item$data$assignee === void 0 ? void 0 : _item$data$assignee.length) > 0;
            }).map(item => item.data.assignee)),
            children: _ref3 => {
              let {
                initiallyLoaded
              } = _ref3;
              return initiallyLoaded ? group.activity.map(item => {
                var _item$user;

                const authorName = item.user ? item.user.name : 'Sentry';

                if (item.type === sentry_types__WEBPACK_IMPORTED_MODULE_17__.GroupActivityType.NOTE) {
                  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsx)(sentry_components_errorBoundary__WEBPACK_IMPORTED_MODULE_10__["default"], {
                    mini: true,
                    children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsx)(sentry_components_activity_note__WEBPACK_IMPORTED_MODULE_8__["default"], {
                      showTime: false,
                      text: item.data.text,
                      modelId: item.id,
                      user: item.user,
                      dateCreated: item.dateCreated,
                      authorName: authorName,
                      onDelete: this.handleNoteDelete,
                      onUpdate: this.handleNoteUpdate,
                      ...noteProps
                    })
                  }, `note-${item.id}`);
                }

                return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsx)(sentry_components_errorBoundary__WEBPACK_IMPORTED_MODULE_10__["default"], {
                  mini: true,
                  children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsx)(sentry_components_activity_item__WEBPACK_IMPORTED_MODULE_7__["default"], {
                    author: {
                      type: item.user ? 'user' : 'system',
                      user: (_item$user = item.user) !== null && _item$user !== void 0 ? _item$user : undefined
                    },
                    date: item.dateCreated,
                    header: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsx)(_groupActivityItem__WEBPACK_IMPORTED_MODULE_22__["default"], {
                      author: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsx)(sentry_components_activity_author__WEBPACK_IMPORTED_MODULE_6__["default"], {
                        children: authorName
                      }),
                      activity: item,
                      orgSlug: this.props.params.orgId,
                      projectId: group.project.id
                    })
                  })
                }, `item-${item.id}`);
              }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_24__.jsx)(sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_12__["default"], {});
            }
          })]
        })
      })]
    });
  }

}

GroupActivity.displayName = "GroupActivity";

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withApi__WEBPACK_IMPORTED_MODULE_20__["default"])((0,sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_21__["default"])(GroupActivity)));

/***/ }),

/***/ "./app/views/organizationGroupDetails/groupActivityItem.tsx":
/*!******************************************************************!*\
  !*** ./app/views/organizationGroupDetails/groupActivityItem.tsx ***!
  \******************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var moment__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! moment */ "../node_modules/moment/moment.js");
/* harmony import */ var moment__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(moment__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var sentry_components_commitLink__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/commitLink */ "./app/components/commitLink.tsx");
/* harmony import */ var sentry_components_duration__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/duration */ "./app/components/duration.tsx");
/* harmony import */ var sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/links/externalLink */ "./app/components/links/externalLink.tsx");
/* harmony import */ var sentry_components_links_link__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/links/link */ "./app/components/links/link.tsx");
/* harmony import */ var sentry_components_pullRequestLink__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/pullRequestLink */ "./app/components/pullRequestLink.tsx");
/* harmony import */ var sentry_components_version__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/version */ "./app/components/version.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_stores_teamStore__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/stores/teamStore */ "./app/stores/teamStore.tsx");
/* harmony import */ var sentry_types__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/types */ "./app/types/index.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");













function GroupActivityItem(_ref) {
  let {
    activity,
    orgSlug,
    projectId,
    author
  } = _ref;
  const issuesLink = `/organizations/${orgSlug}/issues/`;

  function getIgnoredMessage(data) {
    if (data.ignoreDuration) {
      return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.tct)('[author] ignored this issue for [duration]', {
        author,
        duration: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_components_duration__WEBPACK_IMPORTED_MODULE_3__["default"], {
          seconds: data.ignoreDuration * 60
        })
      });
    }

    if (data.ignoreCount && data.ignoreWindow) {
      return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.tct)('[author] ignored this issue until it happens [count] time(s) in [duration]', {
        author,
        count: data.ignoreCount,
        duration: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_components_duration__WEBPACK_IMPORTED_MODULE_3__["default"], {
          seconds: data.ignoreWindow * 60
        })
      });
    }

    if (data.ignoreCount) {
      return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.tct)('[author] ignored this issue until it happens [count] time(s)', {
        author,
        count: data.ignoreCount
      });
    }

    if (data.ignoreUserCount && data.ignoreUserWindow) {
      return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.tct)('[author] ignored this issue until it affects [count] user(s) in [duration]', {
        author,
        count: data.ignoreUserCount,
        duration: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_components_duration__WEBPACK_IMPORTED_MODULE_3__["default"], {
          seconds: data.ignoreUserWindow * 60
        })
      });
    }

    if (data.ignoreUserCount) {
      return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.tct)('[author] ignored this issue until it affects [count] user(s)', {
        author,
        count: data.ignoreUserCount
      });
    }

    return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.tct)('[author] ignored this issue', {
      author
    });
  }

  function getAssignedMessage(data) {
    let assignee = undefined;

    if (data.assigneeType === 'team') {
      const team = sentry_stores_teamStore__WEBPACK_IMPORTED_MODULE_9__["default"].getById(data.assignee);
      assignee = team ? team.slug : '<unknown-team>';
      return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.tct)('[author] assigned this issue to #[assignee]', {
        author,
        assignee
      });
    }

    if (activity.user && data.assignee === activity.user.id) {
      return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.tct)('[author] assigned this issue to themselves', {
        author
      });
    }

    if (data.assigneeType === 'user' && data.assigneeEmail) {
      return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.tct)('[author] assigned this issue to [assignee]', {
        author,
        assignee: data.assigneeEmail
      });
    }

    return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.tct)('[author] assigned this issue to an unknown user', {
      author
    });
  }

  function renderContent() {
    var _activity$data$commit;

    switch (activity.type) {
      case sentry_types__WEBPACK_IMPORTED_MODULE_10__.GroupActivityType.NOTE:
        return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.tct)('[author] left a comment', {
          author
        });

      case sentry_types__WEBPACK_IMPORTED_MODULE_10__.GroupActivityType.SET_RESOLVED:
        return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.tct)('[author] marked this issue as resolved', {
          author
        });

      case sentry_types__WEBPACK_IMPORTED_MODULE_10__.GroupActivityType.SET_RESOLVED_BY_AGE:
        return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.tct)('[author] marked this issue as resolved due to inactivity', {
          author
        });

      case sentry_types__WEBPACK_IMPORTED_MODULE_10__.GroupActivityType.SET_RESOLVED_IN_RELEASE:
        const {
          current_release_version,
          version
        } = activity.data;

        if (current_release_version) {
          return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.tct)('[author] marked this issue as resolved in releases greater than [version]', {
            author,
            version: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_components_version__WEBPACK_IMPORTED_MODULE_7__["default"], {
              version: current_release_version,
              projectId: projectId,
              tooltipRawVersion: true
            })
          });
        }

        return version ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.tct)('[author] marked this issue as resolved in [version]', {
          author,
          version: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_components_version__WEBPACK_IMPORTED_MODULE_7__["default"], {
            version: version,
            projectId: projectId,
            tooltipRawVersion: true
          })
        }) : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.tct)('[author] marked this issue as resolved in the upcoming release', {
          author
        });

      case sentry_types__WEBPACK_IMPORTED_MODULE_10__.GroupActivityType.SET_RESOLVED_IN_COMMIT:
        const deployedReleases = (((_activity$data$commit = activity.data.commit) === null || _activity$data$commit === void 0 ? void 0 : _activity$data$commit.releases) || []).filter(r => r.dateReleased !== null).sort((a, b) => moment__WEBPACK_IMPORTED_MODULE_1___default()(a.dateReleased).valueOf() - moment__WEBPACK_IMPORTED_MODULE_1___default()(b.dateReleased).valueOf());

        if (deployedReleases.length === 1) {
          return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.tct)('[author] marked this issue as resolved in [version] [break]' + 'This commit was released in [release]', {
            author,
            version: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_components_commitLink__WEBPACK_IMPORTED_MODULE_2__["default"], {
              inline: true,
              commitId: activity.data.commit.id,
              repository: activity.data.commit.repository
            }),
            break: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)("br", {}),
            release: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_components_version__WEBPACK_IMPORTED_MODULE_7__["default"], {
              version: deployedReleases[0].version,
              projectId: projectId,
              tooltipRawVersion: true
            })
          });
        }

        if (deployedReleases.length > 1) {
          return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.tct)('[author] marked this issue as resolved in [version] [break]' + 'This commit was released in [release] and ' + (deployedReleases.length - 1) + ' others', {
            author,
            version: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_components_commitLink__WEBPACK_IMPORTED_MODULE_2__["default"], {
              inline: true,
              commitId: activity.data.commit.id,
              repository: activity.data.commit.repository
            }),
            break: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)("br", {}),
            release: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_components_version__WEBPACK_IMPORTED_MODULE_7__["default"], {
              version: deployedReleases[0].version,
              projectId: projectId,
              tooltipRawVersion: true
            })
          });
        }

        return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.tct)('[author] marked this issue as resolved in [version]', {
          author,
          version: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_components_commitLink__WEBPACK_IMPORTED_MODULE_2__["default"], {
            inline: true,
            commitId: activity.data.commit.id,
            repository: activity.data.commit.repository
          })
        });

      case sentry_types__WEBPACK_IMPORTED_MODULE_10__.GroupActivityType.SET_RESOLVED_IN_PULL_REQUEST:
        {
          const {
            data
          } = activity;
          const {
            pullRequest
          } = data;
          return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.tct)('[author] marked this issue as resolved in [version]', {
            author,
            version: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_components_pullRequestLink__WEBPACK_IMPORTED_MODULE_6__["default"], {
              inline: true,
              pullRequest: pullRequest,
              repository: pullRequest.repository
            })
          });
        }

      case sentry_types__WEBPACK_IMPORTED_MODULE_10__.GroupActivityType.SET_UNRESOLVED:
        return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.tct)('[author] marked this issue as unresolved', {
          author
        });

      case sentry_types__WEBPACK_IMPORTED_MODULE_10__.GroupActivityType.SET_IGNORED:
        {
          const {
            data
          } = activity;
          return getIgnoredMessage(data);
        }

      case sentry_types__WEBPACK_IMPORTED_MODULE_10__.GroupActivityType.SET_PUBLIC:
        return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.tct)('[author] made this issue public', {
          author
        });

      case sentry_types__WEBPACK_IMPORTED_MODULE_10__.GroupActivityType.SET_PRIVATE:
        return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.tct)('[author] made this issue private', {
          author
        });

      case sentry_types__WEBPACK_IMPORTED_MODULE_10__.GroupActivityType.SET_REGRESSION:
        {
          const {
            data
          } = activity;
          return data.version ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.tct)('[author] marked this issue as a regression in [version]', {
            author,
            version: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_components_version__WEBPACK_IMPORTED_MODULE_7__["default"], {
              version: data.version,
              projectId: projectId,
              tooltipRawVersion: true
            })
          }) : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.tct)('[author] marked this issue as a regression', {
            author
          });
        }

      case sentry_types__WEBPACK_IMPORTED_MODULE_10__.GroupActivityType.CREATE_ISSUE:
        {
          const {
            data
          } = activity;
          return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.tct)('[author] created an issue on [provider] titled [title]', {
            author,
            provider: data.provider,
            title: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_components_links_externalLink__WEBPACK_IMPORTED_MODULE_4__["default"], {
              href: data.location,
              children: data.title
            })
          });
        }

      case sentry_types__WEBPACK_IMPORTED_MODULE_10__.GroupActivityType.UNMERGE_SOURCE:
        {
          const {
            data
          } = activity;
          const {
            destination,
            fingerprints
          } = data;
          return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.tn)('%2$s migrated %1$s fingerprint to %3$s', '%2$s migrated %1$s fingerprints to %3$s', fingerprints.length, author, destination ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_components_links_link__WEBPACK_IMPORTED_MODULE_5__["default"], {
            to: `${issuesLink}${destination.id}`,
            children: destination.shortId
          }) : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('a group'));
        }

      case sentry_types__WEBPACK_IMPORTED_MODULE_10__.GroupActivityType.UNMERGE_DESTINATION:
        {
          const {
            data
          } = activity;
          const {
            source,
            fingerprints
          } = data;
          return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.tn)('%2$s migrated %1$s fingerprint from %3$s', '%2$s migrated %1$s fingerprints from %3$s', fingerprints.length, author, source ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_components_links_link__WEBPACK_IMPORTED_MODULE_5__["default"], {
            to: `${issuesLink}${source.id}`,
            children: source.shortId
          }) : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.t)('a group'));
        }

      case sentry_types__WEBPACK_IMPORTED_MODULE_10__.GroupActivityType.FIRST_SEEN:
        return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.tct)('[author] first saw this issue', {
          author
        });

      case sentry_types__WEBPACK_IMPORTED_MODULE_10__.GroupActivityType.ASSIGNED:
        {
          const {
            data
          } = activity;
          return getAssignedMessage(data);
        }

      case sentry_types__WEBPACK_IMPORTED_MODULE_10__.GroupActivityType.UNASSIGNED:
        return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.tct)('[author] unassigned this issue', {
          author
        });

      case sentry_types__WEBPACK_IMPORTED_MODULE_10__.GroupActivityType.MERGE:
        return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.tn)('%2$s merged %1$s issue into this issue', '%2$s merged %1$s issues into this issue', activity.data.issues.length, author);

      case sentry_types__WEBPACK_IMPORTED_MODULE_10__.GroupActivityType.REPROCESS:
        {
          const {
            data
          } = activity;
          const {
            oldGroupId,
            eventCount
          } = data;
          return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.tct)('[author] reprocessed the events in this issue. [new-events]', {
            author,
            ['new-events']: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(sentry_components_links_link__WEBPACK_IMPORTED_MODULE_5__["default"], {
              to: `/organizations/${orgSlug}/issues/?query=reprocessing.original_issue_id:${oldGroupId}`,
              children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.tn)('See %s new event', 'See %s new events', eventCount)
            })
          });
        }

      case sentry_types__WEBPACK_IMPORTED_MODULE_10__.GroupActivityType.MARK_REVIEWED:
        {
          return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_8__.tct)('[author] marked this issue as reviewed', {
            author
          });
        }

      default:
        return '';
      // should never hit (?)
    }
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(react__WEBPACK_IMPORTED_MODULE_0__.Fragment, {
    children: renderContent()
  });
}

GroupActivityItem.displayName = "GroupActivityItem";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (GroupActivityItem);

/***/ }),

/***/ "./app/views/organizationGroupDetails/utils.tsx":
/*!******************************************************!*\
  !*** ./app/views/organizationGroupDetails/utils.tsx ***!
  \******************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "ReprocessingStatus": () => (/* binding */ ReprocessingStatus),
/* harmony export */   "fetchGroupEvent": () => (/* binding */ fetchGroupEvent),
/* harmony export */   "fetchGroupUserReports": () => (/* binding */ fetchGroupUserReports),
/* harmony export */   "getEventEnvironment": () => (/* binding */ getEventEnvironment),
/* harmony export */   "getGroupMostRecentActivity": () => (/* binding */ getGroupMostRecentActivity),
/* harmony export */   "getGroupReprocessingStatus": () => (/* binding */ getGroupReprocessingStatus),
/* harmony export */   "getSubscriptionReason": () => (/* binding */ getSubscriptionReason),
/* harmony export */   "markEventSeen": () => (/* binding */ markEventSeen)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var lodash_orderBy__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! lodash/orderBy */ "../node_modules/lodash/orderBy.js");
/* harmony import */ var lodash_orderBy__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(lodash_orderBy__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var sentry_actionCreators_group__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/actionCreators/group */ "./app/actionCreators/group.tsx");
/* harmony import */ var sentry_api__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/api */ "./app/api.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");







/**
 * Fetches group data and mark as seen
 *
 * @param orgId organization slug
 * @param groupId groupId
 * @param eventId eventId or "latest" or "oldest"
 * @param envNames
 * @param projectId project slug required for eventId that is not latest or oldest
 */
async function fetchGroupEvent(api, orgId, groupId, eventId, envNames, projectId) {
  const url = eventId === 'latest' || eventId === 'oldest' ? `/issues/${groupId}/events/${eventId}/` : `/projects/${orgId}/${projectId}/events/${eventId}/`;
  const query = {};

  if (envNames.length !== 0) {
    query.environment = envNames;
  }

  const data = await api.requestPromise(url, {
    query
  });
  return data;
}
function markEventSeen(api, orgId, projectId, groupId) {
  (0,sentry_actionCreators_group__WEBPACK_IMPORTED_MODULE_2__.bulkUpdate)(api, {
    orgId,
    projectId,
    itemIds: [groupId],
    failSilently: true,
    data: {
      hasSeen: true
    }
  }, {});
}
function fetchGroupUserReports(groupId, query) {
  const api = new sentry_api__WEBPACK_IMPORTED_MODULE_3__.Client();
  return api.requestPromise(`/issues/${groupId}/user-reports/`, {
    includeAllArgs: true,
    query
  });
}
/**
 * Returns the environment name for an event or null
 *
 * @param event
 */

function getEventEnvironment(event) {
  const tag = event.tags.find(_ref => {
    let {
      key
    } = _ref;
    return key === 'environment';
  });
  return tag ? tag.value : null;
}
const SUBSCRIPTION_REASONS = {
  commented: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)("You're receiving workflow notifications because you have commented on this issue."),
  assigned: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)("You're receiving workflow notifications because you were assigned to this issue."),
  bookmarked: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)("You're receiving workflow notifications because you have bookmarked this issue."),
  changed_status: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)("You're receiving workflow notifications because you have changed the status of this issue."),
  mentioned: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)("You're receiving workflow notifications because you have been mentioned in this issue.")
};
/**
 * @param group
 * @param removeLinks add/remove links to subscription reasons text (default: false)
 * @returns Reason for subscription
 */

function getSubscriptionReason(group) {
  let removeLinks = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;

  if (group.subscriptionDetails && group.subscriptionDetails.disabled) {
    return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.tct)('You have [link:disabled workflow notifications] for this project.', {
      link: removeLinks ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)("span", {}) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)("a", {
        href: "/account/settings/notifications/"
      })
    });
  }

  if (!group.isSubscribed) {
    return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)('Subscribe to workflow notifications for this issue');
  }

  if (group.subscriptionDetails) {
    const {
      reason
    } = group.subscriptionDetails;

    if (reason === 'unknown') {
      return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.t)("You're receiving workflow notifications because you are subscribed to this issue.");
    }

    if (reason && SUBSCRIPTION_REASONS.hasOwnProperty(reason)) {
      return SUBSCRIPTION_REASONS[reason];
    }
  }

  return (0,sentry_locale__WEBPACK_IMPORTED_MODULE_4__.tct)("You're receiving updates because you are [link:subscribed to workflow notifications] for this project.", {
    link: removeLinks ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)("span", {}) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx)("a", {
      href: "/account/settings/notifications/"
    })
  });
}
function getGroupMostRecentActivity(activities) {
  // Most recent activity
  return lodash_orderBy__WEBPACK_IMPORTED_MODULE_1___default()([...activities], _ref2 => {
    let {
      dateCreated
    } = _ref2;
    return new Date(dateCreated);
  }, ['desc'])[0];
}
let ReprocessingStatus; // Reprocessing Checks

(function (ReprocessingStatus) {
  ReprocessingStatus["REPROCESSED_AND_HASNT_EVENT"] = "reprocessed_and_hasnt_event";
  ReprocessingStatus["REPROCESSED_AND_HAS_EVENT"] = "reprocessed_and_has_event";
  ReprocessingStatus["REPROCESSING"] = "reprocessing";
  ReprocessingStatus["NO_STATUS"] = "no_status";
})(ReprocessingStatus || (ReprocessingStatus = {}));

function getGroupReprocessingStatus(group, mostRecentActivity) {
  const {
    status,
    count,
    activity: activities
  } = group;
  const groupCount = Number(count);

  switch (status) {
    case 'reprocessing':
      return ReprocessingStatus.REPROCESSING;

    case 'unresolved':
      {
        const groupMostRecentActivity = mostRecentActivity !== null && mostRecentActivity !== void 0 ? mostRecentActivity : getGroupMostRecentActivity(activities);

        if ((groupMostRecentActivity === null || groupMostRecentActivity === void 0 ? void 0 : groupMostRecentActivity.type) === 'reprocess') {
          if (groupCount === 0) {
            return ReprocessingStatus.REPROCESSED_AND_HASNT_EVENT;
          }

          return ReprocessingStatus.REPROCESSED_AND_HAS_EVENT;
        }

        return ReprocessingStatus.NO_STATUS;
      }

    default:
      return ReprocessingStatus.NO_STATUS;
  }
}

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_views_organizationGroupDetails_groupActivity_tsx.0a3dd30124b3010cc495427ab3968e1c.js.map