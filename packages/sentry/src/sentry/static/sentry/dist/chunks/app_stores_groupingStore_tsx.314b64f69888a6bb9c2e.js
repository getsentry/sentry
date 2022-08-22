"use strict";
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["app_stores_groupingStore_tsx"],{

/***/ "./app/actions/groupingActions.tsx":
/*!*****************************************!*\
  !*** ./app/actions/groupingActions.tsx ***!
  \*****************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var reflux__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! reflux */ "../node_modules/reflux/src/index.js");
/* harmony import */ var reflux__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(reflux__WEBPACK_IMPORTED_MODULE_0__);
 // Actions for "Grouping" view - for merging/unmerging events/issues

const GroupingActions = (0,reflux__WEBPACK_IMPORTED_MODULE_0__.createActions)(['fetch', 'showAllSimilarItems', 'toggleUnmerge', 'toggleMerge', 'unmerge', 'merge', 'toggleCollapseFingerprint', 'toggleCollapseFingerprints']);
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (GroupingActions);

/***/ }),

/***/ "./app/stores/groupingStore.tsx":
/*!**************************************!*\
  !*** ./app/stores/groupingStore.tsx ***!
  \**************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! core-js/modules/web.dom-collections.iterator.js */ "../node_modules/core-js/modules/web.dom-collections.iterator.js");
/* harmony import */ var core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_web_dom_collections_iterator_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! core-js/modules/es.array.includes.js */ "../node_modules/core-js/modules/es.array.includes.js");
/* harmony import */ var core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_array_includes_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! core-js/modules/es.error.cause.js */ "../node_modules/core-js/modules/es.error.cause.js");
/* harmony import */ var core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(core_js_modules_es_error_cause_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var lodash_pick__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! lodash/pick */ "../node_modules/lodash/pick.js");
/* harmony import */ var lodash_pick__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(lodash_pick__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var reflux__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! reflux */ "../node_modules/reflux/src/index.js");
/* harmony import */ var reflux__WEBPACK_IMPORTED_MODULE_4___default = /*#__PURE__*/__webpack_require__.n(reflux__WEBPACK_IMPORTED_MODULE_4__);
/* harmony import */ var sentry_actionCreators_group__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sentry/actionCreators/group */ "./app/actionCreators/group.tsx");
/* harmony import */ var sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sentry/actionCreators/indicator */ "./app/actionCreators/indicator.tsx");
/* harmony import */ var sentry_actions_groupingActions__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sentry/actions/groupingActions */ "./app/actions/groupingActions.tsx");
/* harmony import */ var sentry_api__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! sentry/api */ "./app/api.tsx");
/* harmony import */ var sentry_utils_makeSafeRefluxStore__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! sentry/utils/makeSafeRefluxStore */ "./app/utils/makeSafeRefluxStore.ts");










// Between 0-100
const MIN_SCORE = 0.6; // @param score: {[key: string]: number}

const checkBelowThreshold = function () {
  let scores = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
  const scoreKeys = Object.keys(scores);
  return !scoreKeys.map(key => scores[key]).find(score => score >= MIN_SCORE);
};

