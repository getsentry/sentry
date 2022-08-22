"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_components_tagDistributionMeter_tsx"],{

/***/ "./app/components/tagDistributionMeter.tsx":
/*!*************************************************!*\
  !*** ./app/components/tagDistributionMeter.tsx ***!
  \*************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @emotion/styled/base */ "../node_modules/@emotion/styled/base/dist/emotion-styled-base.browser.esm.js");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var _emotion_is_prop_valid__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @emotion/is-prop-valid */ "../node_modules/@emotion/is-prop-valid/dist/is-prop-valid.browser.esm.js");
/* harmony import */ var sentry_components_links_link__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/components/links/link */ "./app/components/links/link.tsx");
/* harmony import */ var sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! sentry/components/tooltip */ "./app/components/tooltip.tsx");
/* harmony import */ var sentry_components_version__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/components/version */ "./app/components/version.tsx");
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var sentry_styles_space__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/styles/space */ "./app/styles/space.tsx");
/* harmony import */ var sentry_utils__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/utils */ "./app/utils.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");












function TagDistributionMeter(_ref) {
  let {
    isLoading = false,
    hasError = false,
    renderLoading = () => null,
    renderEmpty = () => (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)("p", {
      children: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('No recent data.')
    }),
    renderError = () => null,
    showReleasePackage = false,
    segments,
    title,
    totalValues,
    onTagClick
  } = _ref;

  function renderTitle() {
    if (!Array.isArray(segments) || segments.length <= 0) {
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(Title, {
        children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(TitleType, {
          children: title
        })
      });
    }

    const largestSegment = segments[0];
    const pct = (0,sentry_utils__WEBPACK_IMPORTED_MODULE_8__.percent)(largestSegment.count, totalValues);
    const pctLabel = Math.floor(pct);

    const renderLabel = () => {
      switch (title) {
        case 'release':
          return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(Label, {
            children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(sentry_components_version__WEBPACK_IMPORTED_MODULE_5__["default"], {
              version: largestSegment.name,
              anchor: false,
              tooltipRawVersion: true,
              withPackage: showReleasePackage,
              truncate: true
            })
          });

        default:
          return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(Label, {
            children: largestSegment.name || (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('n/a')
          });
      }
    };

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsxs)(Title, {
      children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(TitleType, {
        children: title
      }), (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsxs)(TitleDescription, {
        children: [renderLabel(), isLoading || hasError ? null : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsxs)(Percent, {
          children: [pctLabel, "%"]
        })]
      })]
    });
  }

  function renderSegments() {
    if (isLoading) {
      return renderLoading();
    }

    if (hasError) {
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(SegmentBar, {
        children: renderError()
      });
    }

    if (totalValues === 0) {
      return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(SegmentBar, {
        children: renderEmpty()
      });
    }

    return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(SegmentBar, {
      children: segments.map((value, index) => {
        const pct = (0,sentry_utils__WEBPACK_IMPORTED_MODULE_8__.percent)(value.count, totalValues);
        const pctLabel = Math.floor(pct);

        const renderTooltipValue = () => {
          switch (title) {
            case 'release':
              return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(sentry_components_version__WEBPACK_IMPORTED_MODULE_5__["default"], {
                version: value.name,
                anchor: false,
                withPackage: showReleasePackage
              });

            default:
              return value.name || (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('n/a');
          }
        };

        const tooltipHtml = (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsxs)(react__WEBPACK_IMPORTED_MODULE_1__.Fragment, {
          children: [(0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)("div", {
            className: "truncate",
            children: renderTooltipValue()
          }), pctLabel, "%"]
        });

        const segmentProps = {
          index,
          to: value.url,
          onClick: () => onTagClick === null || onTagClick === void 0 ? void 0 : onTagClick(title, value)
        };
        return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)("div", {
          "data-test-id": `tag-${title}-segment-${value.value}`,
          style: {
            width: pct + '%'
          },
          children: (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(sentry_components_tooltip__WEBPACK_IMPORTED_MODULE_4__["default"], {
            title: tooltipHtml,
            containerDisplayMode: "block",
            children: value.isOther ? (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(OtherSegment, {
              "aria-label": (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Other')
            }) : (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx)(Segment, {
              "aria-label": (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Add the %s segment tag to the search query', value.value),
              ...segmentProps
            })
          })
        }, value.value);
      })
    });
  }

  const totalVisible = segments.reduce((sum, value) => sum + value.count, 0);
  const hasOther = totalVisible < totalValues;

  if (hasOther) {
    segments.push({
      isOther: true,
      name: (0,sentry_locale__WEBPACK_IMPORTED_MODULE_6__.t)('Other'),
      value: 'other',
      count: totalValues - totalVisible,
      url: ''
    });
  }

  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsxs)(TagSummary, {
    children: [renderTitle(), renderSegments()]
  });
}

TagDistributionMeter.displayName = "TagDistributionMeter";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (TagDistributionMeter);
const COLORS = ['#3A3387', '#5F40A3', '#8C4FBD', '#B961D3', '#DE76E4', '#EF91E8', '#F7B2EC', '#FCD8F4', '#FEEBF9'];

const TagSummary = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "efzk5f18"
} : 0)("margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_7__["default"])(1), ";" + ( true ? "" : 0));

const SegmentBar = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "efzk5f17"
} : 0)("display:flex;overflow:hidden;border-radius:", p => p.theme.borderRadius, ";" + ( true ? "" : 0));

const Title = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "efzk5f16"
} : 0)("display:flex;font-size:", p => p.theme.fontSizeSmall, ";justify-content:space-between;margin-bottom:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_7__["default"])(0.25), ";line-height:1.1;" + ( true ? "" : 0));

const TitleType = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "efzk5f15"
} : 0)("color:", p => p.theme.textColor, ";font-weight:bold;", p => p.theme.overflowEllipsis, ";" + ( true ? "" : 0));

const TitleDescription = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "efzk5f14"
} : 0)("display:flex;color:", p => p.theme.gray300, ";text-align:right;" + ( true ? "" : 0));

const Label = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "efzk5f13"
} : 0)(p => p.theme.overflowEllipsis, ";max-width:150px;" + ( true ? "" : 0));

const Percent = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('div',  true ? {
  target: "efzk5f12"
} : 0)("font-weight:bold;font-variant-numeric:tabular-nums;padding-left:", (0,sentry_styles_space__WEBPACK_IMPORTED_MODULE_7__["default"])(0.5), ";color:", p => p.theme.textColor, ";" + ( true ? "" : 0));

const OtherSegment = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])('span',  true ? {
  target: "efzk5f11"
} : 0)("display:block;width:100%;height:16px;color:inherit;outline:none;background-color:", COLORS[COLORS.length - 1], ";" + ( true ? "" : 0));

const Segment = /*#__PURE__*/(0,_emotion_styled_base__WEBPACK_IMPORTED_MODULE_0__["default"])(sentry_components_links_link__WEBPACK_IMPORTED_MODULE_3__["default"],  true ? {
  shouldForwardProp: _emotion_is_prop_valid__WEBPACK_IMPORTED_MODULE_2__["default"],
  target: "efzk5f10"
} : 0)("display:block;width:100%;height:16px;color:inherit;outline:none;background-color:", p => COLORS[p.index], ";border-radius:0;" + ( true ? "" : 0));

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_components_tagDistributionMeter_tsx.35684fbef31523c6f9df4e20c8db61f3.js.map