"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_components_forms_teamSelector_tsx"],{

/***/ "./app/components/forms/teamSelector.tsx":
/*!***********************************************!*\
  !*** ./app/components/forms/teamSelector.tsx ***!
  \***********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "TeamSelector": () => (/* binding */ TeamSelector),
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var lodash_debounce__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! lodash/debounce */ "../node_modules/lodash/debounce.js");
/* harmony import */ var lodash_debounce__WEBPACK_IMPORTED_MODULE_4___default = /*#__PURE__*/__webpack_require__.n(lodash_debounce__WEBPACK_IMPORTED_MODULE_4__);
/* harmony import */ var sentry_actionCreators_projects__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/actionCreators/projects */ "./app/actionCreators/projects.tsx");
/* harmony import */ var sentry_components_button__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/components/button */ "./app/components/button.tsx");
/* harmony import */ var sentry_components_forms_selectControl__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/components/forms/selectControl */ "./app/components/forms/selectControl.tsx");
/* harmony import */ var sentry_components_idBadge__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/components/idBadge */ "./app/components/idBadge/index.tsx");
/* harmony import */ var sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/components/tooltip */ "./app/components/tooltip.tsx");
/* harmony import */ var sentry_constants__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! sentry/constants */ "./app/constants/index.tsx");
/* harmony import */ var sentry_icons__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! sentry/icons */ "./app/icons/index.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils_isActiveSuperuser__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sentry/utils/isActiveSuperuser */ "./app/utils/isActiveSuperuser.tsx");
/* harmony import */ var sentry_utils_useApi__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! sentry/utils/useApi */ "./app/utils/useApi.tsx");
/* harmony import */ var sentry_utils_useTeams__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! sentry/utils/useTeams */ "./app/utils/useTeams.tsx");
/* harmony import */ var sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! sentry/utils/withOrganization */ "./app/utils/withOrganization.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");




function _EMOTION_STRINGIFIED_CSS_ERROR__() { return "You have tried to stringify object returned from `css` function. It isn't supposed to be used directly (e.g. as value of the `className` prop), but rather handed to emotion so it can handle it (e.g. as value of `css` prop)."; }



















const UnassignedWrapper = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "e1bme5452"
} : 0)( true ? {
  name: "s5xdrg",
  styles: "display:flex;align-items:center"
} : 0);

const StyledIconUser = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_icons__WEBPACK_IMPORTED_MODULE_11__.IconUser,  true ? {
  target: "e1bme5451"
} : 0)("margin-left:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_13__["default"])(0.25), ";margin-right:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_13__["default"])(1), ";color:", p => p.theme.gray400, ";" + ( true ? "" : 0)); // An option to be unassigned on the team dropdown


const unassignedOption = {
  value: null,
  label: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsxs)(UnassignedWrapper, {
    children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(StyledIconUser, {
      size: "20px"
    }), (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Unassigned')]
  }),
  searchKey: 'unassigned',
  actor: null,
  disabled: false
}; // Ensures that the svg icon is white when selected

const unassignedSelectStyles = {
  option: (provided, state) => ({ ...provided,
    svg: {
      color: state.isSelected && state.theme.white
    }
  })
};
const placeholderSelectStyles = {
  input: (provided, state) => ({ ...provided,
    display: 'grid',
    gridTemplateColumns: 'max-content 1fr',
    alignItems: 'center',
    gridGap: (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_13__["default"])(1),
    ':before': {
      backgroundColor: state.theme.backgroundSecondary,
      height: 24,
      width: 24,
      borderRadius: 3,
      content: '""',
      display: 'block'
    }
  }),
  placeholder: provided => ({ ...provided,
    paddingLeft: 32
  })
};

