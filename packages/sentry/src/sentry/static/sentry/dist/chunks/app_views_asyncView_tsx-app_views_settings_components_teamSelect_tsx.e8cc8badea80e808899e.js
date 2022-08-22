"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_views_asyncView_tsx-app_views_settings_components_teamSelect_tsx"],{

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

/***/ "./app/views/settings/components/teamSelect.tsx":
/*!******************************************************!*\
  !*** ./app/views/settings/components/teamSelect.tsx ***!
  \******************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var lodash_debounce__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! lodash/debounce */ "../node_modules/lodash/debounce.js");
/* harmony import */ var lodash_debounce__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(lodash_debounce__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_confirm__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/confirm */ "./app/components/confirm.tsx");
/* harmony import */ var sentry_components_dropdownAutoComplete__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/dropdownAutoComplete */ "./app/components/dropdownAutoComplete/index.tsx");
/* harmony import */ var sentry_components_dropdownButton__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/dropdownButton */ "./app/components/dropdownButton.tsx");
/* harmony import */ var sentry_components_idBadge_teamBadge__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/idBadge/teamBadge */ "./app/components/idBadge/teamBadge/index.tsx");
/* harmony import */ var sentry_components_links_link__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/links/link */ "./app/components/links/link.tsx");
/* harmony import */ var sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/loadingIndicator */ "./app/components/loadingIndicator.tsx");
/* harmony import */ var sentry_components_panels__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/panels */ "./app/components/panels/index.tsx");
/* harmony import */ var sentry_constants__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/constants */ "./app/constants/index.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_useTeams__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/utils/useTeams */ "./app/utils/useTeams.tsx");
/* harmony import */ var sentry_views_settings_components_emptyMessage__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/views/settings/components/emptyMessage */ "./app/views/settings/components/emptyMessage.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");



















function TeamSelect(_ref) {
  let {
    disabled,
    selectedTeams,
    menuHeader,
    organization,
    onAddTeam,
    onRemoveTeam,
    confirmLastTeamRemoveMessage,
    loadingTeams
  } = _ref;
  const {
    teams,
    onSearch,
    fetching
  } = (0,sentry_utils_useTeams__WEBPACK_IMPORTED_MODULE_14__["default"])();

  const handleAddTeam = option => {
    const team = teams.find(tm => tm.slug === option.value);

    if (team) {
      onAddTeam(team);
    }
  };

  const renderBody = () => {
    if (selectedTeams.length === 0) {
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_views_settings_components_emptyMessage__WEBPACK_IMPORTED_MODULE_15__["default"], {
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('No Teams assigned')
      });
    }

    const confirmMessage = selectedTeams.length === 1 && confirmLastTeamRemoveMessage ? confirmLastTeamRemoveMessage : null;
    return selectedTeams.map(team => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(TeamRow, {
      orgId: organization.slug,
      team: team,
      onRemove: slug => onRemoveTeam(slug),
      disabled: disabled,
      confirmMessage: confirmMessage
    }, team.slug));
  }; // Only show options that aren't selected in the dropdown


  const options = teams.filter(team => !selectedTeams.some(selectedTeam => selectedTeam.slug === team.slug)).map((team, index) => ({
    index,
    value: team.slug,
    searchKey: team.slug,
    label: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(DropdownTeamBadge, {
      avatarSize: 18,
      team: team
    })
  }));
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsxs)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_9__.Panel, {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsxs)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_9__.PanelHeader, {
      hasButtons: true,
      children: [(0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Team'), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_components_dropdownAutoComplete__WEBPACK_IMPORTED_MODULE_4__["default"], {
        items: options,
        busyItemsStillVisible: fetching,
        onChange: lodash_debounce__WEBPACK_IMPORTED_MODULE_1___default()(e => onSearch(e.target.value), sentry_constants__WEBPACK_IMPORTED_MODULE_10__.DEFAULT_DEBOUNCE_DURATION),
        onSelect: handleAddTeam,
        emptyMessage: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('No teams'),
        menuHeader: menuHeader,
        disabled: disabled,
        alignMenu: "right",
        children: _ref2 => {
          let {
            isOpen
          } = _ref2;
          return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_components_dropdownButton__WEBPACK_IMPORTED_MODULE_5__["default"], {
            "aria-label": (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Add Team'),
            isOpen: isOpen,
            size: "xs",
            disabled: disabled,
            children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Add Team')
          });
        }
      })]
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_components_panels__WEBPACK_IMPORTED_MODULE_9__.PanelBody, {
      children: loadingTeams ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_components_loadingIndicator__WEBPACK_IMPORTED_MODULE_8__["default"], {}) : renderBody()
    })]
  });
}

TeamSelect.displayName = "TeamSelect";

const TeamRow = _ref3 => {
  let {
    orgId,
    team,
    onRemove,
    disabled,
    confirmMessage
  } = _ref3;
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsxs)(TeamPanelItem, {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(StyledLink, {
      to: `/settings/${orgId}/teams/${team.slug}/`,
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_components_idBadge_teamBadge__WEBPACK_IMPORTED_MODULE_6__.TeamBadge, {
        team: team
      })
    }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_components_confirm__WEBPACK_IMPORTED_MODULE_3__["default"], {
      message: confirmMessage,
      bypass: !confirmMessage,
      onConfirm: () => onRemove(team.slug),
      disabled: disabled,
      children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_components_button__WEBPACK_IMPORTED_MODULE_2__["default"], {
        size: "xs",
        icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_16__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_11__.IconSubtract, {
          isCircled: true,
          size: "xs"
        }),
        disabled: disabled,
        children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Remove')
      })
    })]
  });
};

TeamRow.displayName = "TeamRow";

const DropdownTeamBadge = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_idBadge_teamBadge__WEBPACK_IMPORTED_MODULE_6__.TeamBadge,  true ? {
  target: "e1u21fi92"
} : 0)("font-weight:normal;font-size:", p => p.theme.fontSizeMedium, ";text-transform:none;" + ( true ? "" : 0));

const TeamPanelItem = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_panels__WEBPACK_IMPORTED_MODULE_9__.PanelItem,  true ? {
  target: "e1u21fi91"
} : 0)("padding:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_13__["default"])(2), ";align-items:center;" + ( true ? "" : 0));

const StyledLink = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_links_link__WEBPACK_IMPORTED_MODULE_7__["default"],  true ? {
  target: "e1u21fi90"
} : 0)("flex:1;margin-right:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_13__["default"])(1), ";" + ( true ? "" : 0));

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (TeamSelect);

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_views_asyncView_tsx-app_views_settings_components_teamSelect_tsx.1de5489729a2d85a1faa4dec63f17b5e.js.map