const storeConfig = {
  listenables: [sentry_actions_groupingActions__WEBPACK_IMPORTED_MODULE_7__["default"]],
  api: new sentry_api__WEBPACK_IMPORTED_MODULE_8__.Client(),

  init() {
    const state = this.getInitialState();
    Object.entries(state).forEach(_ref => {
      let [key, value] = _ref;
      this[key] = value;
    });
  },

  getInitialState() {
    return {
      // List of fingerprints that belong to issue
      mergedItems: [],
      // Map of {[fingerprint]: Array<fingerprint, event id>} that is selected to be unmerged
      unmergeList: new Map(),
      // Map of state for each fingerprint (i.e. "collapsed")
      unmergeState: new Map(),
      // Disabled state of "Unmerge" button in "Merged" tab (for Issues)
      unmergeDisabled: true,
      // If "Collapse All" was just used, this will be true
      unmergeLastCollapsed: false,
      // "Compare" button state
      enableFingerprintCompare: false,
      similarItems: [],
      filteredSimilarItems: [],
      similarLinks: '',
      mergeState: new Map(),
      mergeList: [],
      mergedLinks: '',
      mergeDisabled: false,
      loading: true,
      error: false
    };
  },

  setStateForId(map, idOrIds, newState) {
    const ids = Array.isArray(idOrIds) ? idOrIds : [idOrIds];
    return ids.map(id => {
      const state = map.has(id) && map.get(id) || {};
      const mergedState = { ...state,
        ...newState
      };
      map.set(id, mergedState);
      return mergedState;
    });
  },

  isAllUnmergedSelected() {
    const lockedItems = Array.from(this.unmergeState.values()).filter(_ref2 => {
      let {
        busy
      } = _ref2;
      return busy;
    }) || [];
    return this.unmergeList.size === this.mergedItems.filter(_ref3 => {
      let {
        latestEvent
      } = _ref3;
      return !!latestEvent;
    }).length - lockedItems.length;
  },

  // Fetches data
  onFetch(toFetchArray) {
    const requests = toFetchArray || this.toFetchArray; // Reset state and trigger update

    this.init();
    this.triggerFetchState();
    const promises = requests.map(_ref4 => {
      let {
        endpoint,
        queryParams,
        dataKey
      } = _ref4;
      return new Promise((resolve, reject) => {
        this.api.request(endpoint, {
          method: 'GET',
          data: queryParams,
          success: (data, _, resp) => {
            resolve({
              dataKey,
              data,
              links: resp ? resp.getResponseHeader('Link') : null
            });
          },
          error: err => {
            var _err$responseJSON;

            const error = ((_err$responseJSON = err.responseJSON) === null || _err$responseJSON === void 0 ? void 0 : _err$responseJSON.detail) || true;
            reject(error);
          }
        });
      });
    });
    const responseProcessors = {
      merged: items => {
        const newItemsMap = {};
        const newItems = [];
        items.forEach(item => {
          if (!newItemsMap[item.id]) {
            const newItem = {
              eventCount: 0,
              children: [],
              // lastSeen and latestEvent properties are correct
              // since the server returns items in
              // descending order of lastSeen
              ...item
            }; // Check for locked items

            this.setStateForId(this.unmergeState, item.id, {
              busy: item.state === 'locked'
            });
            newItemsMap[item.id] = newItem;
            newItems.push(newItem);
          }

          const newItem = newItemsMap[item.id];
          const {
            childId,
            childLabel,
            eventCount,
            lastSeen,
            latestEvent
          } = item;

          if (eventCount) {
            newItem.eventCount += eventCount;
          }

          if (childId) {
            newItem.children.push({
              childId,
              childLabel,
              lastSeen,
              latestEvent,
              eventCount
            });
          }
        });
        return newItems;
      },
      similar: _ref5 => {
        let [issue, scoreMap] = _ref5;
        // Hide items with a low scores
        const isBelowThreshold = checkBelowThreshold(scoreMap); // List of scores indexed by interface (i.e., exception and message)
        // Note: for v2, the interface is always "similarity". When v2 is
        // rolled out we can get rid of this grouping entirely.

        const scoresByInterface = Object.keys(scoreMap).map(scoreKey => [scoreKey, scoreMap[scoreKey]]).reduce((acc, _ref6) => {
          let [scoreKey, score] = _ref6;
          // v1 layout: '<interface>:...'
          const [interfaceName] = String(scoreKey).split(':');

          if (!acc[interfaceName]) {
            acc[interfaceName] = [];
          }

          acc[interfaceName].push([scoreKey, score]);
          return acc;
        }, {}); // Aggregate score by interface

        const aggregate = Object.keys(scoresByInterface).map(interfaceName => [interfaceName, scoresByInterface[interfaceName]]).reduce((acc, _ref7) => {
          let [interfaceName, allScores] = _ref7;
          // `null` scores means feature was not present in both issues, do not
          // include in aggregate
          const scores = allScores.filter(_ref8 => {
            let [, score] = _ref8;
            return score !== null;
          });
          const avg = scores.reduce((sum, _ref9) => {
            let [, score] = _ref9;
            return sum + score;
          }, 0) / scores.length;
          acc[interfaceName] = avg;
          return acc;
        }, {});
        return {
          issue,
          score: scoreMap,
          scoresByInterface,
          aggregate,
          isBelowThreshold
        };
      }
    };

    if (toFetchArray) {
      this.toFetchArray = toFetchArray;
    }

    return Promise.all(promises).then(resultsArray => {
      resultsArray.forEach(_ref10 => {
        let {
          dataKey,
          data,
          links
        } = _ref10;
        const items = dataKey === 'similar' ? data.map(responseProcessors[dataKey]) : responseProcessors[dataKey](data);
        this[`${dataKey}Items`] = items;
        this[`${dataKey}Links`] = links;
      });
      this.loading = false;
      this.error = false;
      this.triggerFetchState();
    }, () => {
      this.loading = false;
      this.error = true;
      this.triggerFetchState();
    });
  },

  // Toggle merge checkbox
  onToggleMerge(id) {
    let checked = false; // Don't do anything if item is busy

    const state = this.mergeState.has(id) ? this.mergeState.get(id) : undefined;

    if ((state === null || state === void 0 ? void 0 : state.busy) === true) {
      return;
    }

    if (this.mergeList.includes(id)) {
      this.mergeList = this.mergeList.filter(item => item !== id);
    } else {
      this.mergeList = [...this.mergeList, id];
      checked = true;
    }

    this.setStateForId(this.mergeState, id, {
      checked
    });
    this.triggerMergeState();
  },

  // Toggle unmerge check box
  onToggleUnmerge(_ref11) {
    let [fingerprint, eventId] = _ref11;
    let checked = false; // Uncheck an item to unmerge

    const state = this.unmergeState.get(fingerprint);

    if ((state === null || state === void 0 ? void 0 : state.busy) === true) {
      return;
    }

    if (this.unmergeList.has(fingerprint)) {
      this.unmergeList.delete(fingerprint);
    } else {
      this.unmergeList.set(fingerprint, eventId);
      checked = true;
    } // Update "checked" state for row


    this.setStateForId(this.unmergeState, fingerprint, {
      checked
    }); // Unmerge should be disabled if 0 or all items are selected, or if there's
    // only one item to select

    this.unmergeDisabled = this.mergedItems.size <= 1 || this.unmergeList.size === 0 || this.isAllUnmergedSelected();
    this.enableFingerprintCompare = this.unmergeList.size === 2;
    this.triggerUnmergeState();
  },

  onUnmerge(_ref12) {
    let {
      groupId,
      loadingMessage,
      successMessage,
      errorMessage
    } = _ref12;
    const ids = Array.from(this.unmergeList.keys());
    return new Promise((resolve, reject) => {
      if (this.isAllUnmergedSelected()) {
        reject(new Error('Not allowed to unmerge ALL events'));
        return;
      } // Disable unmerge button


      this.unmergeDisabled = true; // Disable rows

      this.setStateForId(this.unmergeState, ids, {
        checked: false,
        busy: true
      });
      this.triggerUnmergeState();
      (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_6__.addLoadingMessage)(loadingMessage);
      this.api.request(`/issues/${groupId}/hashes/`, {
        method: 'DELETE',
        query: {
          id: ids
        },
        success: () => {
          (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_6__.addSuccessMessage)(successMessage); // Busy rows after successful Unmerge

          this.setStateForId(this.unmergeState, ids, {
            checked: false,
            busy: true
          });
          this.unmergeList.clear();
        },
        error: () => {
          (0,sentry_actionCreators_indicator__WEBPACK_IMPORTED_MODULE_6__.addErrorMessage)(errorMessage);
          this.setStateForId(this.unmergeState, ids, {
            checked: true,
            busy: false
          });
        },
        complete: () => {
          this.unmergeDisabled = false;
          resolve(this.triggerUnmergeState());
        }
      });
    });
  },

  // For cross-project views, we need to pass projectId instead of
  // depending on router params (since we will only have orgId in that case)
  onMerge(_ref13) {
    let {
      params,
      query,
      projectId
    } = _ref13;

    if (!params) {
      return undefined;
    }

    const ids = this.mergeList;
    this.mergeDisabled = true;
    this.setStateForId(this.mergeState, ids, {
      busy: true
    });
    this.triggerMergeState();
    const promise = new Promise(resolve => {
      // Disable merge button
      const {
        orgId,
        groupId
      } = params;
      (0,sentry_actionCreators_group__WEBPACK_IMPORTED_MODULE_5__.mergeGroups)(this.api, {
        orgId,
        projectId: projectId || params.projectId,
        itemIds: [...ids, groupId],
        query
      }, {
        success: data => {
          var _data$merge;

          if (data !== null && data !== void 0 && (_data$merge = data.merge) !== null && _data$merge !== void 0 && _data$merge.parent) {
            this.trigger({
              mergedParent: data.merge.parent
            });
          } // Hide rows after successful merge


          this.setStateForId(this.mergeState, ids, {
            checked: false,
            busy: true
          });
          this.mergeList = [];
        },
        error: () => {
          this.setStateForId(this.mergeState, ids, {
            checked: true,
            busy: false
          });
        },
        complete: () => {
          this.mergeDisabled = false;
          resolve(this.triggerMergeState());
        }
      });
    });
    return promise;
  },

  // Toggle collapsed state of all fingerprints
  onToggleCollapseFingerprints() {
    this.setStateForId(this.unmergeState, this.mergedItems.map(_ref14 => {
      let {
        id
      } = _ref14;
      return id;
    }), {
      collapsed: !this.unmergeLastCollapsed
    });
    this.unmergeLastCollapsed = !this.unmergeLastCollapsed;
    this.trigger({
      unmergeLastCollapsed: this.unmergeLastCollapsed,
      unmergeState: this.unmergeState
    });
  },

  onToggleCollapseFingerprint(fingerprint) {
    const collapsed = this.unmergeState.has(fingerprint) && this.unmergeState.get(fingerprint).collapsed;
    this.setStateForId(this.unmergeState, fingerprint, {
      collapsed: !collapsed
    });
    this.trigger({
      unmergeState: this.unmergeState
    });
  },

  triggerFetchState() {
    const state = {
      similarItems: this.similarItems.filter(_ref15 => {
        let {
          isBelowThreshold
        } = _ref15;
        return !isBelowThreshold;
      }),
      filteredSimilarItems: this.similarItems.filter(_ref16 => {
        let {
          isBelowThreshold
        } = _ref16;
        return isBelowThreshold;
      }),
      ...lodash_pick__WEBPACK_IMPORTED_MODULE_3___default()(this, ['mergedItems', 'mergedLinks', 'similarLinks', 'mergeState', 'unmergeState', 'loading', 'error', 'enableFingerprintCompare', 'unmergeList'])
    };
    this.trigger(state);
    return state;
  },

  triggerUnmergeState() {
    const state = lodash_pick__WEBPACK_IMPORTED_MODULE_3___default()(this, ['unmergeDisabled', 'unmergeState', 'unmergeList', 'enableFingerprintCompare', 'unmergeLastCollapsed']);
    this.trigger(state);
    return state;
  },

  triggerMergeState() {
    const state = lodash_pick__WEBPACK_IMPORTED_MODULE_3___default()(this, ['mergeDisabled', 'mergeState', 'mergeList']);
    this.trigger(state);
    return state;
  },

  getState() {
    return this.state;
  }

};
const GroupingStore = (0,reflux__WEBPACK_IMPORTED_MODULE_4__.createStore)((0,sentry_utils_makeSafeRefluxStore__WEBPACK_IMPORTED_MODULE_9__.makeSafeRefluxStore)(storeConfig));
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (GroupingStore);

/***/ })

}]);
//# sourceMappingURL=../sourcemaps/app_stores_groupingStore_tsx.9b4166541d1ecc83f1d57cc55caa4555.js.map