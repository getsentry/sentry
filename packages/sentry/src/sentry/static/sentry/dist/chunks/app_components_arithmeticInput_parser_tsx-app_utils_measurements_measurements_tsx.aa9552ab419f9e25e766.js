"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_components_arithmeticInput_parser_tsx-app_utils_measurements_measurements_tsx"],{

/***/ "./app/components/arithmeticInput/parser.tsx":
/*!***************************************************!*\
  !*** ./app/components/arithmeticInput/parser.tsx ***!
  \***************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "Operation": () => (/* binding */ Operation),
/* harmony export */   "TokenConverter": () => (/* binding */ TokenConverter),
/* harmony export */   "parseArithmetic": () => (/* binding */ parseArithmetic)
/* harmony export */ });
/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "../node_modules/@babel/runtime/helpers/esm/defineProperty.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/es.error.cause.js */ "../node_modules/core-js/modules/es.error.cause.js");
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var sentry_locale__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sentry/locale */ "./app/locale.tsx");
/* harmony import */ var _grammar_pegjs__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ./grammar.pegjs */ "./app/components/arithmeticInput/grammar.pegjs");
/* harmony import */ var _grammar_pegjs__WEBPACK_IMPORTED_MODULE_4___default = /*#__PURE__*/__webpack_require__.n(_grammar_pegjs__WEBPACK_IMPORTED_MODULE_4__);




 // This constant should stay in sync with the backend parser

const MAX_OPERATORS = 10;
const MAX_OPERATOR_MESSAGE = (0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Maximum operators exceeded');
class Operation {
  constructor(_ref) {
    let {
      operator,
      lhs = null,
      rhs
    } = _ref;

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "operator", void 0);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "lhs", void 0);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "rhs", void 0);

    this.operator = operator;
    this.lhs = lhs;
    this.rhs = rhs;
  }

}

class Term {
  constructor(_ref2) {
    let {
      term,
      location
    } = _ref2;

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "term", void 0);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "location", void 0);

    this.term = term;
    this.location = location;
  }

}

class TokenConverter {
  constructor() {
    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "numOperations", void 0);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "errors", void 0);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "fields", void 0);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "functions", void 0);

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "tokenTerm", (maybeFactor, remainingAdds) => {
      if (remainingAdds.length > 0) {
        remainingAdds[0].lhs = maybeFactor;
        return flatten(remainingAdds);
      }

      return maybeFactor;
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "tokenOperation", (operator, rhs) => {
      this.numOperations += 1;

      if (this.numOperations > MAX_OPERATORS && !this.errors.includes(MAX_OPERATOR_MESSAGE)) {
        this.errors.push(MAX_OPERATOR_MESSAGE);
      }

      if (operator === 'divide' && rhs === '0') {
        this.errors.push((0,sentry_locale__WEBPACK_IMPORTED_MODULE_3__.t)('Division by 0 is not allowed'));
      }

      return new Operation({
        operator,
        rhs
      });
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "tokenFactor", (primary, remaining) => {
      remaining[0].lhs = primary;
      return flatten(remaining);
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "tokenField", (term, location) => {
      const field = new Term({
        term,
        location
      });
      this.fields.push(field);
      return term;
    });

    (0,_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_0__["default"])(this, "tokenFunction", (term, location) => {
      const func = new Term({
        term,
        location
      });
      this.functions.push(func);
      return term;
    });

    this.numOperations = 0;
    this.errors = [];
    this.fields = [];
    this.functions = [];
  }

} // Assumes an array with at least one element

function flatten(remaining) {
  let term = remaining.shift();

  while (remaining.length > 0) {
    const nextTerm = remaining.shift();

    if (nextTerm && term && nextTerm.lhs === null) {
      nextTerm.lhs = term;
    }

    term = nextTerm;
  } // Shouldn't happen, tokenTerm checks remaining and tokenFactor should have at least 1 item
  // This is just to help ts out


  if (term === undefined) {
    throw new Error('Unable to parse arithmetic');
  }

  return term;
}

function parseArithmetic(query) {
  const tc = new TokenConverter();

  try {
    const result = _grammar_pegjs__WEBPACK_IMPORTED_MODULE_4___default().parse(query, {
      tc
    });
    return {
      result,
      error: tc.errors[0],
      tc
    };
  } catch (error) {
    return {
      result: null,
      error: error.message,
      tc
    };
  }
}