function TeamSelector(props) {
  const {
    includeUnassigned,
    styles,
    ...extraProps
  } = props;
  const {
    teamFilter,
    organization,
    project,
    multiple,
    value,
    useId,
    onChange
  } = props;
  const api = (0,sentry_utils_useApi__WEBPACK_IMPORTED_MODULE_15__["default"])();
  const {
    teams,
    fetching,
    onSearch
  } = (0,sentry_utils_useTeams__WEBPACK_IMPORTED_MODULE_16__["default"])(); // TODO(ts) This type could be improved when react-select types are better.

  const selectRef = (0,react__WEBPACK_IMPORTED_MODULE_3__.useRef)(null);

  const createTeamOption = team => ({
    value: useId ? team.id : team.slug,
    label: `#${team.slug}`,
    leadingItems: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(sentry_components_idBadge__WEBPACK_IMPORTED_MODULE_8__["default"], {
      team: team,
      hideName: true
    }),
    searchKey: team.slug,
    actor: {
      type: 'team',
      id: team.id,
      name: team.slug
    }
  });
  /**
   * Closes the select menu by blurring input if possible since that seems to
   * be the only way to close it.
   */


  function closeSelectMenu() {
    if (!selectRef.current) {
      return;
    }

    const select = selectRef.current.select;
    const input = select.inputRef;

    if (input) {
      // I don't think there's another way to close `react-select`
      input.blur();
    }
  }

  async function handleAddTeamToProject(team) {
    if (!project) {
      closeSelectMenu();
      return;
    } // Copy old value


    const oldValue = multiple ? [...(value !== null && value !== void 0 ? value : [])] : {
      value
    }; // Optimistic update

    onChange === null || onChange === void 0 ? void 0 : onChange(createTeamOption(team));

    try {
      await (0,sentry_actionCreators_projects__WEBPACK_IMPORTED_MODULE_5__.addTeamToProject)(api, organization.slug, project.slug, team);
    } catch (err) {
      // Unable to add team to project, revert select menu value
      onChange === null || onChange === void 0 ? void 0 : onChange(oldValue);
    }

    closeSelectMenu();
  }

  function createTeamOutsideProjectOption(team) {
    // If the option/team is currently selected, optimistically assume it is now a part of the project
    if (value === (useId ? team.id : team.slug)) {
      return createTeamOption(team);
    }

    const canAddTeam = organization.access.includes('project:write');
    return { ...createTeamOption(team),
      disabled: true,
      label: `#${team.slug}`,
      leadingItems: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(sentry_components_idBadge__WEBPACK_IMPORTED_MODULE_8__["default"], {
        team: team,
        hideName: true
      }),
      trailingItems: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_9__["default"], {
        title: canAddTeam ? (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Add %s to project', `#${team.slug}`) : (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('You do not have permission to add team to project.'),
        containerDisplayMode: "flex",
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(AddToProjectButton, {
          type: "button",
          size: "zero",
          borderless: true,
          disabled: !canAddTeam,
          onClick: () => handleAddTeamToProject(team),
          icon: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(sentry_icons__WEBPACK_IMPORTED_MODULE_11__.IconAdd, {
            isCircled: true
          }),
          "aria-label": (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('Add %s to project', `#${team.slug}`)
        })
      }),
      tooltip: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_12__.t)('%s is not a member of project', `#${team.slug}`)
    };
  }

  function getOptions() {
    const isSuperuser = (0,sentry_utils_isActiveSuperuser__WEBPACK_IMPORTED_MODULE_14__.isActiveSuperuser)();
    const filteredTeams = isSuperuser ? teams : teamFilter ? teams.filter(teamFilter) : teams;

    if (project) {
      const teamsInProjectIdSet = new Set(project.teams.map(team => team.id));
      const teamsInProject = filteredTeams.filter(team => teamsInProjectIdSet.has(team.id));
      const teamsNotInProject = filteredTeams.filter(team => !teamsInProjectIdSet.has(team.id));
      return [...teamsInProject.map(createTeamOption), ...teamsNotInProject.map(createTeamOutsideProjectOption), ...(includeUnassigned ? [unassignedOption] : [])];
    }

    return [...filteredTeams.map(createTeamOption), ...(includeUnassigned ? [unassignedOption] : [])];
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_18__.jsx)(sentry_components_forms_selectControl__WEBPACK_IMPORTED_MODULE_7__["default"], {
    ref: selectRef,
    options: getOptions(),
    onInputChange: lodash_debounce__WEBPACK_IMPORTED_MODULE_4___default()(val => void onSearch(val), sentry_constants__WEBPACK_IMPORTED_MODULE_10__.DEFAULT_DEBOUNCE_DURATION),
    getOptionValue: option => option.searchKey,
    styles: { ...(includeUnassigned ? unassignedSelectStyles : {}),
      ...(multiple ? {} : placeholderSelectStyles),
      ...(styles !== null && styles !== void 0 ? styles : {})
    },
    isLoading: fetching,
    ...extraProps
  });
}

TeamSelector.displayName = "TeamSelector";

const AddToProjectButton = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_button__WEBPACK_IMPORTED_MODULE_6__["default"],  true ? {
  target: "e1bme5450"
} : 0)( true ? {
  name: "ozd7xs",
  styles: "flex-shrink:0"
} : 0);

 // TODO(davidenwang): this is broken due to incorrect types on react-select

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,sentry_utils_withOrganization__WEBPACK_IMPORTED_MODULE_17__["default"])(TeamSelector));

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_components_forms_teamSelector_tsx.061f9d324cc46ea2d054a4eab27d1dea.js.map