/***/ }),

/***/ "./app/utils/measurements/measurements.tsx":
/*!*************************************************!*\
  !*** ./app/utils/measurements/measurements.tsx ***!
  \*************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__),
/* harmony export */   "getMeasurements": () => (/* binding */ getMeasurements)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "../node_modules/react/index.js");
/* harmony import */ var sentry_utils_performance_vitals_constants__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sentry/utils/performance/vitals/constants */ "./app/utils/performance/vitals/constants.tsx");
/* harmony import */ var _emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! @emotion/react/jsx-runtime */ "../node_modules/@emotion/react/jsx-runtime/dist/emotion-react-jsx-runtime.browser.esm.js");





function measurementsFromDetails(details) {
  return Object.fromEntries(Object.entries(details).map(_ref => {
    let [key, value] = _ref;
    const newValue = {
      name: value.name,
      key
    };
    return [key, newValue];
  }));
}

const MOBILE_MEASUREMENTS = measurementsFromDetails(sentry_utils_performance_vitals_constants__WEBPACK_IMPORTED_MODULE_2__.MOBILE_VITAL_DETAILS);
const WEB_MEASUREMENTS = measurementsFromDetails(sentry_utils_performance_vitals_constants__WEBPACK_IMPORTED_MODULE_2__.WEB_VITAL_DETAILS);
function getMeasurements() {
  return { ...WEB_MEASUREMENTS,
    ...MOBILE_MEASUREMENTS
  };
}

function Measurements(_ref2) {
  let {
    children
  } = _ref2;
  const measurements = getMeasurements();
  return (0,_emotion_react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(react__WEBPACK_IMPORTED_MODULE_1__.Fragment, {
    children: children({
      measurements
    })
  });
}

Measurements.displayName = "Measurements";
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (Measurements);

/***/ }),

/***/ "./app/components/arithmeticInput/grammar.pegjs":
/*!******************************************************!*\
  !*** ./app/components/arithmeticInput/grammar.pegjs ***!
  \******************************************************/
/***/ ((module) => {

/*
 * Generated by PEG.js 0.10.0.
 *
 * http://pegjs.org/
 */



function peg$subclass(child, parent) {
  function ctor() { this.constructor = child; }
  ctor.prototype = parent.prototype;
  child.prototype = new ctor();
}

function peg$SyntaxError(message, expected, found, location) {
  this.message  = message;
  this.expected = expected;
  this.found    = found;
  this.location = location;
  this.name     = "SyntaxError";

  if (typeof Error.captureStackTrace === "function") {
    Error.captureStackTrace(this, peg$SyntaxError);
  }
}

peg$subclass(peg$SyntaxError, Error);

peg$SyntaxError.buildMessage = function(expected, found) {
  var DESCRIBE_EXPECTATION_FNS = {
        literal: function(expectation) {
          return "\"" + literalEscape(expectation.text) + "\"";
        },

        "class": function(expectation) {
          var escapedParts = "",
              i;

          for (i = 0; i < expectation.parts.length; i++) {
            escapedParts += expectation.parts[i] instanceof Array
              ? classEscape(expectation.parts[i][0]) + "-" + classEscape(expectation.parts[i][1])
              : classEscape(expectation.parts[i]);
          }

          return "[" + (expectation.inverted ? "^" : "") + escapedParts + "]";
        },

        any: function(expectation) {
          return "any character";
        },

        end: function(expectation) {
          return "end of input";
        },

        other: function(expectation) {
          return expectation.description;
        }
      };

  function hex(ch) {
    return ch.charCodeAt(0).toString(16).toUpperCase();
  }

  function literalEscape(s) {
    return s
      .replace(/\\/g, '\\\\')
      .replace(/"/g,  '\\"')
      .replace(/\0/g, '\\0')
      .replace(/\t/g, '\\t')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/[\x00-\x0F]/g,          function(ch) { return '\\x0' + hex(ch); })
      .replace(/[\x10-\x1F\x7F-\x9F]/g, function(ch) { return '\\x'  + hex(ch); });
  }

  function classEscape(s) {
    return s
      .replace(/\\/g, '\\\\')
      .replace(/\]/g, '\\]')
      .replace(/\^/g, '\\^')
      .replace(/-/g,  '\\-')
      .replace(/\0/g, '\\0')
      .replace(/\t/g, '\\t')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/[\x00-\x0F]/g,          function(ch) { return '\\x0' + hex(ch); })
      .replace(/[\x10-\x1F\x7F-\x9F]/g, function(ch) { return '\\x'  + hex(ch); });
  }

  function describeExpectation(expectation) {
    return DESCRIBE_EXPECTATION_FNS[expectation.type](expectation);
  }

  function describeExpected(expected) {
    var descriptions = new Array(expected.length),
        i, j;

    for (i = 0; i < expected.length; i++) {
      descriptions[i] = describeExpectation(expected[i]);
    }

    descriptions.sort();

    if (descriptions.length > 0) {
      for (i = 1, j = 1; i < descriptions.length; i++) {
        if (descriptions[i - 1] !== descriptions[i]) {
          descriptions[j] = descriptions[i];
          j++;
        }
      }
      descriptions.length = j;
    }

    switch (descriptions.length) {
      case 1:
        return descriptions[0];

      case 2:
        return descriptions[0] + " or " + descriptions[1];

      default:
        return descriptions.slice(0, -1).join(", ")
          + ", or "
          + descriptions[descriptions.length - 1];
    }
  }

  function describeFound(found) {
    return found ? "\"" + literalEscape(found) + "\"" : "end of input";
  }

  return "Expected " + describeExpected(expected) + " but " + describeFound(found) + " found.";
};

function peg$parse(input, options) {
  options = options !== void 0 ? options : {};

  var peg$FAILED = {},

      peg$startRuleFunctions = { term: peg$parseterm },
      peg$startRuleFunction  = peg$parseterm,

      peg$c0 = function(maybeFactor, remainingAdds) {
          return tc.tokenTerm(maybeFactor, remainingAdds);
        },
      peg$c1 = function(operator, rhs) {
          return tc.tokenOperation(operator, rhs);
        },
      peg$c2 = function(term) {
          return term;
        },
      peg$c3 = function(primary, remaining) {
          return tc.tokenFactor(primary, remaining);
        },
      peg$c4 = function(operator) {
          return operator;
        },
      peg$c5 = function(primary) {
          return primary;
        },
      peg$c6 = "+",
      peg$c7 = peg$literalExpectation("+", false),
      peg$c8 = function() {
          return "plus";
        },
      peg$c9 = "-",
      peg$c10 = peg$literalExpectation("-", false),
      peg$c11 = function() {
          return "minus";
        },
      peg$c12 = "*",
      peg$c13 = peg$literalExpectation("*", false),
      peg$c14 = function() {
          return "multiply";
        },
      peg$c15 = /^[\/\xF7]/,
      peg$c16 = peg$classExpectation(["/", "\xF7"], false, false),
      peg$c17 = function() {
          return "divide";
        },
      peg$c18 = peg$otherExpectation("function"),
      peg$c19 = function() {
          return tc.tokenFunction(text(), location());
        },
      peg$c20 = peg$otherExpectation("number"),
      peg$c21 = /^[+\-]/,
      peg$c22 = peg$classExpectation(["+", "-"], false, false),
      peg$c23 = /^[0-9]/,
      peg$c24 = peg$classExpectation([["0", "9"]], false, false),
      peg$c25 = ".",
      peg$c26 = peg$literalExpectation(".", false),
      peg$c27 = function() {
          return text();
        },
      peg$c28 = peg$otherExpectation("field"),
      peg$c29 = /^[a-zA-Z_.]/,
      peg$c30 = peg$classExpectation([["a", "z"], ["A", "Z"], "_", "."], false, false),
      peg$c31 = function() {
          return tc.tokenField(text(), location());
        },
      peg$c32 = /^[^()\t\n, "]/,
      peg$c33 = peg$classExpectation(["(", ")", "\t", "\n", ",", " ", "\""], true, false),
      peg$c34 = "\"",
      peg$c35 = peg$literalExpectation("\"", false),
      peg$c36 = "\\\"",
      peg$c37 = peg$literalExpectation("\\\"", false),
      peg$c38 = /^[^\t\n"]/,
      peg$c39 = peg$classExpectation(["\t", "\n", "\""], true, false),
      peg$c40 = /^[a-zA-Z_0-9]/,
      peg$c41 = peg$classExpectation([["a", "z"], ["A", "Z"], "_", ["0", "9"]], false, false),
      peg$c42 = ",",
      peg$c43 = peg$literalExpectation(",", false),
      peg$c44 = "(",
      peg$c45 = peg$literalExpectation("(", false),
      peg$c46 = ")",
      peg$c47 = peg$literalExpectation(")", false),
      peg$c48 = " ",
      peg$c49 = peg$literalExpectation(" ", false),

      peg$currPos          = 0,
      peg$savedPos         = 0,
      peg$posDetailsCache  = [{ line: 1, column: 1 }],
      peg$maxFailPos       = 0,
      peg$maxFailExpected  = [],
      peg$silentFails      = 0,

      peg$result;

  if ("startRule" in options) {
    if (!(options.startRule in peg$startRuleFunctions)) {
      throw new Error("Can't start parsing from rule \"" + options.startRule + "\".");
    }

    peg$startRuleFunction = peg$startRuleFunctions[options.startRule];
  }

  function text() {
    return input.substring(peg$savedPos, peg$currPos);
  }

  function location() {
    return peg$computeLocation(peg$savedPos, peg$currPos);
  }

  function expected(description, location) {
    location = location !== void 0 ? location : peg$computeLocation(peg$savedPos, peg$currPos)

    throw peg$buildStructuredError(
      [peg$otherExpectation(description)],
      input.substring(peg$savedPos, peg$currPos),
      location
    );
  }

  function error(message, location) {
    location = location !== void 0 ? location : peg$computeLocation(peg$savedPos, peg$currPos)

    throw peg$buildSimpleError(message, location);
  }

  function peg$literalExpectation(text, ignoreCase) {
    return { type: "literal", text: text, ignoreCase: ignoreCase };
  }

  function peg$classExpectation(parts, inverted, ignoreCase) {
    return { type: "class", parts: parts, inverted: inverted, ignoreCase: ignoreCase };
  }

  function peg$anyExpectation() {
    return { type: "any" };
  }

  function peg$endExpectation() {
    return { type: "end" };
  }

  function peg$otherExpectation(description) {
    return { type: "other", description: description };
  }

  function peg$computePosDetails(pos) {
    var details = peg$posDetailsCache[pos], p;

    if (details) {
      return details;
    } else {
      p = pos - 1;
      while (!peg$posDetailsCache[p]) {
        p--;
      }

      details = peg$posDetailsCache[p];
      details = {
        line:   details.line,
        column: details.column
      };

      while (p < pos) {
        if (input.charCodeAt(p) === 10) {
          details.line++;
          details.column = 1;
        } else {
          details.column++;
        }

        p++;
      }

      peg$posDetailsCache[pos] = details;
      return details;
    }
  }

  function peg$computeLocation(startPos, endPos) {
    var startPosDetails = peg$computePosDetails(startPos),
        endPosDetails   = peg$computePosDetails(endPos);

    return {
      start: {
        offset: startPos,
        line:   startPosDetails.line,
        column: startPosDetails.column
      },
      end: {
        offset: endPos,
        line:   endPosDetails.line,
        column: endPosDetails.column
      }
    };
  }

  function peg$fail(expected) {
    if (peg$currPos < peg$maxFailPos) { return; }

    if (peg$currPos > peg$maxFailPos) {
      peg$maxFailPos = peg$currPos;
      peg$maxFailExpected = [];
    }

    peg$maxFailExpected.push(expected);
  }

  function peg$buildSimpleError(message, location) {
    return new peg$SyntaxError(message, null, null, location);
  }

  function peg$buildStructuredError(expected, found, location) {
    return new peg$SyntaxError(
      peg$SyntaxError.buildMessage(expected, found),
      expected,
      found,
      location
    );
  }

  function peg$parseterm() {
    var s0, s1, s2;

    s0 = peg$currPos;
    s1 = peg$parsemaybe_factor();
    if (s1 !== peg$FAILED) {
      s2 = peg$parseremaining_adds();
      if (s2 !== peg$FAILED) {
        peg$savedPos = s0;
        s1 = peg$c0(s1, s2);
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseremaining_adds() {
    var s0, s1;

    s0 = [];
    s1 = peg$parseadd_sub();
    while (s1 !== peg$FAILED) {
      s0.push(s1);
      s1 = peg$parseadd_sub();
    }

    return s0;
  }

  function peg$parseadd_sub() {
    var s0, s1, s2;

    s0 = peg$currPos;
    s1 = peg$parseadd_sub_operator();
    if (s1 !== peg$FAILED) {
      s2 = peg$parsemaybe_factor();
      if (s2 !== peg$FAILED) {
        peg$savedPos = s0;
        s1 = peg$c1(s1, s2);
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parsemaybe_factor() {
    var s0, s1, s2, s3;

    s0 = peg$currPos;
    s1 = peg$parsespaces();
    if (s1 !== peg$FAILED) {
      s2 = peg$parsefactor();
      if (s2 === peg$FAILED) {
        s2 = peg$parseprimary();
      }
      if (s2 !== peg$FAILED) {
        s3 = peg$parsespaces();
        if (s3 !== peg$FAILED) {
          peg$savedPos = s0;
          s1 = peg$c2(s2);
          s0 = s1;
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parsefactor() {
    var s0, s1, s2;

    s0 = peg$currPos;
    s1 = peg$parseprimary();
    if (s1 !== peg$FAILED) {
      s2 = peg$parseremaining_muls();
      if (s2 !== peg$FAILED) {
        peg$savedPos = s0;
        s1 = peg$c3(s1, s2);
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseremaining_muls() {
    var s0, s1;

    s0 = [];
    s1 = peg$parsemul_div();
    if (s1 !== peg$FAILED) {
      while (s1 !== peg$FAILED) {
        s0.push(s1);
        s1 = peg$parsemul_div();
      }
    } else {
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parsemul_div() {
    var s0, s1, s2;

    s0 = peg$currPos;
    s1 = peg$parsemul_div_operator();
    if (s1 !== peg$FAILED) {
      s2 = peg$parseprimary();
      if (s2 !== peg$FAILED) {
        peg$savedPos = s0;
        s1 = peg$c1(s1, s2);
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseadd_sub_operator() {
    var s0, s1, s2, s3;

    s0 = peg$currPos;
    s1 = peg$parsespaces();
    if (s1 !== peg$FAILED) {
      s2 = peg$parseplus();
      if (s2 === peg$FAILED) {
        s2 = peg$parseminus();
      }
      if (s2 !== peg$FAILED) {
        s3 = peg$parsespaces();
        if (s3 !== peg$FAILED) {
          peg$savedPos = s0;
          s1 = peg$c4(s2);
          s0 = s1;
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parsemul_div_operator() {
    var s0, s1, s2, s3;

    s0 = peg$currPos;
    s1 = peg$parsespaces();
    if (s1 !== peg$FAILED) {
      s2 = peg$parsemultiply();
      if (s2 === peg$FAILED) {
        s2 = peg$parsedivide();
      }
      if (s2 !== peg$FAILED) {
        s3 = peg$parsespaces();
        if (s3 !== peg$FAILED) {
          peg$savedPos = s0;
          s1 = peg$c4(s2);
          s0 = s1;
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseprimary() {
    var s0, s1, s2, s3;

    s0 = peg$currPos;
    s1 = peg$parsespaces();
    if (s1 !== peg$FAILED) {
      s2 = peg$parseparens();
      if (s2 === peg$FAILED) {
        s2 = peg$parsenumeric_value();
        if (s2 === peg$FAILED) {
          s2 = peg$parsefunction_value();
          if (s2 === peg$FAILED) {
            s2 = peg$parsefield_value();
          }
        }
      }
      if (s2 !== peg$FAILED) {
        s3 = peg$parsespaces();
        if (s3 !== peg$FAILED) {
          peg$savedPos = s0;
          s1 = peg$c5(s2);
          s0 = s1;
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseparens() {
    var s0, s1, s2, s3;

    s0 = peg$currPos;
    s1 = peg$parseopen_paren();
    if (s1 !== peg$FAILED) {
      s2 = peg$parseterm();
      if (s2 !== peg$FAILED) {
        s3 = peg$parseclosed_paren();
        if (s3 !== peg$FAILED) {
          peg$savedPos = s0;
          s1 = peg$c2(s2);
          s0 = s1;
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseplus() {
    var s0, s1;

    s0 = peg$currPos;
    if (input.charCodeAt(peg$currPos) === 43) {
      s1 = peg$c6;
      peg$currPos++;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c7); }
    }
    if (s1 !== peg$FAILED) {
      peg$savedPos = s0;
      s1 = peg$c8();
    }
    s0 = s1;

    return s0;
  }

  function peg$parseminus() {
    var s0, s1;

    s0 = peg$currPos;
    if (input.charCodeAt(peg$currPos) === 45) {
      s1 = peg$c9;
      peg$currPos++;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c10); }
    }
    if (s1 !== peg$FAILED) {
      peg$savedPos = s0;
      s1 = peg$c11();
    }
    s0 = s1;

    return s0;
  }

  function peg$parsemultiply() {
    var s0, s1;

    s0 = peg$currPos;
    if (input.charCodeAt(peg$currPos) === 42) {
      s1 = peg$c12;
      peg$currPos++;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c13); }
    }
    if (s1 !== peg$FAILED) {
      peg$savedPos = s0;
      s1 = peg$c14();
    }
    s0 = s1;

    return s0;
  }

  function peg$parsedivide() {
    var s0, s1;

    s0 = peg$currPos;
    if (peg$c15.test(input.charAt(peg$currPos))) {
      s1 = input.charAt(peg$currPos);
      peg$currPos++;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c16); }
    }
    if (s1 !== peg$FAILED) {
      peg$savedPos = s0;
      s1 = peg$c17();
    }
    s0 = s1;

    return s0;
  }

  function peg$parsefunction_value() {
    var s0, s1, s2, s3, s4, s5, s6;

    peg$silentFails++;
    s0 = peg$currPos;
    s1 = peg$parsefunction_name();
    if (s1 !== peg$FAILED) {
      s2 = peg$parseopen_paren();
      if (s2 !== peg$FAILED) {
        s3 = peg$parsespaces();
        if (s3 !== peg$FAILED) {
          s4 = peg$parsefunction_args();
          if (s4 === peg$FAILED) {
            s4 = null;
          }
          if (s4 !== peg$FAILED) {
            s5 = peg$parsespaces();
            if (s5 !== peg$FAILED) {
              s6 = peg$parseclosed_paren();
              if (s6 !== peg$FAILED) {
                peg$savedPos = s0;
                s1 = peg$c19();
                s0 = s1;
              } else {
                peg$currPos = s0;
                s0 = peg$FAILED;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }
    peg$silentFails--;
    if (s0 === peg$FAILED) {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c18); }
    }

    return s0;
  }

  function peg$parsenumeric_value() {
    var s0, s1, s2, s3, s4, s5, s6;

    peg$silentFails++;
    s0 = peg$currPos;
    if (peg$c21.test(input.charAt(peg$currPos))) {
      s1 = input.charAt(peg$currPos);
      peg$currPos++;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c22); }
    }
    if (s1 === peg$FAILED) {
      s1 = null;
    }
    if (s1 !== peg$FAILED) {
      s2 = [];
      if (peg$c23.test(input.charAt(peg$currPos))) {
        s3 = input.charAt(peg$currPos);
        peg$currPos++;
      } else {
        s3 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c24); }
      }
      if (s3 !== peg$FAILED) {
        while (s3 !== peg$FAILED) {
          s2.push(s3);
          if (peg$c23.test(input.charAt(peg$currPos))) {
            s3 = input.charAt(peg$currPos);
            peg$currPos++;
          } else {
            s3 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c24); }
          }
        }
      } else {
        s2 = peg$FAILED;
      }
      if (s2 !== peg$FAILED) {
        s3 = peg$currPos;
        if (input.charCodeAt(peg$currPos) === 46) {
          s4 = peg$c25;
          peg$currPos++;
        } else {
          s4 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c26); }
        }
        if (s4 !== peg$FAILED) {
          s5 = [];
          if (peg$c23.test(input.charAt(peg$currPos))) {
            s6 = input.charAt(peg$currPos);
            peg$currPos++;
          } else {
            s6 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c24); }
          }
          while (s6 !== peg$FAILED) {
            s5.push(s6);
            if (peg$c23.test(input.charAt(peg$currPos))) {
              s6 = input.charAt(peg$currPos);
              peg$currPos++;
            } else {
              s6 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$c24); }
            }
          }
          if (s5 !== peg$FAILED) {
            s4 = [s4, s5];
            s3 = s4;
          } else {
            peg$currPos = s3;
            s3 = peg$FAILED;
          }
        } else {
          peg$currPos = s3;
          s3 = peg$FAILED;
        }
        if (s3 === peg$FAILED) {
          s3 = null;
        }
        if (s3 !== peg$FAILED) {
          peg$savedPos = s0;
          s1 = peg$c27();
          s0 = s1;
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }
    peg$silentFails--;
    if (s0 === peg$FAILED) {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c20); }
    }

    return s0;
  }

  function peg$parsefield_value() {
    var s0, s1, s2;

    peg$silentFails++;
    s0 = peg$currPos;
    s1 = [];
    if (peg$c29.test(input.charAt(peg$currPos))) {
      s2 = input.charAt(peg$currPos);
      peg$currPos++;
    } else {
      s2 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c30); }
    }
    if (s2 !== peg$FAILED) {
      while (s2 !== peg$FAILED) {
        s1.push(s2);
        if (peg$c29.test(input.charAt(peg$currPos))) {
          s2 = input.charAt(peg$currPos);
          peg$currPos++;
        } else {
          s2 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c30); }
        }
      }
    } else {
      s1 = peg$FAILED;
    }
    if (s1 !== peg$FAILED) {
      peg$savedPos = s0;
      s1 = peg$c31();
    }
    s0 = s1;
    peg$silentFails--;
    if (s0 === peg$FAILED) {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c28); }
    }

    return s0;
  }

  function peg$parsefunction_args() {
    var s0, s1, s2, s3, s4, s5, s6, s7;

    s0 = peg$currPos;
    s1 = peg$parseaggregate_param();
    if (s1 !== peg$FAILED) {
      s2 = [];
      s3 = peg$currPos;
      s4 = peg$parsespaces();
      if (s4 !== peg$FAILED) {
        s5 = peg$parsecomma();
        if (s5 !== peg$FAILED) {
          s6 = peg$parsespaces();
          if (s6 !== peg$FAILED) {
            s7 = peg$parseaggregate_param();
            if (s7 !== peg$FAILED) {
              s4 = [s4, s5, s6, s7];
              s3 = s4;
            } else {
              peg$currPos = s3;
              s3 = peg$FAILED;
            }
          } else {
            peg$currPos = s3;
            s3 = peg$FAILED;
          }
        } else {
          peg$currPos = s3;
          s3 = peg$FAILED;
        }
      } else {
        peg$currPos = s3;
        s3 = peg$FAILED;
      }
      while (s3 !== peg$FAILED) {
        s2.push(s3);
        s3 = peg$currPos;
        s4 = peg$parsespaces();
        if (s4 !== peg$FAILED) {
          s5 = peg$parsecomma();
          if (s5 !== peg$FAILED) {
            s6 = peg$parsespaces();
            if (s6 !== peg$FAILED) {
              s7 = peg$parseaggregate_param();
              if (s7 !== peg$FAILED) {
                s4 = [s4, s5, s6, s7];
                s3 = s4;
              } else {
                peg$currPos = s3;
                s3 = peg$FAILED;
              }
            } else {
              peg$currPos = s3;
              s3 = peg$FAILED;
            }
          } else {
            peg$currPos = s3;
            s3 = peg$FAILED;
          }
        } else {
          peg$currPos = s3;
          s3 = peg$FAILED;
        }
      }
      if (s2 !== peg$FAILED) {
        s1 = [s1, s2];
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseaggregate_param() {
    var s0;

    s0 = peg$parsequoted_aggregate_param();
    if (s0 === peg$FAILED) {
      s0 = peg$parseraw_aggregate_param();
    }

    return s0;
  }

  function peg$parseraw_aggregate_param() {
    var s0, s1;

    s0 = [];
    if (peg$c32.test(input.charAt(peg$currPos))) {
      s1 = input.charAt(peg$currPos);
      peg$currPos++;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c33); }
    }
    if (s1 !== peg$FAILED) {
      while (s1 !== peg$FAILED) {
        s0.push(s1);
        if (peg$c32.test(input.charAt(peg$currPos))) {
          s1 = input.charAt(peg$currPos);
          peg$currPos++;
        } else {
          s1 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c33); }
        }
      }
    } else {
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parsequoted_aggregate_param() {
    var s0, s1, s2, s3;

    s0 = peg$currPos;
    if (input.charCodeAt(peg$currPos) === 34) {
      s1 = peg$c34;
      peg$currPos++;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c35); }
    }
    if (s1 !== peg$FAILED) {
      s2 = [];
      if (input.substr(peg$currPos, 2) === peg$c36) {
        s3 = peg$c36;
        peg$currPos += 2;
      } else {
        s3 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c37); }
      }
      if (s3 === peg$FAILED) {
        if (peg$c38.test(input.charAt(peg$currPos))) {
          s3 = input.charAt(peg$currPos);
          peg$currPos++;
        } else {
          s3 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c39); }
        }
      }
      while (s3 !== peg$FAILED) {
        s2.push(s3);
        if (input.substr(peg$currPos, 2) === peg$c36) {
          s3 = peg$c36;
          peg$currPos += 2;
        } else {
          s3 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c37); }
        }
        if (s3 === peg$FAILED) {
          if (peg$c38.test(input.charAt(peg$currPos))) {
            s3 = input.charAt(peg$currPos);
            peg$currPos++;
          } else {
            s3 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c39); }
          }
        }
      }
      if (s2 !== peg$FAILED) {
        if (input.charCodeAt(peg$currPos) === 34) {
          s3 = peg$c34;
          peg$currPos++;
        } else {
          s3 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c35); }
        }
        if (s3 !== peg$FAILED) {
          s1 = [s1, s2, s3];
          s0 = s1;
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parsefunction_name() {
    var s0, s1;

    s0 = [];
    if (peg$c40.test(input.charAt(peg$currPos))) {
      s1 = input.charAt(peg$currPos);
      peg$currPos++;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c41); }
    }
    if (s1 !== peg$FAILED) {
      while (s1 !== peg$FAILED) {
        s0.push(s1);
        if (peg$c40.test(input.charAt(peg$currPos))) {
          s1 = input.charAt(peg$currPos);
          peg$currPos++;
        } else {
          s1 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c41); }
        }
      }
    } else {
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parsecomma() {
    var s0;

    if (input.charCodeAt(peg$currPos) === 44) {
      s0 = peg$c42;
      peg$currPos++;
    } else {
      s0 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c43); }
    }

    return s0;
  }

  function peg$parseopen_paren() {
    var s0;

    if (input.charCodeAt(peg$currPos) === 40) {
      s0 = peg$c44;
      peg$currPos++;
    } else {
      s0 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c45); }
    }

    return s0;
  }

  function peg$parseclosed_paren() {
    var s0;

    if (input.charCodeAt(peg$currPos) === 41) {
      s0 = peg$c46;
      peg$currPos++;
    } else {
      s0 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c47); }
    }

    return s0;
  }

  function peg$parsespaces() {
    var s0, s1;

    s0 = [];
    if (input.charCodeAt(peg$currPos) === 32) {
      s1 = peg$c48;
      peg$currPos++;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c49); }
    }
    while (s1 !== peg$FAILED) {
      s0.push(s1);
      if (input.charCodeAt(peg$currPos) === 32) {
        s1 = peg$c48;
        peg$currPos++;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c49); }
      }
    }

    return s0;
  }


    const {tc, term} = options;


  peg$result = peg$startRuleFunction();

  if (peg$result !== peg$FAILED && peg$currPos === input.length) {
    return peg$result;
  } else {
    if (peg$result !== peg$FAILED && peg$currPos < input.length) {
      peg$fail(peg$endExpectation());
    }

    throw peg$buildStructuredError(
      peg$maxFailExpected,
      peg$maxFailPos < input.length ? input.charAt(peg$maxFailPos) : null,
      peg$maxFailPos < input.length
        ? peg$computeLocation(peg$maxFailPos, peg$maxFailPos + 1)
        : peg$computeLocation(peg$maxFailPos, peg$maxFailPos)
    );
  }
}

module.exports = {
  SyntaxError: peg$SyntaxError,
  parse:       peg$parse
};


/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_components_arithmeticInput_parser_tsx-app_utils_measurements_measurements_tsx.4dfa611fbb1a08f62b9788caa0b0de35.js.map