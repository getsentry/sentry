export default [
  [
    {
      type: 'exception',
      data: {
        values: [
          {
            stacktrace: {
              frames: [
                {
                  function: 'ReactCompositeComponentWrapper._updateRenderedComponent',
                  map: 'vendor.js.map',
                  colNo: 0,
                  vars: {},
                  symbol: null,
                  mapUrl: 'http://localhost:8000/_static/1503338242/sentry/dist/vendor.js.map',
                  module: 'Users/billy/Dev/sentry/~/react/lib/ReactCompositeComponent',
                  origAbsPath: '?',
                  lineNo: 751,
                  origColNo: '?',
                  origFunction: '?',
                  errors: null,
                  package: null,
                  absPath: 'webpack:////Users/billy/Dev/sentry/~/react/lib/ReactCompositeComponent.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '~/react/lib/ReactCompositeComponent.js',
                  origFilename: '?',
                  platform: null,
                  context: [
                    [746, "    if (process.env.NODE_ENV !== 'production') {"],
                    [747, '      debugID = this._debugID;'],
                    [748, '    }'],
                    [749, ''],
                    [
                      750,
                      '    if (shouldUpdateReactComponent(prevRenderedElement, nextRenderedElement)) {'
                    ],
                    [
                      751,
                      '      ReactReconciler.receiveComponent(prevComponentInstance, nextRenderedElement, transaction, this._processChildContext(context));'
                    ],
                    [752, '    } else {'],
                    [
                      753,
                      '      var oldHostNode = ReactReconciler.getHostNode(prevComponentInstance);'
                    ],
                    [
                      754,
                      '      ReactReconciler.unmountComponent(prevComponentInstance, false);'
                    ],
                    [755, ''],
                    [
                      756,
                      '      var nodeType = ReactNodeTypes.getType(nextRenderedElement);'
                    ]
                  ],
                  symbolAddr: null,
                  origLineNo: '?'
                },
                {
                  function: 'Object.receiveComponent',
                  map: 'vendor.js.map',
                  colNo: 0,
                  vars: {},
                  symbol: null,
                  mapUrl: 'http://localhost:8000/_static/1503338242/sentry/dist/vendor.js.map',
                  module: 'Users/billy/Dev/sentry/~/react/lib/ReactReconciler',
                  origAbsPath: '?',
                  lineNo: 126,
                  origColNo: '?',
                  origFunction: '?',
                  errors: null,
                  package: null,
                  absPath: 'webpack:////Users/billy/Dev/sentry/~/react/lib/ReactReconciler.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '~/react/lib/ReactReconciler.js',
                  origFilename: '?',
                  platform: null,
                  context: [
                    [121, ''],
                    [122, '    if (refsChanged) {'],
                    [123, '      ReactRef.detachRefs(internalInstance, prevElement);'],
                    [124, '    }'],
                    [125, ''],
                    [
                      126,
                      '    internalInstance.receiveComponent(nextElement, transaction, context);'
                    ],
                    [127, ''],
                    [
                      128,
                      '    if (refsChanged && internalInstance._currentElement && internalInstance._currentElement.ref != null) {'
                    ],
                    [
                      129,
                      '      transaction.getReactMountReady().enqueue(attachRefs, internalInstance);'
                    ],
                    [130, '    }'],
                    [131, '']
                  ],
                  symbolAddr: null,
                  origLineNo: '?'
                },
                {
                  function: 'ReactDOMComponent.receiveComponent',
                  map: 'vendor.js.map',
                  colNo: 0,
                  vars: {},
                  symbol: null,
                  mapUrl: 'http://localhost:8000/_static/1503338242/sentry/dist/vendor.js.map',
                  module: 'Users/billy/Dev/sentry/~/react/lib/ReactDOMComponent',
                  origAbsPath: '?',
                  lineNo: 718,
                  origColNo: '?',
                  origFunction: '?',
                  errors: null,
                  package: null,
                  absPath: 'webpack:////Users/billy/Dev/sentry/~/react/lib/ReactDOMComponent.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '~/react/lib/ReactDOMComponent.js',
                  origFilename: '?',
                  platform: null,
                  context: [
                    [713, '   * @param {object} context'],
                    [714, '   */'],
                    [
                      715,
                      '  receiveComponent: function (nextElement, transaction, context) {'
                    ],
                    [716, '    var prevElement = this._currentElement;'],
                    [717, '    this._currentElement = nextElement;'],
                    [
                      718,
                      '    this.updateComponent(transaction, prevElement, nextElement, context);'
                    ],
                    [719, '  },'],
                    [720, ''],
                    [721, '  /**'],
                    [
                      722,
                      '   * Updates a DOM component after it has already been allocated and'
                    ],
                    [
                      723,
                      '   * attached to the DOM. Reconciles the root DOM node, then recurses.'
                    ]
                  ],
                  symbolAddr: null,
                  origLineNo: '?'
                },
                {
                  function: 'ReactDOMComponent.updateComponent',
                  map: 'vendor.js.map',
                  colNo: 0,
                  vars: {},
                  symbol: null,
                  mapUrl: 'http://localhost:8000/_static/1503338242/sentry/dist/vendor.js.map',
                  module: 'Users/billy/Dev/sentry/~/react/lib/ReactDOMComponent',
                  origAbsPath: '?',
                  lineNo: 760,
                  origColNo: '?',
                  origFunction: '?',
                  errors: null,
                  package: null,
                  absPath: 'webpack:////Users/billy/Dev/sentry/~/react/lib/ReactDOMComponent.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '~/react/lib/ReactDOMComponent.js',
                  origFilename: '?',
                  platform: null,
                  context: [
                    [755, '        break;'],
                    [756, '    }'],
                    [757, ''],
                    [758, '    assertValidProps(this, nextProps);'],
                    [
                      759,
                      '    this._updateDOMProperties(lastProps, nextProps, transaction);'
                    ],
                    [
                      760,
                      '    this._updateDOMChildren(lastProps, nextProps, transaction, context);'
                    ],
                    [761, ''],
                    [762, '    switch (this._tag) {'],
                    [763, "      case 'input':"],
                    [
                      764,
                      '        // Update the wrapper around inputs *after* updating props. This has to'
                    ],
                    [
                      765,
                      '        // happen after `_updateDOMProperties`. Otherwise HTML5 input validations'
                    ]
                  ],
                  symbolAddr: null,
                  origLineNo: '?'
                },
                {
                  function: 'ReactDOMComponent._updateDOMChildren',
                  map: 'vendor.js.map',
                  colNo: 0,
                  vars: {},
                  symbol: null,
                  mapUrl: 'http://localhost:8000/_static/1503338242/sentry/dist/vendor.js.map',
                  module: 'Users/billy/Dev/sentry/~/react/lib/ReactDOMComponent',
                  origAbsPath: '?',
                  lineNo: 942,
                  origColNo: '?',
                  origFunction: '?',
                  errors: null,
                  package: null,
                  absPath: 'webpack:////Users/billy/Dev/sentry/~/react/lib/ReactDOMComponent.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '~/react/lib/ReactDOMComponent.js',
                  origFilename: '?',
                  platform: null,
                  context: [
                    [937, '    } else if (nextChildren != null) {'],
                    [938, "      if (process.env.NODE_ENV !== 'production') {"],
                    [939, '        setAndValidateContentChildDev.call(this, null);'],
                    [940, '      }'],
                    [941, ''],
                    [
                      942,
                      '      this.updateChildren(nextChildren, transaction, context);'
                    ],
                    [943, '    }'],
                    [944, '  },'],
                    [945, ''],
                    [946, '  getHostNode: function () {'],
                    [947, '    return getNode(this);']
                  ],
                  symbolAddr: null,
                  origLineNo: '?'
                },
                {
                  function: 'ReactDOMComponent.updateChildren',
                  map: 'vendor.js.map',
                  colNo: 0,
                  vars: {},
                  symbol: null,
                  mapUrl: 'http://localhost:8000/_static/1503338242/sentry/dist/vendor.js.map',
                  module: 'Users/billy/Dev/sentry/~/react/lib/ReactMultiChild',
                  origAbsPath: '?',
                  lineNo: 301,
                  origColNo: '?',
                  origFunction: '?',
                  errors: null,
                  package: null,
                  absPath: 'webpack:////Users/billy/Dev/sentry/~/react/lib/ReactMultiChild.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '~/react/lib/ReactMultiChild.js',
                  origFilename: '?',
                  platform: null,
                  context: [
                    [296, '     * @param {ReactReconcileTransaction} transaction'],
                    [297, '     * @internal'],
                    [298, '     */'],
                    [
                      299,
                      '    updateChildren: function (nextNestedChildrenElements, transaction, context) {'
                    ],
                    [300, '      // Hook used by React ART'],
                    [
                      301,
                      '      this._updateChildren(nextNestedChildrenElements, transaction, context);'
                    ],
                    [302, '    },'],
                    [303, ''],
                    [304, '    /**'],
                    [
                      305,
                      '     * @param {?object} nextNestedChildrenElements Nested child element maps.'
                    ],
                    [306, '     * @param {ReactReconcileTransaction} transaction']
                  ],
                  symbolAddr: null,
                  origLineNo: '?'
                },
                {
                  function: 'ReactDOMComponent._updateChildren',
                  map: 'vendor.js.map',
                  colNo: 0,
                  vars: {},
                  symbol: null,
                  mapUrl: 'http://localhost:8000/_static/1503338242/sentry/dist/vendor.js.map',
                  module: 'Users/billy/Dev/sentry/~/react/lib/ReactMultiChild',
                  origAbsPath: '?',
                  lineNo: 314,
                  origColNo: '?',
                  origFunction: '?',
                  errors: null,
                  package: null,
                  absPath: 'webpack:////Users/billy/Dev/sentry/~/react/lib/ReactMultiChild.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '~/react/lib/ReactMultiChild.js',
                  origFilename: '?',
                  platform: null,
                  context: [
                    [309, '     */'],
                    [
                      310,
                      '    _updateChildren: function (nextNestedChildrenElements, transaction, context) {'
                    ],
                    [311, '      var prevChildren = this._renderedChildren;'],
                    [312, '      var removedNodes = {};'],
                    [313, '      var mountImages = [];'],
                    [
                      314,
                      '      var nextChildren = this._reconcilerUpdateChildren(prevChildren, nextNestedChildrenElements, mountImages, removedNodes, transaction, context);'
                    ],
                    [315, '      if (!nextChildren && !prevChildren) {'],
                    [316, '        return;'],
                    [317, '      }'],
                    [318, '      var updates = null;'],
                    [319, '      var name;']
                  ],
                  symbolAddr: null,
                  origLineNo: '?'
                },
                {
                  function: 'ReactDOMComponent._reconcilerUpdateChildren',
                  map: 'vendor.js.map',
                  colNo: 0,
                  vars: {},
                  symbol: null,
                  mapUrl: 'http://localhost:8000/_static/1503338242/sentry/dist/vendor.js.map',
                  module: 'Users/billy/Dev/sentry/~/react/lib/ReactMultiChild',
                  origAbsPath: '?',
                  lineNo: 210,
                  origColNo: '?',
                  origFunction: '?',
                  errors: null,
                  package: null,
                  absPath: 'webpack:////Users/billy/Dev/sentry/~/react/lib/ReactMultiChild.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '~/react/lib/ReactMultiChild.js',
                  origFilename: '?',
                  platform: null,
                  context: [
                    [
                      205,
                      '            ReactCurrentOwner.current = this._currentElement._owner;'
                    ],
                    [
                      206,
                      '            nextChildren = flattenChildren(nextNestedChildrenElements, selfDebugID);'
                    ],
                    [207, '          } finally {'],
                    [208, '            ReactCurrentOwner.current = null;'],
                    [209, '          }'],
                    [
                      210,
                      '          ReactChildReconciler.updateChildren(prevChildren, nextChildren, mountImages, removedNodes, transaction, this, this._hostContainerI {snip}'
                    ],
                    [211, '          return nextChildren;'],
                    [212, '        }'],
                    [213, '      }'],
                    [
                      214,
                      '      nextChildren = flattenChildren(nextNestedChildrenElements, selfDebugID);'
                    ],
                    [
                      215,
                      '      ReactChildReconciler.updateChildren(prevChildren, nextChildren, mountImages, removedNodes, transaction, this, this._hostContainerInfo, {snip}'
                    ]
                  ],
                  symbolAddr: null,
                  origLineNo: '?'
                },
                {
                  function: 'Object.updateChildren',
                  map: 'vendor.js.map',
                  colNo: 0,
                  vars: {},
                  symbol: null,
                  mapUrl: 'http://localhost:8000/_static/1503338242/sentry/dist/vendor.js.map',
                  module: 'Users/billy/Dev/sentry/~/react/lib/ReactChildReconciler',
                  origAbsPath: '?',
                  lineNo: 110,
                  origColNo: '?',
                  origFunction: '?',
                  errors: null,
                  package: null,
                  absPath: 'webpack:////Users/billy/Dev/sentry/~/react/lib/ReactChildReconciler.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '~/react/lib/ReactChildReconciler.js',
                  origFilename: '?',
                  platform: null,
                  context: [
                    [105, '      }'],
                    [106, '      prevChild = prevChildren && prevChildren[name];'],
                    [
                      107,
                      '      var prevElement = prevChild && prevChild._currentElement;'
                    ],
                    [108, '      var nextElement = nextChildren[name];'],
                    [
                      109,
                      '      if (prevChild != null && shouldUpdateReactComponent(prevElement, nextElement)) {'
                    ],
                    [
                      110,
                      '        ReactReconciler.receiveComponent(prevChild, nextElement, transaction, context);'
                    ],
                    [111, '        nextChildren[name] = prevChild;'],
                    [112, '      } else {'],
                    [113, '        if (prevChild) {'],
                    [
                      114,
                      '          removedNodes[name] = ReactReconciler.getHostNode(prevChild);'
                    ],
                    [115, '          ReactReconciler.unmountComponent(prevChild, false);']
                  ],
                  symbolAddr: null,
                  origLineNo: '?'
                },
                {
                  function: 'Object.receiveComponent',
                  map: 'vendor.js.map',
                  colNo: 0,
                  vars: {},
                  symbol: null,
                  mapUrl: 'http://localhost:8000/_static/1503338242/sentry/dist/vendor.js.map',
                  module: 'Users/billy/Dev/sentry/~/react/lib/ReactReconciler',
                  origAbsPath: '?',
                  lineNo: 126,
                  origColNo: '?',
                  origFunction: '?',
                  errors: null,
                  package: null,
                  absPath: 'webpack:////Users/billy/Dev/sentry/~/react/lib/ReactReconciler.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '~/react/lib/ReactReconciler.js',
                  origFilename: '?',
                  platform: null,
                  context: [
                    [121, ''],
                    [122, '    if (refsChanged) {'],
                    [123, '      ReactRef.detachRefs(internalInstance, prevElement);'],
                    [124, '    }'],
                    [125, ''],
                    [
                      126,
                      '    internalInstance.receiveComponent(nextElement, transaction, context);'
                    ],
                    [127, ''],
                    [
                      128,
                      '    if (refsChanged && internalInstance._currentElement && internalInstance._currentElement.ref != null) {'
                    ],
                    [
                      129,
                      '      transaction.getReactMountReady().enqueue(attachRefs, internalInstance);'
                    ],
                    [130, '    }'],
                    [131, '']
                  ],
                  symbolAddr: null,
                  origLineNo: '?'
                },
                {
                  function: 'ReactDOMComponent.receiveComponent',
                  map: 'vendor.js.map',
                  colNo: 0,
                  vars: {},
                  symbol: null,
                  mapUrl: 'http://localhost:8000/_static/1503338242/sentry/dist/vendor.js.map',
                  module: 'Users/billy/Dev/sentry/~/react/lib/ReactDOMComponent',
                  origAbsPath: '?',
                  lineNo: 718,
                  origColNo: '?',
                  origFunction: '?',
                  errors: null,
                  package: null,
                  absPath: 'webpack:////Users/billy/Dev/sentry/~/react/lib/ReactDOMComponent.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '~/react/lib/ReactDOMComponent.js',
                  origFilename: '?',
                  platform: null,
                  context: [
                    [713, '   * @param {object} context'],
                    [714, '   */'],
                    [
                      715,
                      '  receiveComponent: function (nextElement, transaction, context) {'
                    ],
                    [716, '    var prevElement = this._currentElement;'],
                    [717, '    this._currentElement = nextElement;'],
                    [
                      718,
                      '    this.updateComponent(transaction, prevElement, nextElement, context);'
                    ],
                    [719, '  },'],
                    [720, ''],
                    [721, '  /**'],
                    [
                      722,
                      '   * Updates a DOM component after it has already been allocated and'
                    ],
                    [
                      723,
                      '   * attached to the DOM. Reconciles the root DOM node, then recurses.'
                    ]
                  ],
                  symbolAddr: null,
                  origLineNo: '?'
                },
                {
                  function: 'ReactDOMComponent.updateComponent',
                  map: 'vendor.js.map',
                  colNo: 0,
                  vars: {},
                  symbol: null,
                  mapUrl: 'http://localhost:8000/_static/1503338242/sentry/dist/vendor.js.map',
                  module: 'Users/billy/Dev/sentry/~/react/lib/ReactDOMComponent',
                  origAbsPath: '?',
                  lineNo: 760,
                  origColNo: '?',
                  origFunction: '?',
                  errors: null,
                  package: null,
                  absPath: 'webpack:////Users/billy/Dev/sentry/~/react/lib/ReactDOMComponent.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '~/react/lib/ReactDOMComponent.js',
                  origFilename: '?',
                  platform: null,
                  context: [
                    [755, '        break;'],
                    [756, '    }'],
                    [757, ''],
                    [758, '    assertValidProps(this, nextProps);'],
                    [
                      759,
                      '    this._updateDOMProperties(lastProps, nextProps, transaction);'
                    ],
                    [
                      760,
                      '    this._updateDOMChildren(lastProps, nextProps, transaction, context);'
                    ],
                    [761, ''],
                    [762, '    switch (this._tag) {'],
                    [763, "      case 'input':"],
                    [
                      764,
                      '        // Update the wrapper around inputs *after* updating props. This has to'
                    ],
                    [
                      765,
                      '        // happen after `_updateDOMProperties`. Otherwise HTML5 input validations'
                    ]
                  ],
                  symbolAddr: null,
                  origLineNo: '?'
                },
                {
                  function: 'ReactDOMComponent._updateDOMChildren',
                  map: 'vendor.js.map',
                  colNo: 0,
                  vars: {},
                  symbol: null,
                  mapUrl: 'http://localhost:8000/_static/1503338242/sentry/dist/vendor.js.map',
                  module: 'Users/billy/Dev/sentry/~/react/lib/ReactDOMComponent',
                  origAbsPath: '?',
                  lineNo: 942,
                  origColNo: '?',
                  origFunction: '?',
                  errors: null,
                  package: null,
                  absPath: 'webpack:////Users/billy/Dev/sentry/~/react/lib/ReactDOMComponent.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '~/react/lib/ReactDOMComponent.js',
                  origFilename: '?',
                  platform: null,
                  context: [
                    [937, '    } else if (nextChildren != null) {'],
                    [938, "      if (process.env.NODE_ENV !== 'production') {"],
                    [939, '        setAndValidateContentChildDev.call(this, null);'],
                    [940, '      }'],
                    [941, ''],
                    [
                      942,
                      '      this.updateChildren(nextChildren, transaction, context);'
                    ],
                    [943, '    }'],
                    [944, '  },'],
                    [945, ''],
                    [946, '  getHostNode: function () {'],
                    [947, '    return getNode(this);']
                  ],
                  symbolAddr: null,
                  origLineNo: '?'
                },
                {
                  function: 'ReactDOMComponent.updateChildren',
                  map: 'vendor.js.map',
                  colNo: 0,
                  vars: {},
                  symbol: null,
                  mapUrl: 'http://localhost:8000/_static/1503338242/sentry/dist/vendor.js.map',
                  module: 'Users/billy/Dev/sentry/~/react/lib/ReactMultiChild',
                  origAbsPath: '?',
                  lineNo: 301,
                  origColNo: '?',
                  origFunction: '?',
                  errors: null,
                  package: null,
                  absPath: 'webpack:////Users/billy/Dev/sentry/~/react/lib/ReactMultiChild.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '~/react/lib/ReactMultiChild.js',
                  origFilename: '?',
                  platform: null,
                  context: [
                    [296, '     * @param {ReactReconcileTransaction} transaction'],
                    [297, '     * @internal'],
                    [298, '     */'],
                    [
                      299,
                      '    updateChildren: function (nextNestedChildrenElements, transaction, context) {'
                    ],
                    [300, '      // Hook used by React ART'],
                    [
                      301,
                      '      this._updateChildren(nextNestedChildrenElements, transaction, context);'
                    ],
                    [302, '    },'],
                    [303, ''],
                    [304, '    /**'],
                    [
                      305,
                      '     * @param {?object} nextNestedChildrenElements Nested child element maps.'
                    ],
                    [306, '     * @param {ReactReconcileTransaction} transaction']
                  ],
                  symbolAddr: null,
                  origLineNo: '?'
                },
                {
                  function: 'ReactDOMComponent._updateChildren',
                  map: 'vendor.js.map',
                  colNo: 0,
                  vars: {},
                  symbol: null,
                  mapUrl: 'http://localhost:8000/_static/1503338242/sentry/dist/vendor.js.map',
                  module: 'Users/billy/Dev/sentry/~/react/lib/ReactMultiChild',
                  origAbsPath: '?',
                  lineNo: 314,
                  origColNo: '?',
                  origFunction: '?',
                  errors: null,
                  package: null,
                  absPath: 'webpack:////Users/billy/Dev/sentry/~/react/lib/ReactMultiChild.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '~/react/lib/ReactMultiChild.js',
                  origFilename: '?',
                  platform: null,
                  context: [
                    [309, '     */'],
                    [
                      310,
                      '    _updateChildren: function (nextNestedChildrenElements, transaction, context) {'
                    ],
                    [311, '      var prevChildren = this._renderedChildren;'],
                    [312, '      var removedNodes = {};'],
                    [313, '      var mountImages = [];'],
                    [
                      314,
                      '      var nextChildren = this._reconcilerUpdateChildren(prevChildren, nextNestedChildrenElements, mountImages, removedNodes, transaction, context);'
                    ],
                    [315, '      if (!nextChildren && !prevChildren) {'],
                    [316, '        return;'],
                    [317, '      }'],
                    [318, '      var updates = null;'],
                    [319, '      var name;']
                  ],
                  symbolAddr: null,
                  origLineNo: '?'
                },
                {
                  function: 'ReactDOMComponent._reconcilerUpdateChildren',
                  map: 'vendor.js.map',
                  colNo: 0,
                  vars: {},
                  symbol: null,
                  mapUrl: 'http://localhost:8000/_static/1503338242/sentry/dist/vendor.js.map',
                  module: 'Users/billy/Dev/sentry/~/react/lib/ReactMultiChild',
                  origAbsPath: '?',
                  lineNo: 210,
                  origColNo: '?',
                  origFunction: '?',
                  errors: null,
                  package: null,
                  absPath: 'webpack:////Users/billy/Dev/sentry/~/react/lib/ReactMultiChild.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '~/react/lib/ReactMultiChild.js',
                  origFilename: '?',
                  platform: null,
                  context: [
                    [
                      205,
                      '            ReactCurrentOwner.current = this._currentElement._owner;'
                    ],
                    [
                      206,
                      '            nextChildren = flattenChildren(nextNestedChildrenElements, selfDebugID);'
                    ],
                    [207, '          } finally {'],
                    [208, '            ReactCurrentOwner.current = null;'],
                    [209, '          }'],
                    [
                      210,
                      '          ReactChildReconciler.updateChildren(prevChildren, nextChildren, mountImages, removedNodes, transaction, this, this._hostContainerI {snip}'
                    ],
                    [211, '          return nextChildren;'],
                    [212, '        }'],
                    [213, '      }'],
                    [
                      214,
                      '      nextChildren = flattenChildren(nextNestedChildrenElements, selfDebugID);'
                    ],
                    [
                      215,
                      '      ReactChildReconciler.updateChildren(prevChildren, nextChildren, mountImages, removedNodes, transaction, this, this._hostContainerInfo, {snip}'
                    ]
                  ],
                  symbolAddr: null,
                  origLineNo: '?'
                },
                {
                  function: 'Object.updateChildren',
                  map: 'vendor.js.map',
                  colNo: 0,
                  vars: {},
                  symbol: null,
                  mapUrl: 'http://localhost:8000/_static/1503338242/sentry/dist/vendor.js.map',
                  module: 'Users/billy/Dev/sentry/~/react/lib/ReactChildReconciler',
                  origAbsPath: '?',
                  lineNo: 122,
                  origColNo: '?',
                  origFunction: '?',
                  errors: null,
                  package: null,
                  absPath: 'webpack:////Users/billy/Dev/sentry/~/react/lib/ReactChildReconciler.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '~/react/lib/ReactChildReconciler.js',
                  origFilename: '?',
                  platform: null,
                  context: [
                    [
                      117,
                      "        // The child must be instantiated before it's mounted."
                    ],
                    [
                      118,
                      '        var nextChildInstance = instantiateReactComponent(nextElement, true);'
                    ],
                    [119, '        nextChildren[name] = nextChildInstance;'],
                    [
                      120,
                      '        // Creating mount image now ensures refs are resolved in right order'
                    ],
                    [
                      121,
                      '        // (see https://github.com/facebook/react/pull/7101 for explanation).'
                    ],
                    [
                      122,
                      '        var nextChildMountImage = ReactReconciler.mountComponent(nextChildInstance, transaction, hostParent, hostContainerInfo, context, selfDebugID);'
                    ],
                    [123, '        mountImages.push(nextChildMountImage);'],
                    [124, '      }'],
                    [125, '    }'],
                    [126, '    // Unmount children that are no longer present.'],
                    [127, '    for (name in prevChildren) {']
                  ],
                  symbolAddr: null,
                  origLineNo: '?'
                },
                {
                  function: 'Object.mountComponent',
                  map: 'vendor.js.map',
                  colNo: 0,
                  vars: {},
                  symbol: null,
                  mapUrl: 'http://localhost:8000/_static/1503338242/sentry/dist/vendor.js.map',
                  module: 'Users/billy/Dev/sentry/~/react/lib/ReactReconciler',
                  origAbsPath: '?',
                  lineNo: 47,
                  origColNo: '?',
                  origFunction: '?',
                  errors: null,
                  package: null,
                  absPath: 'webpack:////Users/billy/Dev/sentry/~/react/lib/ReactReconciler.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '~/react/lib/ReactReconciler.js',
                  origFilename: '?',
                  platform: null,
                  context: [
                    [42, "    if (process.env.NODE_ENV !== 'production') {"],
                    [43, '      if (internalInstance._debugID !== 0) {'],
                    [
                      44,
                      '        ReactInstrumentation.debugTool.onBeforeMountComponent(internalInstance._debugID, internalInstance._currentElement, parentDebugID);'
                    ],
                    [45, '      }'],
                    [46, '    }'],
                    [
                      47,
                      '    var markup = internalInstance.mountComponent(transaction, hostParent, hostContainerInfo, context, parentDebugID);'
                    ],
                    [
                      48,
                      '    if (internalInstance._currentElement && internalInstance._currentElement.ref != null) {'
                    ],
                    [
                      49,
                      '      transaction.getReactMountReady().enqueue(attachRefs, internalInstance);'
                    ],
                    [50, '    }'],
                    [51, "    if (process.env.NODE_ENV !== 'production') {"],
                    [52, '      if (internalInstance._debugID !== 0) {']
                  ],
                  symbolAddr: null,
                  origLineNo: '?'
                },
                {
                  function: 'ReactCompositeComponentWrapper.mountComponent',
                  map: 'vendor.js.map',
                  colNo: 0,
                  vars: {},
                  symbol: null,
                  mapUrl: 'http://localhost:8000/_static/1503338242/sentry/dist/vendor.js.map',
                  module: 'Users/billy/Dev/sentry/~/react/lib/ReactCompositeComponent',
                  origAbsPath: '?',
                  lineNo: 257,
                  origColNo: '?',
                  origFunction: '?',
                  errors: null,
                  package: null,
                  absPath: 'webpack:////Users/billy/Dev/sentry/~/react/lib/ReactCompositeComponent.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '~/react/lib/ReactCompositeComponent.js',
                  origFilename: '?',
                  platform: null,
                  context: [
                    [252, ''],
                    [253, '    var markup;'],
                    [254, '    if (inst.unstable_handleError) {'],
                    [
                      255,
                      '      markup = this.performInitialMountWithErrorHandling(renderedElement, hostParent, hostContainerInfo, transaction, context);'
                    ],
                    [256, '    } else {'],
                    [
                      257,
                      '      markup = this.performInitialMount(renderedElement, hostParent, hostContainerInfo, transaction, context);'
                    ],
                    [258, '    }'],
                    [259, ''],
                    [260, '    if (inst.componentDidMount) {'],
                    [261, "      if (process.env.NODE_ENV !== 'production') {"],
                    [
                      262,
                      '        transaction.getReactMountReady().enqueue(function () {'
                    ]
                  ],
                  symbolAddr: null,
                  origLineNo: '?'
                },
                {
                  function: 'ReactCompositeComponentWrapper.performInitialMount',
                  map: 'vendor.js.map',
                  colNo: 0,
                  vars: {},
                  symbol: null,
                  mapUrl: 'http://localhost:8000/_static/1503338242/sentry/dist/vendor.js.map',
                  module: 'Users/billy/Dev/sentry/~/react/lib/ReactCompositeComponent',
                  origAbsPath: '?',
                  lineNo: 370,
                  origColNo: '?',
                  origFunction: '?',
                  errors: null,
                  package: null,
                  absPath: 'webpack:////Users/billy/Dev/sentry/~/react/lib/ReactCompositeComponent.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '~/react/lib/ReactCompositeComponent.js',
                  origFilename: '?',
                  platform: null,
                  context: [
                    [365, '    this._renderedNodeType = nodeType;'],
                    [
                      366,
                      '    var child = this._instantiateReactComponent(renderedElement, nodeType !== ReactNodeTypes.EMPTY /* shouldHaveDebugID */'
                    ],
                    [367, '    );'],
                    [368, '    this._renderedComponent = child;'],
                    [369, ''],
                    [
                      370,
                      '    var markup = ReactReconciler.mountComponent(child, transaction, hostParent, hostContainerInfo, this._processChildContext(context), debugID);'
                    ],
                    [371, ''],
                    [372, "    if (process.env.NODE_ENV !== 'production') {"],
                    [373, '      if (debugID !== 0) {'],
                    [
                      374,
                      '        var childDebugIDs = child._debugID !== 0 ? [child._debugID] : [];'
                    ],
                    [
                      375,
                      '        ReactInstrumentation.debugTool.onSetChildren(debugID, childDebugIDs);'
                    ]
                  ],
                  symbolAddr: null,
                  origLineNo: '?'
                },
                {
                  function: 'Object.mountComponent',
                  map: 'vendor.js.map',
                  colNo: 0,
                  vars: {},
                  symbol: null,
                  mapUrl: 'http://localhost:8000/_static/1503338242/sentry/dist/vendor.js.map',
                  module: 'Users/billy/Dev/sentry/~/react/lib/ReactReconciler',
                  origAbsPath: '?',
                  lineNo: 47,
                  origColNo: '?',
                  origFunction: '?',
                  errors: null,
                  package: null,
                  absPath: 'webpack:////Users/billy/Dev/sentry/~/react/lib/ReactReconciler.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '~/react/lib/ReactReconciler.js',
                  origFilename: '?',
                  platform: null,
                  context: [
                    [42, "    if (process.env.NODE_ENV !== 'production') {"],
                    [43, '      if (internalInstance._debugID !== 0) {'],
                    [
                      44,
                      '        ReactInstrumentation.debugTool.onBeforeMountComponent(internalInstance._debugID, internalInstance._currentElement, parentDebugID);'
                    ],
                    [45, '      }'],
                    [46, '    }'],
                    [
                      47,
                      '    var markup = internalInstance.mountComponent(transaction, hostParent, hostContainerInfo, context, parentDebugID);'
                    ],
                    [
                      48,
                      '    if (internalInstance._currentElement && internalInstance._currentElement.ref != null) {'
                    ],
                    [
                      49,
                      '      transaction.getReactMountReady().enqueue(attachRefs, internalInstance);'
                    ],
                    [50, '    }'],
                    [51, "    if (process.env.NODE_ENV !== 'production') {"],
                    [52, '      if (internalInstance._debugID !== 0) {']
                  ],
                  symbolAddr: null,
                  origLineNo: '?'
                },
                {
                  function: 'ReactCompositeComponentWrapper.mountComponent',
                  map: 'vendor.js.map',
                  colNo: 0,
                  vars: {},
                  symbol: null,
                  mapUrl: 'http://localhost:8000/_static/1503338242/sentry/dist/vendor.js.map',
                  module: 'Users/billy/Dev/sentry/~/react/lib/ReactCompositeComponent',
                  origAbsPath: '?',
                  lineNo: 257,
                  origColNo: '?',
                  origFunction: '?',
                  errors: null,
                  package: null,
                  absPath: 'webpack:////Users/billy/Dev/sentry/~/react/lib/ReactCompositeComponent.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '~/react/lib/ReactCompositeComponent.js',
                  origFilename: '?',
                  platform: null,
                  context: [
                    [252, ''],
                    [253, '    var markup;'],
                    [254, '    if (inst.unstable_handleError) {'],
                    [
                      255,
                      '      markup = this.performInitialMountWithErrorHandling(renderedElement, hostParent, hostContainerInfo, transaction, context);'
                    ],
                    [256, '    } else {'],
                    [
                      257,
                      '      markup = this.performInitialMount(renderedElement, hostParent, hostContainerInfo, transaction, context);'
                    ],
                    [258, '    }'],
                    [259, ''],
                    [260, '    if (inst.componentDidMount) {'],
                    [261, "      if (process.env.NODE_ENV !== 'production') {"],
                    [
                      262,
                      '        transaction.getReactMountReady().enqueue(function () {'
                    ]
                  ],
                  symbolAddr: null,
                  origLineNo: '?'
                },
                {
                  function: 'ReactCompositeComponentWrapper.performInitialMount',
                  map: 'vendor.js.map',
                  colNo: 0,
                  vars: {},
                  symbol: null,
                  mapUrl: 'http://localhost:8000/_static/1503338242/sentry/dist/vendor.js.map',
                  module: 'Users/billy/Dev/sentry/~/react/lib/ReactCompositeComponent',
                  origAbsPath: '?',
                  lineNo: 370,
                  origColNo: '?',
                  origFunction: '?',
                  errors: null,
                  package: null,
                  absPath: 'webpack:////Users/billy/Dev/sentry/~/react/lib/ReactCompositeComponent.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '~/react/lib/ReactCompositeComponent.js',
                  origFilename: '?',
                  platform: null,
                  context: [
                    [365, '    this._renderedNodeType = nodeType;'],
                    [
                      366,
                      '    var child = this._instantiateReactComponent(renderedElement, nodeType !== ReactNodeTypes.EMPTY /* shouldHaveDebugID */'
                    ],
                    [367, '    );'],
                    [368, '    this._renderedComponent = child;'],
                    [369, ''],
                    [
                      370,
                      '    var markup = ReactReconciler.mountComponent(child, transaction, hostParent, hostContainerInfo, this._processChildContext(context), debugID);'
                    ],
                    [371, ''],
                    [372, "    if (process.env.NODE_ENV !== 'production') {"],
                    [373, '      if (debugID !== 0) {'],
                    [
                      374,
                      '        var childDebugIDs = child._debugID !== 0 ? [child._debugID] : [];'
                    ],
                    [
                      375,
                      '        ReactInstrumentation.debugTool.onSetChildren(debugID, childDebugIDs);'
                    ]
                  ],
                  symbolAddr: null,
                  origLineNo: '?'
                },
                {
                  function: 'Object.mountComponent',
                  map: 'vendor.js.map',
                  colNo: 0,
                  vars: {},
                  symbol: null,
                  mapUrl: 'http://localhost:8000/_static/1503338242/sentry/dist/vendor.js.map',
                  module: 'Users/billy/Dev/sentry/~/react/lib/ReactReconciler',
                  origAbsPath: '?',
                  lineNo: 47,
                  origColNo: '?',
                  origFunction: '?',
                  errors: null,
                  package: null,
                  absPath: 'webpack:////Users/billy/Dev/sentry/~/react/lib/ReactReconciler.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '~/react/lib/ReactReconciler.js',
                  origFilename: '?',
                  platform: null,
                  context: [
                    [42, "    if (process.env.NODE_ENV !== 'production') {"],
                    [43, '      if (internalInstance._debugID !== 0) {'],
                    [
                      44,
                      '        ReactInstrumentation.debugTool.onBeforeMountComponent(internalInstance._debugID, internalInstance._currentElement, parentDebugID);'
                    ],
                    [45, '      }'],
                    [46, '    }'],
                    [
                      47,
                      '    var markup = internalInstance.mountComponent(transaction, hostParent, hostContainerInfo, context, parentDebugID);'
                    ],
                    [
                      48,
                      '    if (internalInstance._currentElement && internalInstance._currentElement.ref != null) {'
                    ],
                    [
                      49,
                      '      transaction.getReactMountReady().enqueue(attachRefs, internalInstance);'
                    ],
                    [50, '    }'],
                    [51, "    if (process.env.NODE_ENV !== 'production') {"],
                    [52, '      if (internalInstance._debugID !== 0) {']
                  ],
                  symbolAddr: null,
                  origLineNo: '?'
                },
                {
                  function: 'ReactDOMComponent.mountComponent',
                  map: 'vendor.js.map',
                  colNo: 0,
                  vars: {},
                  symbol: null,
                  mapUrl: 'http://localhost:8000/_static/1503338242/sentry/dist/vendor.js.map',
                  module: 'Users/billy/Dev/sentry/~/react/lib/ReactDOMComponent',
                  origAbsPath: '?',
                  lineNo: 524,
                  origColNo: '?',
                  origFunction: '?',
                  errors: null,
                  package: null,
                  absPath: 'webpack:////Users/billy/Dev/sentry/~/react/lib/ReactDOMComponent.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '~/react/lib/ReactDOMComponent.js',
                  origFilename: '?',
                  platform: null,
                  context: [
                    [519, '      if (!this._hostParent) {'],
                    [520, '        DOMPropertyOperations.setAttributeForRoot(el);'],
                    [521, '      }'],
                    [522, '      this._updateDOMProperties(null, props, transaction);'],
                    [523, '      var lazyTree = DOMLazyTree(el);'],
                    [
                      524,
                      '      this._createInitialChildren(transaction, props, context, lazyTree);'
                    ],
                    [525, '      mountImage = lazyTree;'],
                    [526, '    } else {'],
                    [
                      527,
                      '      var tagOpen = this._createOpenTagMarkupAndPutListeners(transaction, props);'
                    ],
                    [
                      528,
                      '      var tagContent = this._createContentMarkup(transaction, props, context);'
                    ],
                    [529, '      if (!tagContent && omittedCloseTags[this._tag]) {']
                  ],
                  symbolAddr: null,
                  origLineNo: '?'
                },
                {
                  function: 'ReactDOMComponent._createInitialChildren',
                  map: 'vendor.js.map',
                  colNo: 0,
                  vars: {},
                  symbol: null,
                  mapUrl: 'http://localhost:8000/_static/1503338242/sentry/dist/vendor.js.map',
                  module: 'Users/billy/Dev/sentry/~/react/lib/ReactDOMComponent',
                  origAbsPath: '?',
                  lineNo: 699,
                  origColNo: '?',
                  origFunction: '?',
                  errors: null,
                  package: null,
                  absPath: 'webpack:////Users/billy/Dev/sentry/~/react/lib/ReactDOMComponent.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '~/react/lib/ReactDOMComponent.js',
                  origFilename: '?',
                  platform: null,
                  context: [
                    [694, "        if (process.env.NODE_ENV !== 'production') {"],
                    [
                      695,
                      '          setAndValidateContentChildDev.call(this, contentToUse);'
                    ],
                    [696, '        }'],
                    [697, '        DOMLazyTree.queueText(lazyTree, contentToUse);'],
                    [698, '      } else if (childrenToUse != null) {'],
                    [
                      699,
                      '        var mountImages = this.mountChildren(childrenToUse, transaction, context);'
                    ],
                    [700, '        for (var i = 0; i < mountImages.length; i++) {'],
                    [701, '          DOMLazyTree.queueChild(lazyTree, mountImages[i]);'],
                    [702, '        }'],
                    [703, '      }'],
                    [704, '    }']
                  ],
                  symbolAddr: null,
                  origLineNo: '?'
                },
                {
                  function: 'ReactDOMComponent.mountChildren',
                  map: 'vendor.js.map',
                  colNo: 0,
                  vars: {},
                  symbol: null,
                  mapUrl: 'http://localhost:8000/_static/1503338242/sentry/dist/vendor.js.map',
                  module: 'Users/billy/Dev/sentry/~/react/lib/ReactMultiChild',
                  origAbsPath: '?',
                  lineNo: 240,
                  origColNo: '?',
                  origFunction: '?',
                  errors: null,
                  package: null,
                  absPath: 'webpack:////Users/billy/Dev/sentry/~/react/lib/ReactMultiChild.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '~/react/lib/ReactMultiChild.js',
                  origFilename: '?',
                  platform: null,
                  context: [
                    [235, '          var child = children[name];'],
                    [236, '          var selfDebugID = 0;'],
                    [237, "          if (process.env.NODE_ENV !== 'production') {"],
                    [238, '            selfDebugID = getDebugID(this);'],
                    [239, '          }'],
                    [
                      240,
                      '          var mountImage = ReactReconciler.mountComponent(child, transaction, this, this._hostContainerInfo, context, selfDebugID);'
                    ],
                    [241, '          child._mountIndex = index++;'],
                    [242, '          mountImages.push(mountImage);'],
                    [243, '        }'],
                    [244, '      }'],
                    [245, '']
                  ],
                  symbolAddr: null,
                  origLineNo: '?'
                },
                {
                  function: 'Object.mountComponent',
                  map: 'vendor.js.map',
                  colNo: 0,
                  vars: {},
                  symbol: null,
                  mapUrl: 'http://localhost:8000/_static/1503338242/sentry/dist/vendor.js.map',
                  module: 'Users/billy/Dev/sentry/~/react/lib/ReactReconciler',
                  origAbsPath: '?',
                  lineNo: 47,
                  origColNo: '?',
                  origFunction: '?',
                  errors: null,
                  package: null,
                  absPath: 'webpack:////Users/billy/Dev/sentry/~/react/lib/ReactReconciler.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '~/react/lib/ReactReconciler.js',
                  origFilename: '?',
                  platform: null,
                  context: [
                    [42, "    if (process.env.NODE_ENV !== 'production') {"],
                    [43, '      if (internalInstance._debugID !== 0) {'],
                    [
                      44,
                      '        ReactInstrumentation.debugTool.onBeforeMountComponent(internalInstance._debugID, internalInstance._currentElement, parentDebugID);'
                    ],
                    [45, '      }'],
                    [46, '    }'],
                    [
                      47,
                      '    var markup = internalInstance.mountComponent(transaction, hostParent, hostContainerInfo, context, parentDebugID);'
                    ],
                    [
                      48,
                      '    if (internalInstance._currentElement && internalInstance._currentElement.ref != null) {'
                    ],
                    [
                      49,
                      '      transaction.getReactMountReady().enqueue(attachRefs, internalInstance);'
                    ],
                    [50, '    }'],
                    [51, "    if (process.env.NODE_ENV !== 'production') {"],
                    [52, '      if (internalInstance._debugID !== 0) {']
                  ],
                  symbolAddr: null,
                  origLineNo: '?'
                },
                {
                  function: 'ReactDOMComponent.mountComponent',
                  map: 'vendor.js.map',
                  colNo: 0,
                  vars: {},
                  symbol: null,
                  mapUrl: 'http://localhost:8000/_static/1503338242/sentry/dist/vendor.js.map',
                  module: 'Users/billy/Dev/sentry/~/react/lib/ReactDOMComponent',
                  origAbsPath: '?',
                  lineNo: 524,
                  origColNo: '?',
                  origFunction: '?',
                  errors: null,
                  package: null,
                  absPath: 'webpack:////Users/billy/Dev/sentry/~/react/lib/ReactDOMComponent.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '~/react/lib/ReactDOMComponent.js',
                  origFilename: '?',
                  platform: null,
                  context: [
                    [519, '      if (!this._hostParent) {'],
                    [520, '        DOMPropertyOperations.setAttributeForRoot(el);'],
                    [521, '      }'],
                    [522, '      this._updateDOMProperties(null, props, transaction);'],
                    [523, '      var lazyTree = DOMLazyTree(el);'],
                    [
                      524,
                      '      this._createInitialChildren(transaction, props, context, lazyTree);'
                    ],
                    [525, '      mountImage = lazyTree;'],
                    [526, '    } else {'],
                    [
                      527,
                      '      var tagOpen = this._createOpenTagMarkupAndPutListeners(transaction, props);'
                    ],
                    [
                      528,
                      '      var tagContent = this._createContentMarkup(transaction, props, context);'
                    ],
                    [529, '      if (!tagContent && omittedCloseTags[this._tag]) {']
                  ],
                  symbolAddr: null,
                  origLineNo: '?'
                },
                {
                  function: 'ReactDOMComponent._createInitialChildren',
                  map: 'vendor.js.map',
                  colNo: 0,
                  vars: {},
                  symbol: null,
                  mapUrl: 'http://localhost:8000/_static/1503338242/sentry/dist/vendor.js.map',
                  module: 'Users/billy/Dev/sentry/~/react/lib/ReactDOMComponent',
                  origAbsPath: '?',
                  lineNo: 699,
                  origColNo: '?',
                  origFunction: '?',
                  errors: null,
                  package: null,
                  absPath: 'webpack:////Users/billy/Dev/sentry/~/react/lib/ReactDOMComponent.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '~/react/lib/ReactDOMComponent.js',
                  origFilename: '?',
                  platform: null,
                  context: [
                    [694, "        if (process.env.NODE_ENV !== 'production') {"],
                    [
                      695,
                      '          setAndValidateContentChildDev.call(this, contentToUse);'
                    ],
                    [696, '        }'],
                    [697, '        DOMLazyTree.queueText(lazyTree, contentToUse);'],
                    [698, '      } else if (childrenToUse != null) {'],
                    [
                      699,
                      '        var mountImages = this.mountChildren(childrenToUse, transaction, context);'
                    ],
                    [700, '        for (var i = 0; i < mountImages.length; i++) {'],
                    [701, '          DOMLazyTree.queueChild(lazyTree, mountImages[i]);'],
                    [702, '        }'],
                    [703, '      }'],
                    [704, '    }']
                  ],
                  symbolAddr: null,
                  origLineNo: '?'
                },
                {
                  function: 'ReactDOMComponent.mountChildren',
                  map: 'vendor.js.map',
                  colNo: 0,
                  vars: {},
                  symbol: null,
                  mapUrl: 'http://localhost:8000/_static/1503338242/sentry/dist/vendor.js.map',
                  module: 'Users/billy/Dev/sentry/~/react/lib/ReactMultiChild',
                  origAbsPath: '?',
                  lineNo: 240,
                  origColNo: '?',
                  origFunction: '?',
                  errors: null,
                  package: null,
                  absPath: 'webpack:////Users/billy/Dev/sentry/~/react/lib/ReactMultiChild.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '~/react/lib/ReactMultiChild.js',
                  origFilename: '?',
                  platform: null,
                  context: [
                    [235, '          var child = children[name];'],
                    [236, '          var selfDebugID = 0;'],
                    [237, "          if (process.env.NODE_ENV !== 'production') {"],
                    [238, '            selfDebugID = getDebugID(this);'],
                    [239, '          }'],
                    [
                      240,
                      '          var mountImage = ReactReconciler.mountComponent(child, transaction, this, this._hostContainerInfo, context, selfDebugID);'
                    ],
                    [241, '          child._mountIndex = index++;'],
                    [242, '          mountImages.push(mountImage);'],
                    [243, '        }'],
                    [244, '      }'],
                    [245, '']
                  ],
                  symbolAddr: null,
                  origLineNo: '?'
                },
                {
                  function: 'Object.mountComponent',
                  map: 'vendor.js.map',
                  colNo: 0,
                  vars: {},
                  symbol: null,
                  mapUrl: 'http://localhost:8000/_static/1503338242/sentry/dist/vendor.js.map',
                  module: 'Users/billy/Dev/sentry/~/react/lib/ReactReconciler',
                  origAbsPath: '?',
                  lineNo: 47,
                  origColNo: '?',
                  origFunction: '?',
                  errors: null,
                  package: null,
                  absPath: 'webpack:////Users/billy/Dev/sentry/~/react/lib/ReactReconciler.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '~/react/lib/ReactReconciler.js',
                  origFilename: '?',
                  platform: null,
                  context: [
                    [42, "    if (process.env.NODE_ENV !== 'production') {"],
                    [43, '      if (internalInstance._debugID !== 0) {'],
                    [
                      44,
                      '        ReactInstrumentation.debugTool.onBeforeMountComponent(internalInstance._debugID, internalInstance._currentElement, parentDebugID);'
                    ],
                    [45, '      }'],
                    [46, '    }'],
                    [
                      47,
                      '    var markup = internalInstance.mountComponent(transaction, hostParent, hostContainerInfo, context, parentDebugID);'
                    ],
                    [
                      48,
                      '    if (internalInstance._currentElement && internalInstance._currentElement.ref != null) {'
                    ],
                    [
                      49,
                      '      transaction.getReactMountReady().enqueue(attachRefs, internalInstance);'
                    ],
                    [50, '    }'],
                    [51, "    if (process.env.NODE_ENV !== 'production') {"],
                    [52, '      if (internalInstance._debugID !== 0) {']
                  ],
                  symbolAddr: null,
                  origLineNo: '?'
                },
                {
                  function: 'ReactDOMComponent.mountComponent',
                  map: 'vendor.js.map',
                  colNo: 0,
                  vars: {},
                  symbol: null,
                  mapUrl: 'http://localhost:8000/_static/1503338242/sentry/dist/vendor.js.map',
                  module: 'Users/billy/Dev/sentry/~/react/lib/ReactDOMComponent',
                  origAbsPath: '?',
                  lineNo: 524,
                  origColNo: '?',
                  origFunction: '?',
                  errors: null,
                  package: null,
                  absPath: 'webpack:////Users/billy/Dev/sentry/~/react/lib/ReactDOMComponent.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '~/react/lib/ReactDOMComponent.js',
                  origFilename: '?',
                  platform: null,
                  context: [
                    [519, '      if (!this._hostParent) {'],
                    [520, '        DOMPropertyOperations.setAttributeForRoot(el);'],
                    [521, '      }'],
                    [522, '      this._updateDOMProperties(null, props, transaction);'],
                    [523, '      var lazyTree = DOMLazyTree(el);'],
                    [
                      524,
                      '      this._createInitialChildren(transaction, props, context, lazyTree);'
                    ],
                    [525, '      mountImage = lazyTree;'],
                    [526, '    } else {'],
                    [
                      527,
                      '      var tagOpen = this._createOpenTagMarkupAndPutListeners(transaction, props);'
                    ],
                    [
                      528,
                      '      var tagContent = this._createContentMarkup(transaction, props, context);'
                    ],
                    [529, '      if (!tagContent && omittedCloseTags[this._tag]) {']
                  ],
                  symbolAddr: null,
                  origLineNo: '?'
                },
                {
                  function: 'ReactDOMComponent._createInitialChildren',
                  map: 'vendor.js.map',
                  colNo: 0,
                  vars: {},
                  symbol: null,
                  mapUrl: 'http://localhost:8000/_static/1503338242/sentry/dist/vendor.js.map',
                  module: 'Users/billy/Dev/sentry/~/react/lib/ReactDOMComponent',
                  origAbsPath: '?',
                  lineNo: 699,
                  origColNo: '?',
                  origFunction: '?',
                  errors: null,
                  package: null,
                  absPath: 'webpack:////Users/billy/Dev/sentry/~/react/lib/ReactDOMComponent.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '~/react/lib/ReactDOMComponent.js',
                  origFilename: '?',
                  platform: null,
                  context: [
                    [694, "        if (process.env.NODE_ENV !== 'production') {"],
                    [
                      695,
                      '          setAndValidateContentChildDev.call(this, contentToUse);'
                    ],
                    [696, '        }'],
                    [697, '        DOMLazyTree.queueText(lazyTree, contentToUse);'],
                    [698, '      } else if (childrenToUse != null) {'],
                    [
                      699,
                      '        var mountImages = this.mountChildren(childrenToUse, transaction, context);'
                    ],
                    [700, '        for (var i = 0; i < mountImages.length; i++) {'],
                    [701, '          DOMLazyTree.queueChild(lazyTree, mountImages[i]);'],
                    [702, '        }'],
                    [703, '      }'],
                    [704, '    }']
                  ],
                  symbolAddr: null,
                  origLineNo: '?'
                },
                {
                  function: 'ReactDOMComponent.mountChildren',
                  map: 'vendor.js.map',
                  colNo: 0,
                  vars: {},
                  symbol: null,
                  mapUrl: 'http://localhost:8000/_static/1503338242/sentry/dist/vendor.js.map',
                  module: 'Users/billy/Dev/sentry/~/react/lib/ReactMultiChild',
                  origAbsPath: '?',
                  lineNo: 240,
                  origColNo: '?',
                  origFunction: '?',
                  errors: null,
                  package: null,
                  absPath: 'webpack:////Users/billy/Dev/sentry/~/react/lib/ReactMultiChild.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '~/react/lib/ReactMultiChild.js',
                  origFilename: '?',
                  platform: null,
                  context: [
                    [235, '          var child = children[name];'],
                    [236, '          var selfDebugID = 0;'],
                    [237, "          if (process.env.NODE_ENV !== 'production') {"],
                    [238, '            selfDebugID = getDebugID(this);'],
                    [239, '          }'],
                    [
                      240,
                      '          var mountImage = ReactReconciler.mountComponent(child, transaction, this, this._hostContainerInfo, context, selfDebugID);'
                    ],
                    [241, '          child._mountIndex = index++;'],
                    [242, '          mountImages.push(mountImage);'],
                    [243, '        }'],
                    [244, '      }'],
                    [245, '']
                  ],
                  symbolAddr: null,
                  origLineNo: '?'
                },
                {
                  function: 'Object.mountComponent',
                  map: 'vendor.js.map',
                  colNo: 0,
                  vars: {},
                  symbol: null,
                  mapUrl: 'http://localhost:8000/_static/1503338242/sentry/dist/vendor.js.map',
                  module: 'Users/billy/Dev/sentry/~/react/lib/ReactReconciler',
                  origAbsPath: '?',
                  lineNo: 47,
                  origColNo: '?',
                  origFunction: '?',
                  errors: null,
                  package: null,
                  absPath: 'webpack:////Users/billy/Dev/sentry/~/react/lib/ReactReconciler.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '~/react/lib/ReactReconciler.js',
                  origFilename: '?',
                  platform: null,
                  context: [
                    [42, "    if (process.env.NODE_ENV !== 'production') {"],
                    [43, '      if (internalInstance._debugID !== 0) {'],
                    [
                      44,
                      '        ReactInstrumentation.debugTool.onBeforeMountComponent(internalInstance._debugID, internalInstance._currentElement, parentDebugID);'
                    ],
                    [45, '      }'],
                    [46, '    }'],
                    [
                      47,
                      '    var markup = internalInstance.mountComponent(transaction, hostParent, hostContainerInfo, context, parentDebugID);'
                    ],
                    [
                      48,
                      '    if (internalInstance._currentElement && internalInstance._currentElement.ref != null) {'
                    ],
                    [
                      49,
                      '      transaction.getReactMountReady().enqueue(attachRefs, internalInstance);'
                    ],
                    [50, '    }'],
                    [51, "    if (process.env.NODE_ENV !== 'production') {"],
                    [52, '      if (internalInstance._debugID !== 0) {']
                  ],
                  symbolAddr: null,
                  origLineNo: '?'
                },
                {
                  function: 'ReactCompositeComponentWrapper.mountComponent',
                  map: 'vendor.js.map',
                  colNo: 0,
                  vars: {},
                  symbol: null,
                  mapUrl: 'http://localhost:8000/_static/1503338242/sentry/dist/vendor.js.map',
                  module: 'Users/billy/Dev/sentry/~/react/lib/ReactCompositeComponent',
                  origAbsPath: '?',
                  lineNo: 257,
                  origColNo: '?',
                  origFunction: '?',
                  errors: null,
                  package: null,
                  absPath: 'webpack:////Users/billy/Dev/sentry/~/react/lib/ReactCompositeComponent.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '~/react/lib/ReactCompositeComponent.js',
                  origFilename: '?',
                  platform: null,
                  context: [
                    [252, ''],
                    [253, '    var markup;'],
                    [254, '    if (inst.unstable_handleError) {'],
                    [
                      255,
                      '      markup = this.performInitialMountWithErrorHandling(renderedElement, hostParent, hostContainerInfo, transaction, context);'
                    ],
                    [256, '    } else {'],
                    [
                      257,
                      '      markup = this.performInitialMount(renderedElement, hostParent, hostContainerInfo, transaction, context);'
                    ],
                    [258, '    }'],
                    [259, ''],
                    [260, '    if (inst.componentDidMount) {'],
                    [261, "      if (process.env.NODE_ENV !== 'production') {"],
                    [
                      262,
                      '        transaction.getReactMountReady().enqueue(function () {'
                    ]
                  ],
                  symbolAddr: null,
                  origLineNo: '?'
                },
                {
                  function: 'ReactCompositeComponentWrapper.performInitialMount',
                  map: 'vendor.js.map',
                  colNo: 0,
                  vars: {},
                  symbol: null,
                  mapUrl: 'http://localhost:8000/_static/1503338242/sentry/dist/vendor.js.map',
                  module: 'Users/billy/Dev/sentry/~/react/lib/ReactCompositeComponent',
                  origAbsPath: '?',
                  lineNo: 370,
                  origColNo: '?',
                  origFunction: '?',
                  errors: null,
                  package: null,
                  absPath: 'webpack:////Users/billy/Dev/sentry/~/react/lib/ReactCompositeComponent.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '~/react/lib/ReactCompositeComponent.js',
                  origFilename: '?',
                  platform: null,
                  context: [
                    [365, '    this._renderedNodeType = nodeType;'],
                    [
                      366,
                      '    var child = this._instantiateReactComponent(renderedElement, nodeType !== ReactNodeTypes.EMPTY /* shouldHaveDebugID */'
                    ],
                    [367, '    );'],
                    [368, '    this._renderedComponent = child;'],
                    [369, ''],
                    [
                      370,
                      '    var markup = ReactReconciler.mountComponent(child, transaction, hostParent, hostContainerInfo, this._processChildContext(context), debugID);'
                    ],
                    [371, ''],
                    [372, "    if (process.env.NODE_ENV !== 'production') {"],
                    [373, '      if (debugID !== 0) {'],
                    [
                      374,
                      '        var childDebugIDs = child._debugID !== 0 ? [child._debugID] : [];'
                    ],
                    [
                      375,
                      '        ReactInstrumentation.debugTool.onSetChildren(debugID, childDebugIDs);'
                    ]
                  ],
                  symbolAddr: null,
                  origLineNo: '?'
                },
                {
                  function: 'Object.mountComponent',
                  map: 'vendor.js.map',
                  colNo: 0,
                  vars: {},
                  symbol: null,
                  mapUrl: 'http://localhost:8000/_static/1503338242/sentry/dist/vendor.js.map',
                  module: 'Users/billy/Dev/sentry/~/react/lib/ReactReconciler',
                  origAbsPath: '?',
                  lineNo: 47,
                  origColNo: '?',
                  origFunction: '?',
                  errors: null,
                  package: null,
                  absPath: 'webpack:////Users/billy/Dev/sentry/~/react/lib/ReactReconciler.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '~/react/lib/ReactReconciler.js',
                  origFilename: '?',
                  platform: null,
                  context: [
                    [42, "    if (process.env.NODE_ENV !== 'production') {"],
                    [43, '      if (internalInstance._debugID !== 0) {'],
                    [
                      44,
                      '        ReactInstrumentation.debugTool.onBeforeMountComponent(internalInstance._debugID, internalInstance._currentElement, parentDebugID);'
                    ],
                    [45, '      }'],
                    [46, '    }'],
                    [
                      47,
                      '    var markup = internalInstance.mountComponent(transaction, hostParent, hostContainerInfo, context, parentDebugID);'
                    ],
                    [
                      48,
                      '    if (internalInstance._currentElement && internalInstance._currentElement.ref != null) {'
                    ],
                    [
                      49,
                      '      transaction.getReactMountReady().enqueue(attachRefs, internalInstance);'
                    ],
                    [50, '    }'],
                    [51, "    if (process.env.NODE_ENV !== 'production') {"],
                    [52, '      if (internalInstance._debugID !== 0) {']
                  ],
                  symbolAddr: null,
                  origLineNo: '?'
                },
                {
                  function: 'ReactDOMComponent.mountComponent',
                  map: 'vendor.js.map',
                  colNo: 0,
                  vars: {},
                  symbol: null,
                  mapUrl: 'http://localhost:8000/_static/1503338242/sentry/dist/vendor.js.map',
                  module: 'Users/billy/Dev/sentry/~/react/lib/ReactDOMComponent',
                  origAbsPath: '?',
                  lineNo: 524,
                  origColNo: '?',
                  origFunction: '?',
                  errors: null,
                  package: null,
                  absPath: 'webpack:////Users/billy/Dev/sentry/~/react/lib/ReactDOMComponent.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '~/react/lib/ReactDOMComponent.js',
                  origFilename: '?',
                  platform: null,
                  context: [
                    [519, '      if (!this._hostParent) {'],
                    [520, '        DOMPropertyOperations.setAttributeForRoot(el);'],
                    [521, '      }'],
                    [522, '      this._updateDOMProperties(null, props, transaction);'],
                    [523, '      var lazyTree = DOMLazyTree(el);'],
                    [
                      524,
                      '      this._createInitialChildren(transaction, props, context, lazyTree);'
                    ],
                    [525, '      mountImage = lazyTree;'],
                    [526, '    } else {'],
                    [
                      527,
                      '      var tagOpen = this._createOpenTagMarkupAndPutListeners(transaction, props);'
                    ],
                    [
                      528,
                      '      var tagContent = this._createContentMarkup(transaction, props, context);'
                    ],
                    [529, '      if (!tagContent && omittedCloseTags[this._tag]) {']
                  ],
                  symbolAddr: null,
                  origLineNo: '?'
                },
                {
                  function: 'ReactDOMComponent._createInitialChildren',
                  map: 'vendor.js.map',
                  colNo: 0,
                  vars: {},
                  symbol: null,
                  mapUrl: 'http://localhost:8000/_static/1503338242/sentry/dist/vendor.js.map',
                  module: 'Users/billy/Dev/sentry/~/react/lib/ReactDOMComponent',
                  origAbsPath: '?',
                  lineNo: 699,
                  origColNo: '?',
                  origFunction: '?',
                  errors: null,
                  package: null,
                  absPath: 'webpack:////Users/billy/Dev/sentry/~/react/lib/ReactDOMComponent.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '~/react/lib/ReactDOMComponent.js',
                  origFilename: '?',
                  platform: null,
                  context: [
                    [694, "        if (process.env.NODE_ENV !== 'production') {"],
                    [
                      695,
                      '          setAndValidateContentChildDev.call(this, contentToUse);'
                    ],
                    [696, '        }'],
                    [697, '        DOMLazyTree.queueText(lazyTree, contentToUse);'],
                    [698, '      } else if (childrenToUse != null) {'],
                    [
                      699,
                      '        var mountImages = this.mountChildren(childrenToUse, transaction, context);'
                    ],
                    [700, '        for (var i = 0; i < mountImages.length; i++) {'],
                    [701, '          DOMLazyTree.queueChild(lazyTree, mountImages[i]);'],
                    [702, '        }'],
                    [703, '      }'],
                    [704, '    }']
                  ],
                  symbolAddr: null,
                  origLineNo: '?'
                },
                {
                  function: 'ReactDOMComponent.mountChildren',
                  map: 'vendor.js.map',
                  colNo: 0,
                  vars: {},
                  symbol: null,
                  mapUrl: 'http://localhost:8000/_static/1503338242/sentry/dist/vendor.js.map',
                  module: 'Users/billy/Dev/sentry/~/react/lib/ReactMultiChild',
                  origAbsPath: '?',
                  lineNo: 240,
                  origColNo: '?',
                  origFunction: '?',
                  errors: null,
                  package: null,
                  absPath: 'webpack:////Users/billy/Dev/sentry/~/react/lib/ReactMultiChild.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '~/react/lib/ReactMultiChild.js',
                  origFilename: '?',
                  platform: null,
                  context: [
                    [235, '          var child = children[name];'],
                    [236, '          var selfDebugID = 0;'],
                    [237, "          if (process.env.NODE_ENV !== 'production') {"],
                    [238, '            selfDebugID = getDebugID(this);'],
                    [239, '          }'],
                    [
                      240,
                      '          var mountImage = ReactReconciler.mountComponent(child, transaction, this, this._hostContainerInfo, context, selfDebugID);'
                    ],
                    [241, '          child._mountIndex = index++;'],
                    [242, '          mountImages.push(mountImage);'],
                    [243, '        }'],
                    [244, '      }'],
                    [245, '']
                  ],
                  symbolAddr: null,
                  origLineNo: '?'
                },
                {
                  function: 'Object.mountComponent',
                  map: 'vendor.js.map',
                  colNo: 0,
                  vars: {},
                  symbol: null,
                  mapUrl: 'http://localhost:8000/_static/1503338242/sentry/dist/vendor.js.map',
                  module: 'Users/billy/Dev/sentry/~/react/lib/ReactReconciler',
                  origAbsPath: '?',
                  lineNo: 47,
                  origColNo: '?',
                  origFunction: '?',
                  errors: null,
                  package: null,
                  absPath: 'webpack:////Users/billy/Dev/sentry/~/react/lib/ReactReconciler.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '~/react/lib/ReactReconciler.js',
                  origFilename: '?',
                  platform: null,
                  context: [
                    [42, "    if (process.env.NODE_ENV !== 'production') {"],
                    [43, '      if (internalInstance._debugID !== 0) {'],
                    [
                      44,
                      '        ReactInstrumentation.debugTool.onBeforeMountComponent(internalInstance._debugID, internalInstance._currentElement, parentDebugID);'
                    ],
                    [45, '      }'],
                    [46, '    }'],
                    [
                      47,
                      '    var markup = internalInstance.mountComponent(transaction, hostParent, hostContainerInfo, context, parentDebugID);'
                    ],
                    [
                      48,
                      '    if (internalInstance._currentElement && internalInstance._currentElement.ref != null) {'
                    ],
                    [
                      49,
                      '      transaction.getReactMountReady().enqueue(attachRefs, internalInstance);'
                    ],
                    [50, '    }'],
                    [51, "    if (process.env.NODE_ENV !== 'production') {"],
                    [52, '      if (internalInstance._debugID !== 0) {']
                  ],
                  symbolAddr: null,
                  origLineNo: '?'
                },
                {
                  function: 'ReactCompositeComponentWrapper.mountComponent',
                  map: 'vendor.js.map',
                  colNo: 0,
                  vars: {},
                  symbol: null,
                  mapUrl: 'http://localhost:8000/_static/1503338242/sentry/dist/vendor.js.map',
                  module: 'Users/billy/Dev/sentry/~/react/lib/ReactCompositeComponent',
                  origAbsPath: '?',
                  lineNo: 257,
                  origColNo: '?',
                  origFunction: '?',
                  errors: null,
                  package: null,
                  absPath: 'webpack:////Users/billy/Dev/sentry/~/react/lib/ReactCompositeComponent.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '~/react/lib/ReactCompositeComponent.js',
                  origFilename: '?',
                  platform: null,
                  context: [
                    [252, ''],
                    [253, '    var markup;'],
                    [254, '    if (inst.unstable_handleError) {'],
                    [
                      255,
                      '      markup = this.performInitialMountWithErrorHandling(renderedElement, hostParent, hostContainerInfo, transaction, context);'
                    ],
                    [256, '    } else {'],
                    [
                      257,
                      '      markup = this.performInitialMount(renderedElement, hostParent, hostContainerInfo, transaction, context);'
                    ],
                    [258, '    }'],
                    [259, ''],
                    [260, '    if (inst.componentDidMount) {'],
                    [261, "      if (process.env.NODE_ENV !== 'production') {"],
                    [
                      262,
                      '        transaction.getReactMountReady().enqueue(function () {'
                    ]
                  ],
                  symbolAddr: null,
                  origLineNo: '?'
                },
                {
                  function: 'ReactCompositeComponentWrapper.performInitialMount',
                  map: 'vendor.js.map',
                  colNo: 0,
                  vars: {},
                  symbol: null,
                  mapUrl: 'http://localhost:8000/_static/1503338242/sentry/dist/vendor.js.map',
                  module: 'Users/billy/Dev/sentry/~/react/lib/ReactCompositeComponent',
                  origAbsPath: '?',
                  lineNo: 361,
                  origColNo: '?',
                  origFunction: '?',
                  errors: null,
                  package: null,
                  absPath: 'webpack:////Users/billy/Dev/sentry/~/react/lib/ReactCompositeComponent.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '~/react/lib/ReactCompositeComponent.js',
                  origFilename: '?',
                  platform: null,
                  context: [
                    [356, '      }'],
                    [357, '    }'],
                    [358, ''],
                    [359, '    // If not a stateless component, we now render'],
                    [360, '    if (renderedElement === undefined) {'],
                    [361, '      renderedElement = this._renderValidatedComponent();'],
                    [362, '    }'],
                    [363, ''],
                    [364, '    var nodeType = ReactNodeTypes.getType(renderedElement);'],
                    [365, '    this._renderedNodeType = nodeType;'],
                    [
                      366,
                      '    var child = this._instantiateReactComponent(renderedElement, nodeType !== ReactNodeTypes.EMPTY /* shouldHaveDebugID */'
                    ]
                  ],
                  symbolAddr: null,
                  origLineNo: '?'
                },
                {
                  function: 'ReactCompositeComponentWrapper._renderValidatedComponent',
                  map: 'vendor.js.map',
                  colNo: 0,
                  vars: {},
                  symbol: null,
                  mapUrl: 'http://localhost:8000/_static/1503338242/sentry/dist/vendor.js.map',
                  module: 'Users/billy/Dev/sentry/~/react/lib/ReactCompositeComponent',
                  origAbsPath: '?',
                  lineNo: 819,
                  origColNo: '?',
                  origFunction: '?',
                  errors: null,
                  package: null,
                  absPath: 'webpack:////Users/billy/Dev/sentry/~/react/lib/ReactCompositeComponent.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '~/react/lib/ReactCompositeComponent.js',
                  origFilename: '?',
                  platform: null,
                  context: [
                    [814, '  _renderValidatedComponent: function () {'],
                    [815, '    var renderedComponent;'],
                    [
                      816,
                      "    if (process.env.NODE_ENV !== 'production' || this._compositeType !== CompositeTypes.StatelessFunctional) {"
                    ],
                    [817, '      ReactCurrentOwner.current = this;'],
                    [818, '      try {'],
                    [
                      819,
                      '        renderedComponent = this._renderValidatedComponentWithoutOwnerOrContext();'
                    ],
                    [820, '      } finally {'],
                    [821, '        ReactCurrentOwner.current = null;'],
                    [822, '      }'],
                    [823, '    } else {'],
                    [
                      824,
                      '      renderedComponent = this._renderValidatedComponentWithoutOwnerOrContext();'
                    ]
                  ],
                  symbolAddr: null,
                  origLineNo: '?'
                },
                {
                  function: 'ReactCompositeComponentWrapper._renderValidatedComponentWithoutOwnerOrContext',
                  map: 'vendor.js.map',
                  colNo: 0,
                  vars: {},
                  symbol: null,
                  mapUrl: 'http://localhost:8000/_static/1503338242/sentry/dist/vendor.js.map',
                  module: 'Users/billy/Dev/sentry/~/react/lib/ReactCompositeComponent',
                  origAbsPath: '?',
                  lineNo: 792,
                  origColNo: '?',
                  origFunction: '?',
                  errors: null,
                  package: null,
                  absPath: 'webpack:////Users/billy/Dev/sentry/~/react/lib/ReactCompositeComponent.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '~/react/lib/ReactCompositeComponent.js',
                  origFilename: '?',
                  platform: null,
                  context: [
                    [
                      787,
                      '  _renderValidatedComponentWithoutOwnerOrContext: function () {'
                    ],
                    [788, '    var inst = this._instance;'],
                    [789, '    var renderedComponent;'],
                    [790, ''],
                    [791, "    if (process.env.NODE_ENV !== 'production') {"],
                    [792, '      renderedComponent = measureLifeCyclePerf(function () {'],
                    [793, '        return inst.render();'],
                    [794, "      }, this._debugID, 'render');"],
                    [795, '    } else {'],
                    [796, '      renderedComponent = inst.render();'],
                    [797, '    }']
                  ],
                  symbolAddr: null,
                  origLineNo: '?'
                },
                {
                  function: 'measureLifeCyclePerf',
                  map: 'vendor.js.map',
                  colNo: 0,
                  vars: {},
                  symbol: null,
                  mapUrl: 'http://localhost:8000/_static/1503338242/sentry/dist/vendor.js.map',
                  module: 'Users/billy/Dev/sentry/~/react/lib/ReactCompositeComponent',
                  origAbsPath: '?',
                  lineNo: 74,
                  origColNo: '?',
                  origFunction: '?',
                  errors: null,
                  package: null,
                  absPath: 'webpack:////Users/billy/Dev/sentry/~/react/lib/ReactCompositeComponent.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '~/react/lib/ReactCompositeComponent.js',
                  origFilename: '?',
                  platform: null,
                  context: [
                    [69, '    return fn();'],
                    [70, '  }'],
                    [71, ''],
                    [
                      72,
                      '  ReactInstrumentation.debugTool.onBeginLifeCycleTimer(debugID, timerType);'
                    ],
                    [73, '  try {'],
                    [74, '    return fn();'],
                    [75, '  } finally {'],
                    [
                      76,
                      '    ReactInstrumentation.debugTool.onEndLifeCycleTimer(debugID, timerType);'
                    ],
                    [77, '  }'],
                    [78, '}'],
                    [79, '']
                  ],
                  symbolAddr: null,
                  origLineNo: '?'
                },
                {
                  function: null,
                  map: 'vendor.js.map',
                  colNo: 0,
                  vars: {},
                  symbol: null,
                  mapUrl: 'http://localhost:8000/_static/1503338242/sentry/dist/vendor.js.map',
                  module: 'Users/billy/Dev/sentry/~/react/lib/ReactCompositeComponent',
                  origAbsPath: '?',
                  lineNo: 793,
                  origColNo: '?',
                  origFunction: '?',
                  errors: null,
                  package: null,
                  absPath: 'webpack:////Users/billy/Dev/sentry/~/react/lib/ReactCompositeComponent.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '~/react/lib/ReactCompositeComponent.js',
                  origFilename: '?',
                  platform: null,
                  context: [
                    [788, '    var inst = this._instance;'],
                    [789, '    var renderedComponent;'],
                    [790, ''],
                    [791, "    if (process.env.NODE_ENV !== 'production') {"],
                    [792, '      renderedComponent = measureLifeCyclePerf(function () {'],
                    [793, '        return inst.render();'],
                    [794, "      }, this._debugID, 'render');"],
                    [795, '    } else {'],
                    [796, '      renderedComponent = inst.render();'],
                    [797, '    }'],
                    [798, '']
                  ],
                  symbolAddr: null,
                  origLineNo: '?'
                },
                {
                  function: 'Constructor.render',
                  map: 'app.js.map',
                  colNo: 0,
                  vars: {},
                  symbol: null,
                  mapUrl: 'http://localhost:8000/_static/1503338242/sentry/dist/app.js.map',
                  module: 'app/components/scoreBar',
                  origAbsPath: '?',
                  lineNo: 73,
                  origColNo: '?',
                  origFunction: '?',
                  errors: null,
                  package: null,
                  absPath: 'webpack:///./app/components/scoreBar.jsx',
                  inApp: true,
                  instructionAddr: null,
                  filename: './app/components/scoreBar.jsx',
                  origFilename: '?',
                  platform: null,
                  context: [
                    [
                      68,
                      "        var paletteClassName = useCss && paletteClassNames[paletteIndex] || '';"
                    ],
                    [
                      69,
                      "        var barCx = classNames('score-bar-bar', _defineProperty({}, paletteClassName, !!paletteClassName));"
                    ],
                    [
                      70,
                      "        return React.createElement('div', { key: i, style: style, className: barCx });"
                    ],
                    [71, '      }),'],
                    [
                      72,
                      '      [].concat(_toConsumableArray(Array(maxScore - paletteIndex))).map(function (j, i) {'
                    ],
                    [73, "        return React.createElement('div', {"],
                    [74, '          style: _extends({}, sizeStyle),'],
                    [75, "          key: 'empty-' + i,"],
                    [76, "          className: 'score-bar-bar empty'"],
                    [77, '        });'],
                    [78, '      })']
                  ],
                  symbolAddr: null,
                  origLineNo: '?'
                }
              ],
              framesOmitted: null,
              registers: null,
              hasSystemFrames: true
            },
            module: null,
            rawStacktrace: {
              frames: [
                {
                  function: 'ReactCompositeComponentWrapper._updateRenderedComponent',
                  colNo: 23,
                  vars: {},
                  symbol: null,
                  module: null,
                  lineNo: 74227,
                  errors: null,
                  package: null,
                  absPath: 'http://localhost:8000/_static/1503338242/sentry/dist/vendor.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '/_static/1503338242/sentry/dist/vendor.js',
                  platform: null,
                  context: [
                    [74222, "    if (undefined !== 'production') {"],
                    [74223, '      debugID = this._debugID;'],
                    [74224, '    }'],
                    [74225, ''],
                    [
                      74226,
                      '    if (shouldUpdateReactComponent(prevRenderedElement, nextRenderedElement)) {'
                    ],
                    [
                      74227,
                      '      ReactReconciler.receiveComponent(prevComponentInstance, nextRenderedElement, transaction, this._processChildContext(context));'
                    ],
                    [74228, '    } else {'],
                    [
                      74229,
                      '      var oldHostNode = ReactReconciler.getHostNode(prevComponentInstance);'
                    ],
                    [
                      74230,
                      '      ReactReconciler.unmountComponent(prevComponentInstance, false);'
                    ],
                    [74231, ''],
                    [
                      74232,
                      '      var nodeType = ReactNodeTypes.getType(nextRenderedElement);'
                    ]
                  ],
                  symbolAddr: null
                },
                {
                  function: 'Object.receiveComponent',
                  colNo: 22,
                  vars: {},
                  symbol: null,
                  module: null,
                  lineNo: 17867,
                  errors: null,
                  package: null,
                  absPath: 'http://localhost:8000/_static/1503338242/sentry/dist/vendor.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '/_static/1503338242/sentry/dist/vendor.js',
                  platform: null,
                  context: [
                    [17862, ''],
                    [17863, '    if (refsChanged) {'],
                    [17864, '      ReactRef.detachRefs(internalInstance, prevElement);'],
                    [17865, '    }'],
                    [17866, ''],
                    [
                      17867,
                      '    internalInstance.receiveComponent(nextElement, transaction, context);'
                    ],
                    [17868, ''],
                    [
                      17869,
                      '    if (refsChanged && internalInstance._currentElement && internalInstance._currentElement.ref != null) {'
                    ],
                    [
                      17870,
                      '      transaction.getReactMountReady().enqueue(attachRefs, internalInstance);'
                    ],
                    [17871, '    }'],
                    [17872, '']
                  ],
                  symbolAddr: null
                },
                {
                  function: 'ReactDOMComponent.receiveComponent',
                  colNo: 10,
                  vars: {},
                  symbol: null,
                  module: null,
                  lineNo: 75144,
                  errors: null,
                  package: null,
                  absPath: 'http://localhost:8000/_static/1503338242/sentry/dist/vendor.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '/_static/1503338242/sentry/dist/vendor.js',
                  platform: null,
                  context: [
                    [75139, '   * @param {object} context'],
                    [75140, '   */'],
                    [
                      75141,
                      '  receiveComponent: function (nextElement, transaction, context) {'
                    ],
                    [75142, '    var prevElement = this._currentElement;'],
                    [75143, '    this._currentElement = nextElement;'],
                    [
                      75144,
                      '    this.updateComponent(transaction, prevElement, nextElement, context);'
                    ],
                    [75145, '  },'],
                    [75146, ''],
                    [75147, '  /**'],
                    [
                      75148,
                      '   * Updates a DOM component after it has already been allocated and'
                    ],
                    [
                      75149,
                      '   * attached to the DOM. Reconciles the root DOM node, then recurses.'
                    ]
                  ],
                  symbolAddr: null
                },
                {
                  function: 'ReactDOMComponent.updateComponent',
                  colNo: 10,
                  vars: {},
                  symbol: null,
                  module: null,
                  lineNo: 75186,
                  errors: null,
                  package: null,
                  absPath: 'http://localhost:8000/_static/1503338242/sentry/dist/vendor.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '/_static/1503338242/sentry/dist/vendor.js',
                  platform: null,
                  context: [
                    [75181, '        break;'],
                    [75182, '    }'],
                    [75183, ''],
                    [75184, '    assertValidProps(this, nextProps);'],
                    [
                      75185,
                      '    this._updateDOMProperties(lastProps, nextProps, transaction);'
                    ],
                    [
                      75186,
                      '    this._updateDOMChildren(lastProps, nextProps, transaction, context);'
                    ],
                    [75187, ''],
                    [75188, '    switch (this._tag) {'],
                    [75189, "      case 'input':"],
                    [
                      75190,
                      '        // Update the wrapper around inputs *after* updating props. This has to'
                    ],
                    [
                      75191,
                      '        // happen after `_updateDOMProperties`. Otherwise HTML5 input validations'
                    ]
                  ],
                  symbolAddr: null
                },
                {
                  function: 'ReactDOMComponent._updateDOMChildren',
                  colNo: 12,
                  vars: {},
                  symbol: null,
                  module: null,
                  lineNo: 75368,
                  errors: null,
                  package: null,
                  absPath: 'http://localhost:8000/_static/1503338242/sentry/dist/vendor.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '/_static/1503338242/sentry/dist/vendor.js',
                  platform: null,
                  context: [
                    [75363, '    } else if (nextChildren != null) {'],
                    [75364, "      if (undefined !== 'production') {"],
                    [75365, '        setAndValidateContentChildDev.call(this, null);'],
                    [75366, '      }'],
                    [75367, ''],
                    [
                      75368,
                      '      this.updateChildren(nextChildren, transaction, context);'
                    ],
                    [75369, '    }'],
                    [75370, '  },'],
                    [75371, ''],
                    [75372, '  getHostNode: function () {'],
                    [75373, '    return getNode(this);']
                  ],
                  symbolAddr: null
                },
                {
                  function: 'ReactDOMComponent.updateChildren',
                  colNo: 12,
                  vars: {},
                  symbol: null,
                  module: null,
                  lineNo: 78075,
                  errors: null,
                  package: null,
                  absPath: 'http://localhost:8000/_static/1503338242/sentry/dist/vendor.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '/_static/1503338242/sentry/dist/vendor.js',
                  platform: null,
                  context: [
                    [78070, '     * @param {ReactReconcileTransaction} transaction'],
                    [78071, '     * @internal'],
                    [78072, '     */'],
                    [
                      78073,
                      '    updateChildren: function (nextNestedChildrenElements, transaction, context) {'
                    ],
                    [78074, '      // Hook used by React ART'],
                    [
                      78075,
                      '      this._updateChildren(nextNestedChildrenElements, transaction, context);'
                    ],
                    [78076, '    },'],
                    [78077, ''],
                    [78078, '    /**'],
                    [
                      78079,
                      '     * @param {?object} nextNestedChildrenElements Nested child element maps.'
                    ],
                    [78080, '     * @param {ReactReconcileTransaction} transaction']
                  ],
                  symbolAddr: null
                },
                {
                  function: 'ReactDOMComponent._updateChildren',
                  colNo: 31,
                  vars: {},
                  symbol: null,
                  module: null,
                  lineNo: 78088,
                  errors: null,
                  package: null,
                  absPath: 'http://localhost:8000/_static/1503338242/sentry/dist/vendor.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '/_static/1503338242/sentry/dist/vendor.js',
                  platform: null,
                  context: [
                    [78083, '     */'],
                    [
                      78084,
                      '    _updateChildren: function (nextNestedChildrenElements, transaction, context) {'
                    ],
                    [78085, '      var prevChildren = this._renderedChildren;'],
                    [78086, '      var removedNodes = {};'],
                    [78087, '      var mountImages = [];'],
                    [
                      78088,
                      '      var nextChildren = this._reconcilerUpdateChildren(prevChildren, nextNestedChildrenElements, mountImages, removedNodes, transaction, context);'
                    ],
                    [78089, '      if (!nextChildren && !prevChildren) {'],
                    [78090, '        return;'],
                    [78091, '      }'],
                    [78092, '      var updates = null;'],
                    [78093, '      var name;']
                  ],
                  symbolAddr: null
                },
                {
                  function: 'ReactDOMComponent._reconcilerUpdateChildren',
                  colNo: 32,
                  vars: {},
                  symbol: null,
                  module: null,
                  lineNo: 77984,
                  errors: null,
                  package: null,
                  absPath: 'http://localhost:8000/_static/1503338242/sentry/dist/vendor.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '/_static/1503338242/sentry/dist/vendor.js',
                  platform: null,
                  context: [
                    [
                      77979,
                      '            ReactCurrentOwner.current = this._currentElement._owner;'
                    ],
                    [
                      77980,
                      '            nextChildren = flattenChildren(nextNestedChildrenElements, selfDebugID);'
                    ],
                    [77981, '          } finally {'],
                    [77982, '            ReactCurrentOwner.current = null;'],
                    [77983, '          }'],
                    [
                      77984,
                      '          ReactChildReconciler.updateChildren(prevChildren, nextChildren, mountImages, removedNodes, transaction, this, this._hostContainerI {snip}'
                    ],
                    [77985, '          return nextChildren;'],
                    [77986, '        }'],
                    [77987, '      }'],
                    [
                      77988,
                      '      nextChildren = flattenChildren(nextNestedChildrenElements, selfDebugID);'
                    ],
                    [
                      77989,
                      '      ReactChildReconciler.updateChildren(prevChildren, nextChildren, mountImages, removedNodes, transaction, this, this._hostContainerInfo, {snip}'
                    ]
                  ],
                  symbolAddr: null
                },
                {
                  function: 'Object.updateChildren',
                  colNo: 25,
                  vars: {},
                  symbol: null,
                  module: null,
                  lineNo: 73313,
                  errors: null,
                  package: null,
                  absPath: 'http://localhost:8000/_static/1503338242/sentry/dist/vendor.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '/_static/1503338242/sentry/dist/vendor.js',
                  platform: null,
                  context: [
                    [73308, '      }'],
                    [73309, '      prevChild = prevChildren && prevChildren[name];'],
                    [
                      73310,
                      '      var prevElement = prevChild && prevChild._currentElement;'
                    ],
                    [73311, '      var nextElement = nextChildren[name];'],
                    [
                      73312,
                      '      if (prevChild != null && shouldUpdateReactComponent(prevElement, nextElement)) {'
                    ],
                    [
                      73313,
                      '        ReactReconciler.receiveComponent(prevChild, nextElement, transaction, context);'
                    ],
                    [73314, '        nextChildren[name] = prevChild;'],
                    [73315, '      } else {'],
                    [73316, '        if (prevChild) {'],
                    [
                      73317,
                      '          removedNodes[name] = ReactReconciler.getHostNode(prevChild);'
                    ],
                    [
                      73318,
                      '          ReactReconciler.unmountComponent(prevChild, false);'
                    ]
                  ],
                  symbolAddr: null
                },
                {
                  function: 'Object.receiveComponent',
                  colNo: 22,
                  vars: {},
                  symbol: null,
                  module: null,
                  lineNo: 17867,
                  errors: null,
                  package: null,
                  absPath: 'http://localhost:8000/_static/1503338242/sentry/dist/vendor.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '/_static/1503338242/sentry/dist/vendor.js',
                  platform: null,
                  context: [
                    [17862, ''],
                    [17863, '    if (refsChanged) {'],
                    [17864, '      ReactRef.detachRefs(internalInstance, prevElement);'],
                    [17865, '    }'],
                    [17866, ''],
                    [
                      17867,
                      '    internalInstance.receiveComponent(nextElement, transaction, context);'
                    ],
                    [17868, ''],
                    [
                      17869,
                      '    if (refsChanged && internalInstance._currentElement && internalInstance._currentElement.ref != null) {'
                    ],
                    [
                      17870,
                      '      transaction.getReactMountReady().enqueue(attachRefs, internalInstance);'
                    ],
                    [17871, '    }'],
                    [17872, '']
                  ],
                  symbolAddr: null
                },
                {
                  function: 'ReactDOMComponent.receiveComponent',
                  colNo: 10,
                  vars: {},
                  symbol: null,
                  module: null,
                  lineNo: 75144,
                  errors: null,
                  package: null,
                  absPath: 'http://localhost:8000/_static/1503338242/sentry/dist/vendor.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '/_static/1503338242/sentry/dist/vendor.js',
                  platform: null,
                  context: [
                    [75139, '   * @param {object} context'],
                    [75140, '   */'],
                    [
                      75141,
                      '  receiveComponent: function (nextElement, transaction, context) {'
                    ],
                    [75142, '    var prevElement = this._currentElement;'],
                    [75143, '    this._currentElement = nextElement;'],
                    [
                      75144,
                      '    this.updateComponent(transaction, prevElement, nextElement, context);'
                    ],
                    [75145, '  },'],
                    [75146, ''],
                    [75147, '  /**'],
                    [
                      75148,
                      '   * Updates a DOM component after it has already been allocated and'
                    ],
                    [
                      75149,
                      '   * attached to the DOM. Reconciles the root DOM node, then recurses.'
                    ]
                  ],
                  symbolAddr: null
                },
                {
                  function: 'ReactDOMComponent.updateComponent',
                  colNo: 10,
                  vars: {},
                  symbol: null,
                  module: null,
                  lineNo: 75186,
                  errors: null,
                  package: null,
                  absPath: 'http://localhost:8000/_static/1503338242/sentry/dist/vendor.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '/_static/1503338242/sentry/dist/vendor.js',
                  platform: null,
                  context: [
                    [75181, '        break;'],
                    [75182, '    }'],
                    [75183, ''],
                    [75184, '    assertValidProps(this, nextProps);'],
                    [
                      75185,
                      '    this._updateDOMProperties(lastProps, nextProps, transaction);'
                    ],
                    [
                      75186,
                      '    this._updateDOMChildren(lastProps, nextProps, transaction, context);'
                    ],
                    [75187, ''],
                    [75188, '    switch (this._tag) {'],
                    [75189, "      case 'input':"],
                    [
                      75190,
                      '        // Update the wrapper around inputs *after* updating props. This has to'
                    ],
                    [
                      75191,
                      '        // happen after `_updateDOMProperties`. Otherwise HTML5 input validations'
                    ]
                  ],
                  symbolAddr: null
                },
                {
                  function: 'ReactDOMComponent._updateDOMChildren',
                  colNo: 12,
                  vars: {},
                  symbol: null,
                  module: null,
                  lineNo: 75368,
                  errors: null,
                  package: null,
                  absPath: 'http://localhost:8000/_static/1503338242/sentry/dist/vendor.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '/_static/1503338242/sentry/dist/vendor.js',
                  platform: null,
                  context: [
                    [75363, '    } else if (nextChildren != null) {'],
                    [75364, "      if (undefined !== 'production') {"],
                    [75365, '        setAndValidateContentChildDev.call(this, null);'],
                    [75366, '      }'],
                    [75367, ''],
                    [
                      75368,
                      '      this.updateChildren(nextChildren, transaction, context);'
                    ],
                    [75369, '    }'],
                    [75370, '  },'],
                    [75371, ''],
                    [75372, '  getHostNode: function () {'],
                    [75373, '    return getNode(this);']
                  ],
                  symbolAddr: null
                },
                {
                  function: 'ReactDOMComponent.updateChildren',
                  colNo: 12,
                  vars: {},
                  symbol: null,
                  module: null,
                  lineNo: 78075,
                  errors: null,
                  package: null,
                  absPath: 'http://localhost:8000/_static/1503338242/sentry/dist/vendor.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '/_static/1503338242/sentry/dist/vendor.js',
                  platform: null,
                  context: [
                    [78070, '     * @param {ReactReconcileTransaction} transaction'],
                    [78071, '     * @internal'],
                    [78072, '     */'],
                    [
                      78073,
                      '    updateChildren: function (nextNestedChildrenElements, transaction, context) {'
                    ],
                    [78074, '      // Hook used by React ART'],
                    [
                      78075,
                      '      this._updateChildren(nextNestedChildrenElements, transaction, context);'
                    ],
                    [78076, '    },'],
                    [78077, ''],
                    [78078, '    /**'],
                    [
                      78079,
                      '     * @param {?object} nextNestedChildrenElements Nested child element maps.'
                    ],
                    [78080, '     * @param {ReactReconcileTransaction} transaction']
                  ],
                  symbolAddr: null
                },
                {
                  function: 'ReactDOMComponent._updateChildren',
                  colNo: 31,
                  vars: {},
                  symbol: null,
                  module: null,
                  lineNo: 78088,
                  errors: null,
                  package: null,
                  absPath: 'http://localhost:8000/_static/1503338242/sentry/dist/vendor.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '/_static/1503338242/sentry/dist/vendor.js',
                  platform: null,
                  context: [
                    [78083, '     */'],
                    [
                      78084,
                      '    _updateChildren: function (nextNestedChildrenElements, transaction, context) {'
                    ],
                    [78085, '      var prevChildren = this._renderedChildren;'],
                    [78086, '      var removedNodes = {};'],
                    [78087, '      var mountImages = [];'],
                    [
                      78088,
                      '      var nextChildren = this._reconcilerUpdateChildren(prevChildren, nextNestedChildrenElements, mountImages, removedNodes, transaction, context);'
                    ],
                    [78089, '      if (!nextChildren && !prevChildren) {'],
                    [78090, '        return;'],
                    [78091, '      }'],
                    [78092, '      var updates = null;'],
                    [78093, '      var name;']
                  ],
                  symbolAddr: null
                },
                {
                  function: 'ReactDOMComponent._reconcilerUpdateChildren',
                  colNo: 32,
                  vars: {},
                  symbol: null,
                  module: null,
                  lineNo: 77984,
                  errors: null,
                  package: null,
                  absPath: 'http://localhost:8000/_static/1503338242/sentry/dist/vendor.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '/_static/1503338242/sentry/dist/vendor.js',
                  platform: null,
                  context: [
                    [
                      77979,
                      '            ReactCurrentOwner.current = this._currentElement._owner;'
                    ],
                    [
                      77980,
                      '            nextChildren = flattenChildren(nextNestedChildrenElements, selfDebugID);'
                    ],
                    [77981, '          } finally {'],
                    [77982, '            ReactCurrentOwner.current = null;'],
                    [77983, '          }'],
                    [
                      77984,
                      '          ReactChildReconciler.updateChildren(prevChildren, nextChildren, mountImages, removedNodes, transaction, this, this._hostContainerI {snip}'
                    ],
                    [77985, '          return nextChildren;'],
                    [77986, '        }'],
                    [77987, '      }'],
                    [
                      77988,
                      '      nextChildren = flattenChildren(nextNestedChildrenElements, selfDebugID);'
                    ],
                    [
                      77989,
                      '      ReactChildReconciler.updateChildren(prevChildren, nextChildren, mountImages, removedNodes, transaction, this, this._hostContainerInfo, {snip}'
                    ]
                  ],
                  symbolAddr: null
                },
                {
                  function: 'Object.updateChildren',
                  colNo: 51,
                  vars: {},
                  symbol: null,
                  module: null,
                  lineNo: 73325,
                  errors: null,
                  package: null,
                  absPath: 'http://localhost:8000/_static/1503338242/sentry/dist/vendor.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '/_static/1503338242/sentry/dist/vendor.js',
                  platform: null,
                  context: [
                    [
                      73320,
                      "        // The child must be instantiated before it's mounted."
                    ],
                    [
                      73321,
                      '        var nextChildInstance = instantiateReactComponent(nextElement, true);'
                    ],
                    [73322, '        nextChildren[name] = nextChildInstance;'],
                    [
                      73323,
                      '        // Creating mount image now ensures refs are resolved in right order'
                    ],
                    [
                      73324,
                      '        // (see https://github.com/facebook/react/pull/7101 for explanation).'
                    ],
                    [
                      73325,
                      '        var nextChildMountImage = ReactReconciler.mountComponent(nextChildInstance, transaction, hostParent, hostContainerInfo, context, selfDebugID);'
                    ],
                    [73326, '        mountImages.push(nextChildMountImage);'],
                    [73327, '      }'],
                    [73328, '    }'],
                    [73329, '    // Unmount children that are no longer present.'],
                    [73330, '    for (name in prevChildren) {']
                  ],
                  symbolAddr: null
                },
                {
                  function: 'Object.mountComponent',
                  colNo: 35,
                  vars: {},
                  symbol: null,
                  module: null,
                  lineNo: 17788,
                  errors: null,
                  package: null,
                  absPath: 'http://localhost:8000/_static/1503338242/sentry/dist/vendor.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '/_static/1503338242/sentry/dist/vendor.js',
                  platform: null,
                  context: [
                    [17783, "    if (undefined !== 'production') {"],
                    [17784, '      if (internalInstance._debugID !== 0) {'],
                    [
                      17785,
                      '        ReactInstrumentation.debugTool.onBeforeMountComponent(internalInstance._debugID, internalInstance._currentElement, parentDebugID);'
                    ],
                    [17786, '      }'],
                    [17787, '    }'],
                    [
                      17788,
                      '    var markup = internalInstance.mountComponent(transaction, hostParent, hostContainerInfo, context, parentDebugID);'
                    ],
                    [
                      17789,
                      '    if (internalInstance._currentElement && internalInstance._currentElement.ref != null) {'
                    ],
                    [
                      17790,
                      '      transaction.getReactMountReady().enqueue(attachRefs, internalInstance);'
                    ],
                    [17791, '    }'],
                    [17792, "    if (undefined !== 'production') {"],
                    [17793, '      if (internalInstance._debugID !== 0) {']
                  ],
                  symbolAddr: null
                },
                {
                  function: 'ReactCompositeComponentWrapper.mountComponent',
                  colNo: 21,
                  vars: {},
                  symbol: null,
                  module: null,
                  lineNo: 73733,
                  errors: null,
                  package: null,
                  absPath: 'http://localhost:8000/_static/1503338242/sentry/dist/vendor.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '/_static/1503338242/sentry/dist/vendor.js',
                  platform: null,
                  context: [
                    [73728, ''],
                    [73729, '    var markup;'],
                    [73730, '    if (inst.unstable_handleError) {'],
                    [
                      73731,
                      '      markup = this.performInitialMountWithErrorHandling(renderedElement, hostParent, hostContainerInfo, transaction, context);'
                    ],
                    [73732, '    } else {'],
                    [
                      73733,
                      '      markup = this.performInitialMount(renderedElement, hostParent, hostContainerInfo, transaction, context);'
                    ],
                    [73734, '    }'],
                    [73735, ''],
                    [73736, '    if (inst.componentDidMount) {'],
                    [73737, "      if (undefined !== 'production') {"],
                    [
                      73738,
                      '        transaction.getReactMountReady().enqueue(function () {'
                    ]
                  ],
                  symbolAddr: null
                },
                {
                  function: 'ReactCompositeComponentWrapper.performInitialMount',
                  colNo: 34,
                  vars: {},
                  symbol: null,
                  module: null,
                  lineNo: 73846,
                  errors: null,
                  package: null,
                  absPath: 'http://localhost:8000/_static/1503338242/sentry/dist/vendor.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '/_static/1503338242/sentry/dist/vendor.js',
                  platform: null,
                  context: [
                    [73841, '    this._renderedNodeType = nodeType;'],
                    [
                      73842,
                      '    var child = this._instantiateReactComponent(renderedElement, nodeType !== ReactNodeTypes.EMPTY /* shouldHaveDebugID */'
                    ],
                    [73843, '    );'],
                    [73844, '    this._renderedComponent = child;'],
                    [73845, ''],
                    [
                      73846,
                      '    var markup = ReactReconciler.mountComponent(child, transaction, hostParent, hostContainerInfo, this._processChildContext(context), debugID);'
                    ],
                    [73847, ''],
                    [73848, "    if (undefined !== 'production') {"],
                    [73849, '      if (debugID !== 0) {'],
                    [
                      73850,
                      '        var childDebugIDs = child._debugID !== 0 ? [child._debugID] : [];'
                    ],
                    [
                      73851,
                      '        ReactInstrumentation.debugTool.onSetChildren(debugID, childDebugIDs);'
                    ]
                  ],
                  symbolAddr: null
                },
                {
                  function: 'Object.mountComponent',
                  colNo: 35,
                  vars: {},
                  symbol: null,
                  module: null,
                  lineNo: 17788,
                  errors: null,
                  package: null,
                  absPath: 'http://localhost:8000/_static/1503338242/sentry/dist/vendor.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '/_static/1503338242/sentry/dist/vendor.js',
                  platform: null,
                  context: [
                    [17783, "    if (undefined !== 'production') {"],
                    [17784, '      if (internalInstance._debugID !== 0) {'],
                    [
                      17785,
                      '        ReactInstrumentation.debugTool.onBeforeMountComponent(internalInstance._debugID, internalInstance._currentElement, parentDebugID);'
                    ],
                    [17786, '      }'],
                    [17787, '    }'],
                    [
                      17788,
                      '    var markup = internalInstance.mountComponent(transaction, hostParent, hostContainerInfo, context, parentDebugID);'
                    ],
                    [
                      17789,
                      '    if (internalInstance._currentElement && internalInstance._currentElement.ref != null) {'
                    ],
                    [
                      17790,
                      '      transaction.getReactMountReady().enqueue(attachRefs, internalInstance);'
                    ],
                    [17791, '    }'],
                    [17792, "    if (undefined !== 'production') {"],
                    [17793, '      if (internalInstance._debugID !== 0) {']
                  ],
                  symbolAddr: null
                },
                {
                  function: 'ReactCompositeComponentWrapper.mountComponent',
                  colNo: 21,
                  vars: {},
                  symbol: null,
                  module: null,
                  lineNo: 73733,
                  errors: null,
                  package: null,
                  absPath: 'http://localhost:8000/_static/1503338242/sentry/dist/vendor.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '/_static/1503338242/sentry/dist/vendor.js',
                  platform: null,
                  context: [
                    [73728, ''],
                    [73729, '    var markup;'],
                    [73730, '    if (inst.unstable_handleError) {'],
                    [
                      73731,
                      '      markup = this.performInitialMountWithErrorHandling(renderedElement, hostParent, hostContainerInfo, transaction, context);'
                    ],
                    [73732, '    } else {'],
                    [
                      73733,
                      '      markup = this.performInitialMount(renderedElement, hostParent, hostContainerInfo, transaction, context);'
                    ],
                    [73734, '    }'],
                    [73735, ''],
                    [73736, '    if (inst.componentDidMount) {'],
                    [73737, "      if (undefined !== 'production') {"],
                    [
                      73738,
                      '        transaction.getReactMountReady().enqueue(function () {'
                    ]
                  ],
                  symbolAddr: null
                },
                {
                  function: 'ReactCompositeComponentWrapper.performInitialMount',
                  colNo: 34,
                  vars: {},
                  symbol: null,
                  module: null,
                  lineNo: 73846,
                  errors: null,
                  package: null,
                  absPath: 'http://localhost:8000/_static/1503338242/sentry/dist/vendor.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '/_static/1503338242/sentry/dist/vendor.js',
                  platform: null,
                  context: [
                    [73841, '    this._renderedNodeType = nodeType;'],
                    [
                      73842,
                      '    var child = this._instantiateReactComponent(renderedElement, nodeType !== ReactNodeTypes.EMPTY /* shouldHaveDebugID */'
                    ],
                    [73843, '    );'],
                    [73844, '    this._renderedComponent = child;'],
                    [73845, ''],
                    [
                      73846,
                      '    var markup = ReactReconciler.mountComponent(child, transaction, hostParent, hostContainerInfo, this._processChildContext(context), debugID);'
                    ],
                    [73847, ''],
                    [73848, "    if (undefined !== 'production') {"],
                    [73849, '      if (debugID !== 0) {'],
                    [
                      73850,
                      '        var childDebugIDs = child._debugID !== 0 ? [child._debugID] : [];'
                    ],
                    [
                      73851,
                      '        ReactInstrumentation.debugTool.onSetChildren(debugID, childDebugIDs);'
                    ]
                  ],
                  symbolAddr: null
                },
                {
                  function: 'Object.mountComponent',
                  colNo: 35,
                  vars: {},
                  symbol: null,
                  module: null,
                  lineNo: 17788,
                  errors: null,
                  package: null,
                  absPath: 'http://localhost:8000/_static/1503338242/sentry/dist/vendor.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '/_static/1503338242/sentry/dist/vendor.js',
                  platform: null,
                  context: [
                    [17783, "    if (undefined !== 'production') {"],
                    [17784, '      if (internalInstance._debugID !== 0) {'],
                    [
                      17785,
                      '        ReactInstrumentation.debugTool.onBeforeMountComponent(internalInstance._debugID, internalInstance._currentElement, parentDebugID);'
                    ],
                    [17786, '      }'],
                    [17787, '    }'],
                    [
                      17788,
                      '    var markup = internalInstance.mountComponent(transaction, hostParent, hostContainerInfo, context, parentDebugID);'
                    ],
                    [
                      17789,
                      '    if (internalInstance._currentElement && internalInstance._currentElement.ref != null) {'
                    ],
                    [
                      17790,
                      '      transaction.getReactMountReady().enqueue(attachRefs, internalInstance);'
                    ],
                    [17791, '    }'],
                    [17792, "    if (undefined !== 'production') {"],
                    [17793, '      if (internalInstance._debugID !== 0) {']
                  ],
                  symbolAddr: null
                },
                {
                  function: 'ReactDOMComponent.mountComponent',
                  colNo: 12,
                  vars: {},
                  symbol: null,
                  module: null,
                  lineNo: 74950,
                  errors: null,
                  package: null,
                  absPath: 'http://localhost:8000/_static/1503338242/sentry/dist/vendor.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '/_static/1503338242/sentry/dist/vendor.js',
                  platform: null,
                  context: [
                    [74945, '      if (!this._hostParent) {'],
                    [74946, '        DOMPropertyOperations.setAttributeForRoot(el);'],
                    [74947, '      }'],
                    [74948, '      this._updateDOMProperties(null, props, transaction);'],
                    [74949, '      var lazyTree = DOMLazyTree(el);'],
                    [
                      74950,
                      '      this._createInitialChildren(transaction, props, context, lazyTree);'
                    ],
                    [74951, '      mountImage = lazyTree;'],
                    [74952, '    } else {'],
                    [
                      74953,
                      '      var tagOpen = this._createOpenTagMarkupAndPutListeners(transaction, props);'
                    ],
                    [
                      74954,
                      '      var tagContent = this._createContentMarkup(transaction, props, context);'
                    ],
                    [74955, '      if (!tagContent && omittedCloseTags[this._tag]) {']
                  ],
                  symbolAddr: null
                },
                {
                  function: 'ReactDOMComponent._createInitialChildren',
                  colNo: 32,
                  vars: {},
                  symbol: null,
                  module: null,
                  lineNo: 75125,
                  errors: null,
                  package: null,
                  absPath: 'http://localhost:8000/_static/1503338242/sentry/dist/vendor.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '/_static/1503338242/sentry/dist/vendor.js',
                  platform: null,
                  context: [
                    [75120, "        if (undefined !== 'production') {"],
                    [
                      75121,
                      '          setAndValidateContentChildDev.call(this, contentToUse);'
                    ],
                    [75122, '        }'],
                    [75123, '        DOMLazyTree.queueText(lazyTree, contentToUse);'],
                    [75124, '      } else if (childrenToUse != null) {'],
                    [
                      75125,
                      '        var mountImages = this.mountChildren(childrenToUse, transaction, context);'
                    ],
                    [75126, '        for (var i = 0; i < mountImages.length; i++) {'],
                    [
                      75127,
                      '          DOMLazyTree.queueChild(lazyTree, mountImages[i]);'
                    ],
                    [75128, '        }'],
                    [75129, '      }'],
                    [75130, '    }']
                  ],
                  symbolAddr: null
                },
                {
                  function: 'ReactDOMComponent.mountChildren',
                  colNo: 44,
                  vars: {},
                  symbol: null,
                  module: null,
                  lineNo: 78014,
                  errors: null,
                  package: null,
                  absPath: 'http://localhost:8000/_static/1503338242/sentry/dist/vendor.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '/_static/1503338242/sentry/dist/vendor.js',
                  platform: null,
                  context: [
                    [78009, '          var child = children[name];'],
                    [78010, '          var selfDebugID = 0;'],
                    [78011, "          if (undefined !== 'production') {"],
                    [78012, '            selfDebugID = getDebugID(this);'],
                    [78013, '          }'],
                    [
                      78014,
                      '          var mountImage = ReactReconciler.mountComponent(child, transaction, this, this._hostContainerInfo, context, selfDebugID);'
                    ],
                    [78015, '          child._mountIndex = index++;'],
                    [78016, '          mountImages.push(mountImage);'],
                    [78017, '        }'],
                    [78018, '      }'],
                    [78019, '']
                  ],
                  symbolAddr: null
                },
                {
                  function: 'Object.mountComponent',
                  colNo: 35,
                  vars: {},
                  symbol: null,
                  module: null,
                  lineNo: 17788,
                  errors: null,
                  package: null,
                  absPath: 'http://localhost:8000/_static/1503338242/sentry/dist/vendor.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '/_static/1503338242/sentry/dist/vendor.js',
                  platform: null,
                  context: [
                    [17783, "    if (undefined !== 'production') {"],
                    [17784, '      if (internalInstance._debugID !== 0) {'],
                    [
                      17785,
                      '        ReactInstrumentation.debugTool.onBeforeMountComponent(internalInstance._debugID, internalInstance._currentElement, parentDebugID);'
                    ],
                    [17786, '      }'],
                    [17787, '    }'],
                    [
                      17788,
                      '    var markup = internalInstance.mountComponent(transaction, hostParent, hostContainerInfo, context, parentDebugID);'
                    ],
                    [
                      17789,
                      '    if (internalInstance._currentElement && internalInstance._currentElement.ref != null) {'
                    ],
                    [
                      17790,
                      '      transaction.getReactMountReady().enqueue(attachRefs, internalInstance);'
                    ],
                    [17791, '    }'],
                    [17792, "    if (undefined !== 'production') {"],
                    [17793, '      if (internalInstance._debugID !== 0) {']
                  ],
                  symbolAddr: null
                },
                {
                  function: 'ReactDOMComponent.mountComponent',
                  colNo: 12,
                  vars: {},
                  symbol: null,
                  module: null,
                  lineNo: 74950,
                  errors: null,
                  package: null,
                  absPath: 'http://localhost:8000/_static/1503338242/sentry/dist/vendor.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '/_static/1503338242/sentry/dist/vendor.js',
                  platform: null,
                  context: [
                    [74945, '      if (!this._hostParent) {'],
                    [74946, '        DOMPropertyOperations.setAttributeForRoot(el);'],
                    [74947, '      }'],
                    [74948, '      this._updateDOMProperties(null, props, transaction);'],
                    [74949, '      var lazyTree = DOMLazyTree(el);'],
                    [
                      74950,
                      '      this._createInitialChildren(transaction, props, context, lazyTree);'
                    ],
                    [74951, '      mountImage = lazyTree;'],
                    [74952, '    } else {'],
                    [
                      74953,
                      '      var tagOpen = this._createOpenTagMarkupAndPutListeners(transaction, props);'
                    ],
                    [
                      74954,
                      '      var tagContent = this._createContentMarkup(transaction, props, context);'
                    ],
                    [74955, '      if (!tagContent && omittedCloseTags[this._tag]) {']
                  ],
                  symbolAddr: null
                },
                {
                  function: 'ReactDOMComponent._createInitialChildren',
                  colNo: 32,
                  vars: {},
                  symbol: null,
                  module: null,
                  lineNo: 75125,
                  errors: null,
                  package: null,
                  absPath: 'http://localhost:8000/_static/1503338242/sentry/dist/vendor.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '/_static/1503338242/sentry/dist/vendor.js',
                  platform: null,
                  context: [
                    [75120, "        if (undefined !== 'production') {"],
                    [
                      75121,
                      '          setAndValidateContentChildDev.call(this, contentToUse);'
                    ],
                    [75122, '        }'],
                    [75123, '        DOMLazyTree.queueText(lazyTree, contentToUse);'],
                    [75124, '      } else if (childrenToUse != null) {'],
                    [
                      75125,
                      '        var mountImages = this.mountChildren(childrenToUse, transaction, context);'
                    ],
                    [75126, '        for (var i = 0; i < mountImages.length; i++) {'],
                    [
                      75127,
                      '          DOMLazyTree.queueChild(lazyTree, mountImages[i]);'
                    ],
                    [75128, '        }'],
                    [75129, '      }'],
                    [75130, '    }']
                  ],
                  symbolAddr: null
                },
                {
                  function: 'ReactDOMComponent.mountChildren',
                  colNo: 44,
                  vars: {},
                  symbol: null,
                  module: null,
                  lineNo: 78014,
                  errors: null,
                  package: null,
                  absPath: 'http://localhost:8000/_static/1503338242/sentry/dist/vendor.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '/_static/1503338242/sentry/dist/vendor.js',
                  platform: null,
                  context: [
                    [78009, '          var child = children[name];'],
                    [78010, '          var selfDebugID = 0;'],
                    [78011, "          if (undefined !== 'production') {"],
                    [78012, '            selfDebugID = getDebugID(this);'],
                    [78013, '          }'],
                    [
                      78014,
                      '          var mountImage = ReactReconciler.mountComponent(child, transaction, this, this._hostContainerInfo, context, selfDebugID);'
                    ],
                    [78015, '          child._mountIndex = index++;'],
                    [78016, '          mountImages.push(mountImage);'],
                    [78017, '        }'],
                    [78018, '      }'],
                    [78019, '']
                  ],
                  symbolAddr: null
                },
                {
                  function: 'Object.mountComponent',
                  colNo: 35,
                  vars: {},
                  symbol: null,
                  module: null,
                  lineNo: 17788,
                  errors: null,
                  package: null,
                  absPath: 'http://localhost:8000/_static/1503338242/sentry/dist/vendor.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '/_static/1503338242/sentry/dist/vendor.js',
                  platform: null,
                  context: [
                    [17783, "    if (undefined !== 'production') {"],
                    [17784, '      if (internalInstance._debugID !== 0) {'],
                    [
                      17785,
                      '        ReactInstrumentation.debugTool.onBeforeMountComponent(internalInstance._debugID, internalInstance._currentElement, parentDebugID);'
                    ],
                    [17786, '      }'],
                    [17787, '    }'],
                    [
                      17788,
                      '    var markup = internalInstance.mountComponent(transaction, hostParent, hostContainerInfo, context, parentDebugID);'
                    ],
                    [
                      17789,
                      '    if (internalInstance._currentElement && internalInstance._currentElement.ref != null) {'
                    ],
                    [
                      17790,
                      '      transaction.getReactMountReady().enqueue(attachRefs, internalInstance);'
                    ],
                    [17791, '    }'],
                    [17792, "    if (undefined !== 'production') {"],
                    [17793, '      if (internalInstance._debugID !== 0) {']
                  ],
                  symbolAddr: null
                },
                {
                  function: 'ReactDOMComponent.mountComponent',
                  colNo: 12,
                  vars: {},
                  symbol: null,
                  module: null,
                  lineNo: 74950,
                  errors: null,
                  package: null,
                  absPath: 'http://localhost:8000/_static/1503338242/sentry/dist/vendor.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '/_static/1503338242/sentry/dist/vendor.js',
                  platform: null,
                  context: [
                    [74945, '      if (!this._hostParent) {'],
                    [74946, '        DOMPropertyOperations.setAttributeForRoot(el);'],
                    [74947, '      }'],
                    [74948, '      this._updateDOMProperties(null, props, transaction);'],
                    [74949, '      var lazyTree = DOMLazyTree(el);'],
                    [
                      74950,
                      '      this._createInitialChildren(transaction, props, context, lazyTree);'
                    ],
                    [74951, '      mountImage = lazyTree;'],
                    [74952, '    } else {'],
                    [
                      74953,
                      '      var tagOpen = this._createOpenTagMarkupAndPutListeners(transaction, props);'
                    ],
                    [
                      74954,
                      '      var tagContent = this._createContentMarkup(transaction, props, context);'
                    ],
                    [74955, '      if (!tagContent && omittedCloseTags[this._tag]) {']
                  ],
                  symbolAddr: null
                },
                {
                  function: 'ReactDOMComponent._createInitialChildren',
                  colNo: 32,
                  vars: {},
                  symbol: null,
                  module: null,
                  lineNo: 75125,
                  errors: null,
                  package: null,
                  absPath: 'http://localhost:8000/_static/1503338242/sentry/dist/vendor.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '/_static/1503338242/sentry/dist/vendor.js',
                  platform: null,
                  context: [
                    [75120, "        if (undefined !== 'production') {"],
                    [
                      75121,
                      '          setAndValidateContentChildDev.call(this, contentToUse);'
                    ],
                    [75122, '        }'],
                    [75123, '        DOMLazyTree.queueText(lazyTree, contentToUse);'],
                    [75124, '      } else if (childrenToUse != null) {'],
                    [
                      75125,
                      '        var mountImages = this.mountChildren(childrenToUse, transaction, context);'
                    ],
                    [75126, '        for (var i = 0; i < mountImages.length; i++) {'],
                    [
                      75127,
                      '          DOMLazyTree.queueChild(lazyTree, mountImages[i]);'
                    ],
                    [75128, '        }'],
                    [75129, '      }'],
                    [75130, '    }']
                  ],
                  symbolAddr: null
                },
                {
                  function: 'ReactDOMComponent.mountChildren',
                  colNo: 44,
                  vars: {},
                  symbol: null,
                  module: null,
                  lineNo: 78014,
                  errors: null,
                  package: null,
                  absPath: 'http://localhost:8000/_static/1503338242/sentry/dist/vendor.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '/_static/1503338242/sentry/dist/vendor.js',
                  platform: null,
                  context: [
                    [78009, '          var child = children[name];'],
                    [78010, '          var selfDebugID = 0;'],
                    [78011, "          if (undefined !== 'production') {"],
                    [78012, '            selfDebugID = getDebugID(this);'],
                    [78013, '          }'],
                    [
                      78014,
                      '          var mountImage = ReactReconciler.mountComponent(child, transaction, this, this._hostContainerInfo, context, selfDebugID);'
                    ],
                    [78015, '          child._mountIndex = index++;'],
                    [78016, '          mountImages.push(mountImage);'],
                    [78017, '        }'],
                    [78018, '      }'],
                    [78019, '']
                  ],
                  symbolAddr: null
                },
                {
                  function: 'Object.mountComponent',
                  colNo: 35,
                  vars: {},
                  symbol: null,
                  module: null,
                  lineNo: 17788,
                  errors: null,
                  package: null,
                  absPath: 'http://localhost:8000/_static/1503338242/sentry/dist/vendor.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '/_static/1503338242/sentry/dist/vendor.js',
                  platform: null,
                  context: [
                    [17783, "    if (undefined !== 'production') {"],
                    [17784, '      if (internalInstance._debugID !== 0) {'],
                    [
                      17785,
                      '        ReactInstrumentation.debugTool.onBeforeMountComponent(internalInstance._debugID, internalInstance._currentElement, parentDebugID);'
                    ],
                    [17786, '      }'],
                    [17787, '    }'],
                    [
                      17788,
                      '    var markup = internalInstance.mountComponent(transaction, hostParent, hostContainerInfo, context, parentDebugID);'
                    ],
                    [
                      17789,
                      '    if (internalInstance._currentElement && internalInstance._currentElement.ref != null) {'
                    ],
                    [
                      17790,
                      '      transaction.getReactMountReady().enqueue(attachRefs, internalInstance);'
                    ],
                    [17791, '    }'],
                    [17792, "    if (undefined !== 'production') {"],
                    [17793, '      if (internalInstance._debugID !== 0) {']
                  ],
                  symbolAddr: null
                },
                {
                  function: 'ReactCompositeComponentWrapper.mountComponent',
                  colNo: 21,
                  vars: {},
                  symbol: null,
                  module: null,
                  lineNo: 73733,
                  errors: null,
                  package: null,
                  absPath: 'http://localhost:8000/_static/1503338242/sentry/dist/vendor.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '/_static/1503338242/sentry/dist/vendor.js',
                  platform: null,
                  context: [
                    [73728, ''],
                    [73729, '    var markup;'],
                    [73730, '    if (inst.unstable_handleError) {'],
                    [
                      73731,
                      '      markup = this.performInitialMountWithErrorHandling(renderedElement, hostParent, hostContainerInfo, transaction, context);'
                    ],
                    [73732, '    } else {'],
                    [
                      73733,
                      '      markup = this.performInitialMount(renderedElement, hostParent, hostContainerInfo, transaction, context);'
                    ],
                    [73734, '    }'],
                    [73735, ''],
                    [73736, '    if (inst.componentDidMount) {'],
                    [73737, "      if (undefined !== 'production') {"],
                    [
                      73738,
                      '        transaction.getReactMountReady().enqueue(function () {'
                    ]
                  ],
                  symbolAddr: null
                },
                {
                  function: 'ReactCompositeComponentWrapper.performInitialMount',
                  colNo: 34,
                  vars: {},
                  symbol: null,
                  module: null,
                  lineNo: 73846,
                  errors: null,
                  package: null,
                  absPath: 'http://localhost:8000/_static/1503338242/sentry/dist/vendor.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '/_static/1503338242/sentry/dist/vendor.js',
                  platform: null,
                  context: [
                    [73841, '    this._renderedNodeType = nodeType;'],
                    [
                      73842,
                      '    var child = this._instantiateReactComponent(renderedElement, nodeType !== ReactNodeTypes.EMPTY /* shouldHaveDebugID */'
                    ],
                    [73843, '    );'],
                    [73844, '    this._renderedComponent = child;'],
                    [73845, ''],
                    [
                      73846,
                      '    var markup = ReactReconciler.mountComponent(child, transaction, hostParent, hostContainerInfo, this._processChildContext(context), debugID);'
                    ],
                    [73847, ''],
                    [73848, "    if (undefined !== 'production') {"],
                    [73849, '      if (debugID !== 0) {'],
                    [
                      73850,
                      '        var childDebugIDs = child._debugID !== 0 ? [child._debugID] : [];'
                    ],
                    [
                      73851,
                      '        ReactInstrumentation.debugTool.onSetChildren(debugID, childDebugIDs);'
                    ]
                  ],
                  symbolAddr: null
                },
                {
                  function: 'Object.mountComponent',
                  colNo: 35,
                  vars: {},
                  symbol: null,
                  module: null,
                  lineNo: 17788,
                  errors: null,
                  package: null,
                  absPath: 'http://localhost:8000/_static/1503338242/sentry/dist/vendor.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '/_static/1503338242/sentry/dist/vendor.js',
                  platform: null,
                  context: [
                    [17783, "    if (undefined !== 'production') {"],
                    [17784, '      if (internalInstance._debugID !== 0) {'],
                    [
                      17785,
                      '        ReactInstrumentation.debugTool.onBeforeMountComponent(internalInstance._debugID, internalInstance._currentElement, parentDebugID);'
                    ],
                    [17786, '      }'],
                    [17787, '    }'],
                    [
                      17788,
                      '    var markup = internalInstance.mountComponent(transaction, hostParent, hostContainerInfo, context, parentDebugID);'
                    ],
                    [
                      17789,
                      '    if (internalInstance._currentElement && internalInstance._currentElement.ref != null) {'
                    ],
                    [
                      17790,
                      '      transaction.getReactMountReady().enqueue(attachRefs, internalInstance);'
                    ],
                    [17791, '    }'],
                    [17792, "    if (undefined !== 'production') {"],
                    [17793, '      if (internalInstance._debugID !== 0) {']
                  ],
                  symbolAddr: null
                },
                {
                  function: 'ReactDOMComponent.mountComponent',
                  colNo: 12,
                  vars: {},
                  symbol: null,
                  module: null,
                  lineNo: 74950,
                  errors: null,
                  package: null,
                  absPath: 'http://localhost:8000/_static/1503338242/sentry/dist/vendor.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '/_static/1503338242/sentry/dist/vendor.js',
                  platform: null,
                  context: [
                    [74945, '      if (!this._hostParent) {'],
                    [74946, '        DOMPropertyOperations.setAttributeForRoot(el);'],
                    [74947, '      }'],
                    [74948, '      this._updateDOMProperties(null, props, transaction);'],
                    [74949, '      var lazyTree = DOMLazyTree(el);'],
                    [
                      74950,
                      '      this._createInitialChildren(transaction, props, context, lazyTree);'
                    ],
                    [74951, '      mountImage = lazyTree;'],
                    [74952, '    } else {'],
                    [
                      74953,
                      '      var tagOpen = this._createOpenTagMarkupAndPutListeners(transaction, props);'
                    ],
                    [
                      74954,
                      '      var tagContent = this._createContentMarkup(transaction, props, context);'
                    ],
                    [74955, '      if (!tagContent && omittedCloseTags[this._tag]) {']
                  ],
                  symbolAddr: null
                },
                {
                  function: 'ReactDOMComponent._createInitialChildren',
                  colNo: 32,
                  vars: {},
                  symbol: null,
                  module: null,
                  lineNo: 75125,
                  errors: null,
                  package: null,
                  absPath: 'http://localhost:8000/_static/1503338242/sentry/dist/vendor.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '/_static/1503338242/sentry/dist/vendor.js',
                  platform: null,
                  context: [
                    [75120, "        if (undefined !== 'production') {"],
                    [
                      75121,
                      '          setAndValidateContentChildDev.call(this, contentToUse);'
                    ],
                    [75122, '        }'],
                    [75123, '        DOMLazyTree.queueText(lazyTree, contentToUse);'],
                    [75124, '      } else if (childrenToUse != null) {'],
                    [
                      75125,
                      '        var mountImages = this.mountChildren(childrenToUse, transaction, context);'
                    ],
                    [75126, '        for (var i = 0; i < mountImages.length; i++) {'],
                    [
                      75127,
                      '          DOMLazyTree.queueChild(lazyTree, mountImages[i]);'
                    ],
                    [75128, '        }'],
                    [75129, '      }'],
                    [75130, '    }']
                  ],
                  symbolAddr: null
                },
                {
                  function: 'ReactDOMComponent.mountChildren',
                  colNo: 44,
                  vars: {},
                  symbol: null,
                  module: null,
                  lineNo: 78014,
                  errors: null,
                  package: null,
                  absPath: 'http://localhost:8000/_static/1503338242/sentry/dist/vendor.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '/_static/1503338242/sentry/dist/vendor.js',
                  platform: null,
                  context: [
                    [78009, '          var child = children[name];'],
                    [78010, '          var selfDebugID = 0;'],
                    [78011, "          if (undefined !== 'production') {"],
                    [78012, '            selfDebugID = getDebugID(this);'],
                    [78013, '          }'],
                    [
                      78014,
                      '          var mountImage = ReactReconciler.mountComponent(child, transaction, this, this._hostContainerInfo, context, selfDebugID);'
                    ],
                    [78015, '          child._mountIndex = index++;'],
                    [78016, '          mountImages.push(mountImage);'],
                    [78017, '        }'],
                    [78018, '      }'],
                    [78019, '']
                  ],
                  symbolAddr: null
                },
                {
                  function: 'Object.mountComponent',
                  colNo: 35,
                  vars: {},
                  symbol: null,
                  module: null,
                  lineNo: 17788,
                  errors: null,
                  package: null,
                  absPath: 'http://localhost:8000/_static/1503338242/sentry/dist/vendor.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '/_static/1503338242/sentry/dist/vendor.js',
                  platform: null,
                  context: [
                    [17783, "    if (undefined !== 'production') {"],
                    [17784, '      if (internalInstance._debugID !== 0) {'],
                    [
                      17785,
                      '        ReactInstrumentation.debugTool.onBeforeMountComponent(internalInstance._debugID, internalInstance._currentElement, parentDebugID);'
                    ],
                    [17786, '      }'],
                    [17787, '    }'],
                    [
                      17788,
                      '    var markup = internalInstance.mountComponent(transaction, hostParent, hostContainerInfo, context, parentDebugID);'
                    ],
                    [
                      17789,
                      '    if (internalInstance._currentElement && internalInstance._currentElement.ref != null) {'
                    ],
                    [
                      17790,
                      '      transaction.getReactMountReady().enqueue(attachRefs, internalInstance);'
                    ],
                    [17791, '    }'],
                    [17792, "    if (undefined !== 'production') {"],
                    [17793, '      if (internalInstance._debugID !== 0) {']
                  ],
                  symbolAddr: null
                },
                {
                  function: 'ReactCompositeComponentWrapper.mountComponent',
                  colNo: 21,
                  vars: {},
                  symbol: null,
                  module: null,
                  lineNo: 73733,
                  errors: null,
                  package: null,
                  absPath: 'http://localhost:8000/_static/1503338242/sentry/dist/vendor.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '/_static/1503338242/sentry/dist/vendor.js',
                  platform: null,
                  context: [
                    [73728, ''],
                    [73729, '    var markup;'],
                    [73730, '    if (inst.unstable_handleError) {'],
                    [
                      73731,
                      '      markup = this.performInitialMountWithErrorHandling(renderedElement, hostParent, hostContainerInfo, transaction, context);'
                    ],
                    [73732, '    } else {'],
                    [
                      73733,
                      '      markup = this.performInitialMount(renderedElement, hostParent, hostContainerInfo, transaction, context);'
                    ],
                    [73734, '    }'],
                    [73735, ''],
                    [73736, '    if (inst.componentDidMount) {'],
                    [73737, "      if (undefined !== 'production') {"],
                    [
                      73738,
                      '        transaction.getReactMountReady().enqueue(function () {'
                    ]
                  ],
                  symbolAddr: null
                },
                {
                  function: 'ReactCompositeComponentWrapper.performInitialMount',
                  colNo: 30,
                  vars: {},
                  symbol: null,
                  module: null,
                  lineNo: 73837,
                  errors: null,
                  package: null,
                  absPath: 'http://localhost:8000/_static/1503338242/sentry/dist/vendor.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '/_static/1503338242/sentry/dist/vendor.js',
                  platform: null,
                  context: [
                    [73832, '      }'],
                    [73833, '    }'],
                    [73834, ''],
                    [73835, '    // If not a stateless component, we now render'],
                    [73836, '    if (renderedElement === undefined) {'],
                    [73837, '      renderedElement = this._renderValidatedComponent();'],
                    [73838, '    }'],
                    [73839, ''],
                    [
                      73840,
                      '    var nodeType = ReactNodeTypes.getType(renderedElement);'
                    ],
                    [73841, '    this._renderedNodeType = nodeType;'],
                    [
                      73842,
                      '    var child = this._instantiateReactComponent(renderedElement, nodeType !== ReactNodeTypes.EMPTY /* shouldHaveDebugID */'
                    ]
                  ],
                  symbolAddr: null
                },
                {
                  function: 'ReactCompositeComponentWrapper._renderValidatedComponent',
                  colNo: 34,
                  vars: {},
                  symbol: null,
                  module: null,
                  lineNo: 74295,
                  errors: null,
                  package: null,
                  absPath: 'http://localhost:8000/_static/1503338242/sentry/dist/vendor.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '/_static/1503338242/sentry/dist/vendor.js',
                  platform: null,
                  context: [
                    [74290, '  _renderValidatedComponent: function () {'],
                    [74291, '    var renderedComponent;'],
                    [
                      74292,
                      "    if (undefined !== 'production' || this._compositeType !== CompositeTypes.StatelessFunctional) {"
                    ],
                    [74293, '      ReactCurrentOwner.current = this;'],
                    [74294, '      try {'],
                    [
                      74295,
                      '        renderedComponent = this._renderValidatedComponentWithoutOwnerOrContext();'
                    ],
                    [74296, '      } finally {'],
                    [74297, '        ReactCurrentOwner.current = null;'],
                    [74298, '      }'],
                    [74299, '    } else {'],
                    [
                      74300,
                      '      renderedComponent = this._renderValidatedComponentWithoutOwnerOrContext();'
                    ]
                  ],
                  symbolAddr: null
                },
                {
                  function: 'ReactCompositeComponentWrapper._renderValidatedComponentWithoutOwnerOrContext',
                  colNo: 27,
                  vars: {},
                  symbol: null,
                  module: null,
                  lineNo: 74268,
                  errors: null,
                  package: null,
                  absPath: 'http://localhost:8000/_static/1503338242/sentry/dist/vendor.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '/_static/1503338242/sentry/dist/vendor.js',
                  platform: null,
                  context: [
                    [
                      74263,
                      '  _renderValidatedComponentWithoutOwnerOrContext: function () {'
                    ],
                    [74264, '    var inst = this._instance;'],
                    [74265, '    var renderedComponent;'],
                    [74266, ''],
                    [74267, "    if (undefined !== 'production') {"],
                    [
                      74268,
                      '      renderedComponent = measureLifeCyclePerf(function () {'
                    ],
                    [74269, '        return inst.render();'],
                    [74270, "      }, this._debugID, 'render');"],
                    [74271, '    } else {'],
                    [74272, '      renderedComponent = inst.render();'],
                    [74273, '    }']
                  ],
                  symbolAddr: null
                },
                {
                  function: 'measureLifeCyclePerf',
                  colNo: 12,
                  vars: {},
                  symbol: null,
                  module: null,
                  lineNo: 73550,
                  errors: null,
                  package: null,
                  absPath: 'http://localhost:8000/_static/1503338242/sentry/dist/vendor.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '/_static/1503338242/sentry/dist/vendor.js',
                  platform: null,
                  context: [
                    [73545, '    return fn();'],
                    [73546, '  }'],
                    [73547, ''],
                    [
                      73548,
                      '  ReactInstrumentation.debugTool.onBeginLifeCycleTimer(debugID, timerType);'
                    ],
                    [73549, '  try {'],
                    [73550, '    return fn();'],
                    [73551, '  } finally {'],
                    [
                      73552,
                      '    ReactInstrumentation.debugTool.onEndLifeCycleTimer(debugID, timerType);'
                    ],
                    [73553, '  }'],
                    [73554, '}'],
                    [73555, '']
                  ],
                  symbolAddr: null
                },
                {
                  function: null,
                  colNo: 21,
                  vars: {},
                  symbol: null,
                  module: null,
                  lineNo: 74269,
                  errors: null,
                  package: null,
                  absPath: 'http://localhost:8000/_static/1503338242/sentry/dist/vendor.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '/_static/1503338242/sentry/dist/vendor.js',
                  platform: null,
                  context: [
                    [74264, '    var inst = this._instance;'],
                    [74265, '    var renderedComponent;'],
                    [74266, ''],
                    [74267, "    if (undefined !== 'production') {"],
                    [
                      74268,
                      '      renderedComponent = measureLifeCyclePerf(function () {'
                    ],
                    [74269, '        return inst.render();'],
                    [74270, "      }, this._debugID, 'render');"],
                    [74271, '    } else {'],
                    [74272, '      renderedComponent = inst.render();'],
                    [74273, '    }'],
                    [74274, '']
                  ],
                  symbolAddr: null
                },
                {
                  function: 'Constructor.render',
                  colNo: 36,
                  vars: {},
                  symbol: null,
                  module: null,
                  lineNo: 36231,
                  errors: null,
                  package: null,
                  absPath: 'http://localhost:8000/_static/1503338242/sentry/dist/app.js',
                  inApp: true,
                  instructionAddr: null,
                  filename: '/_static/1503338242/sentry/dist/app.js',
                  platform: null,
                  context: [
                    [36226, ''],
                    [36227, '    console.log(paletteIndex, maxScore);'],
                    [
                      36228,
                      '    return __WEBPACK_IMPORTED_MODULE_0_react___default.a.createElement('
                    ],
                    [36229, "      'div',"],
                    [36230, '      { className: cx },'],
                    [
                      36231,
                      '      [].concat(_toConsumableArray(Array(paletteIndex))).map(function (j, i) {'
                    ],
                    [
                      36232,
                      "        var paletteClassName = useCss && paletteClassNames[paletteIndex] || '';"
                    ],
                    [
                      36233,
                      "        var barCx = __WEBPACK_IMPORTED_MODULE_1_classnames___default()('score-bar-bar', _defineProperty({}, paletteClassName, !!paletteClassName));"
                    ],
                    [
                      36234,
                      "        return __WEBPACK_IMPORTED_MODULE_0_react___default.a.createElement('div', { key: i, style: style, className: barCx });"
                    ],
                    [36235, '      }),'],
                    [
                      36236,
                      '      [].concat(_toConsumableArray(Array(maxScore - paletteIndex))).map(function (j, i) {'
                    ]
                  ],
                  symbolAddr: null
                }
              ],
              framesOmitted: null,
              registers: null,
              hasSystemFrames: true
            },
            mechanism: null,
            threadId: null,
            value: 'Invalid array length',
            type: 'RangeError'
          }
        ],
        excOmitted: null,
        hasSystemFrames: true
      }
    },
    {
      type: 'breadcrumbs',
      data: {
        values: [
          {
            category: 'xhr',
            level: 'info',
            event_id: null,
            timestamp: '2017-08-21T20:30:26.266Z',
            data: {url: '/api/0/internal/health/', status_code: '200', method: 'GET'},
            message: null,
            type: 'http'
          },
          {
            category: 'xhr',
            level: 'info',
            event_id: null,
            timestamp: '2017-08-21T20:30:26.324Z',
            data: {
              url: '/api/0/organizations/?member=1',
              status_code: '200',
              method: 'GET'
            },
            message: null,
            type: 'http'
          },
          {
            category: 'xhr',
            level: 'info',
            event_id: null,
            timestamp: '2017-08-21T20:30:26.414Z',
            data: {
              url: '/api/0/organizations/?member=1',
              status_code: '200',
              method: 'GET'
            },
            message: null,
            type: 'http'
          },
          {
            category: 'xhr',
            level: 'info',
            event_id: null,
            timestamp: '2017-08-21T20:30:27.129Z',
            data: {
              url: '/api/0/organizations/sentry/',
              status_code: '200',
              method: 'GET'
            },
            message: null,
            type: 'http'
          },
          {
            category: 'xhr',
            level: 'info',
            event_id: null,
            timestamp: '2017-08-21T20:30:27.333Z',
            data: {url: '/api/0/broadcasts/', status_code: '200', method: 'GET'},
            message: null,
            type: 'http'
          },
          {
            category: 'xhr',
            level: 'info',
            event_id: null,
            timestamp: '2017-08-21T20:30:27.596Z',
            data: {
              url: '/api/0/projects/sentry/internal/environments/',
              status_code: '200',
              method: 'GET'
            },
            message: null,
            type: 'http'
          },
          {
            category: 'xhr',
            level: 'info',
            event_id: null,
            timestamp: '2017-08-21T20:30:27.843Z',
            data: {
              url: '/api/0/projects/sentry/internal/members/',
              status_code: '200',
              method: 'GET'
            },
            message: null,
            type: 'http'
          },
          {
            category: 'xhr',
            level: 'info',
            event_id: null,
            timestamp: '2017-08-21T20:30:28.283Z',
            data: {
              url: '/api/0/projects/sentry/internal/',
              status_code: '200',
              method: 'GET'
            },
            message: null,
            type: 'http'
          },
          {
            category: 'xhr',
            level: 'info',
            event_id: null,
            timestamp: '2017-08-21T20:30:28.777Z',
            data: {url: '/api/0/issues/464/', status_code: '200', method: 'GET'},
            message: null,
            type: 'http'
          },
          {
            category: 'xhr',
            level: 'info',
            event_id: null,
            timestamp: '2017-08-21T20:30:29.616Z',
            data: {
              url: '/api/0/issues/464/similar/?limit=50',
              status_code: '200',
              method: 'GET'
            },
            message: null,
            type: 'http'
          },
          {
            category: 'ui.click',
            level: 'info',
            event_id: null,
            timestamp: '2017-08-21T20:30:36.763Z',
            data: null,
            message: 'body > div#blk_router > div > div.app > footer',
            type: 'default'
          },
          {
            category: 'ui.click',
            level: 'info',
            event_id: null,
            timestamp: '2017-08-21T20:30:37.174Z',
            data: null,
            message: 'div.similar-list > div.similar-items-footer > button.btn.btn-default.btn-xl',
            type: 'default'
          },
          {
            category: 'console',
            level: 'log',
            event_id: null,
            timestamp: '2017-08-21T20:30:40.637Z',
            data: null,
            message: '1 5',
            type: 'default'
          },
          {
            category: 'console',
            level: 'log',
            event_id: null,
            timestamp: '2017-08-21T20:30:40.639Z',
            data: null,
            message: '-1 5',
            type: 'default'
          }
        ]
      }
    },
    {
      type: 'request',
      data: {
        fragment: '',
        cookies: [],
        env: null,
        headers: [
          ['Referer', 'http://localhost:8000/sentry/internal/'],
          [
            'User-Agent',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/60.0.3112.90 Safari/537.36'
          ]
        ],
        url: 'http://localhost:8000/sentry/internal/issues/464/similar/',
        query: '',
        data: null,
        method: null
      }
    }
  ],
  [
    {
      type: 'exception',
      data: {
        values: [
          {
            stacktrace: {
              frames: [
                {
                  function: 'ReactCompositeComponentWrapper.updateComponent',
                  map: 'vendor.js.map',
                  colNo: 0,
                  vars: {},
                  symbol: null,
                  mapUrl: 'http://localhost:8000/_static/1500500019/sentry/dist/vendor.js.map',
                  module: 'Users/billy/Dev/sentry/~/react/lib/ReactCompositeComponent',
                  origAbsPath: '?',
                  lineNo: 642,
                  origColNo: '?',
                  origFunction: '?',
                  errors: null,
                  package: null,
                  absPath: 'webpack:////Users/billy/Dev/sentry/~/react/lib/ReactCompositeComponent.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '~/react/lib/ReactCompositeComponent.js',
                  origFilename: '?',
                  platform: null,
                  context: [
                    [637, ''],
                    [638, '    this._updateBatchNumber = null;'],
                    [639, '    if (shouldUpdate) {'],
                    [640, '      this._pendingForceUpdate = false;'],
                    [
                      641,
                      '      // Will set `this.props`, `this.state` and `this.context`.'
                    ],
                    [
                      642,
                      '      this._performComponentUpdate(nextParentElement, nextProps, nextState, nextContext, transaction, nextUnmaskedContext);'
                    ],
                    [643, '    } else {'],
                    [
                      644,
                      "      // If it's determined that a component should not update, we still want"
                    ],
                    [
                      645,
                      '      // to set props and state but we shortcut the rest of the update.'
                    ],
                    [646, '      this._currentElement = nextParentElement;'],
                    [647, '      this._context = nextUnmaskedContext;']
                  ],
                  symbolAddr: null,
                  origLineNo: '?'
                },
                {
                  function: 'ReactCompositeComponentWrapper._performComponentUpdate',
                  map: 'vendor.js.map',
                  colNo: 0,
                  vars: {},
                  symbol: null,
                  mapUrl: 'http://localhost:8000/_static/1500500019/sentry/dist/vendor.js.map',
                  module: 'Users/billy/Dev/sentry/~/react/lib/ReactCompositeComponent',
                  origAbsPath: '?',
                  lineNo: 721,
                  origColNo: '?',
                  origFunction: '?',
                  errors: null,
                  package: null,
                  absPath: 'webpack:////Users/billy/Dev/sentry/~/react/lib/ReactCompositeComponent.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '~/react/lib/ReactCompositeComponent.js',
                  origFilename: '?',
                  platform: null,
                  context: [
                    [716, '    this._context = unmaskedContext;'],
                    [717, '    inst.props = nextProps;'],
                    [718, '    inst.state = nextState;'],
                    [719, '    inst.context = nextContext;'],
                    [720, ''],
                    [
                      721,
                      '    this._updateRenderedComponent(transaction, unmaskedContext);'
                    ],
                    [722, ''],
                    [723, '    if (hasComponentDidUpdate) {'],
                    [724, "      if (process.env.NODE_ENV !== 'production') {"],
                    [
                      725,
                      '        transaction.getReactMountReady().enqueue(function () {'
                    ],
                    [
                      726,
                      "          measureLifeCyclePerf(inst.componentDidUpdate.bind(inst, prevProps, prevState, prevContext), _this2._debugID, 'componentDidUpdate');"
                    ]
                  ],
                  symbolAddr: null,
                  origLineNo: '?'
                },
                {
                  function: 'ReactCompositeComponentWrapper._updateRenderedComponent',
                  map: 'vendor.js.map',
                  colNo: 0,
                  vars: {},
                  symbol: null,
                  mapUrl: 'http://localhost:8000/_static/1500500019/sentry/dist/vendor.js.map',
                  module: 'Users/billy/Dev/sentry/~/react/lib/ReactCompositeComponent',
                  origAbsPath: '?',
                  lineNo: 751,
                  origColNo: '?',
                  origFunction: '?',
                  errors: null,
                  package: null,
                  absPath: 'webpack:////Users/billy/Dev/sentry/~/react/lib/ReactCompositeComponent.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '~/react/lib/ReactCompositeComponent.js',
                  origFilename: '?',
                  platform: null,
                  context: [
                    [746, "    if (process.env.NODE_ENV !== 'production') {"],
                    [747, '      debugID = this._debugID;'],
                    [748, '    }'],
                    [749, ''],
                    [
                      750,
                      '    if (shouldUpdateReactComponent(prevRenderedElement, nextRenderedElement)) {'
                    ],
                    [
                      751,
                      '      ReactReconciler.receiveComponent(prevComponentInstance, nextRenderedElement, transaction, this._processChildContext(context));'
                    ],
                    [752, '    } else {'],
                    [
                      753,
                      '      var oldHostNode = ReactReconciler.getHostNode(prevComponentInstance);'
                    ],
                    [
                      754,
                      '      ReactReconciler.unmountComponent(prevComponentInstance, false);'
                    ],
                    [755, ''],
                    [
                      756,
                      '      var nodeType = ReactNodeTypes.getType(nextRenderedElement);'
                    ]
                  ],
                  symbolAddr: null,
                  origLineNo: '?'
                },
                {
                  function: 'Object.receiveComponent',
                  map: 'vendor.js.map',
                  colNo: 0,
                  vars: {},
                  symbol: null,
                  mapUrl: 'http://localhost:8000/_static/1500500019/sentry/dist/vendor.js.map',
                  module: 'Users/billy/Dev/sentry/~/react/lib/ReactReconciler',
                  origAbsPath: '?',
                  lineNo: 126,
                  origColNo: '?',
                  origFunction: '?',
                  errors: null,
                  package: null,
                  absPath: 'webpack:////Users/billy/Dev/sentry/~/react/lib/ReactReconciler.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '~/react/lib/ReactReconciler.js',
                  origFilename: '?',
                  platform: null,
                  context: [
                    [121, ''],
                    [122, '    if (refsChanged) {'],
                    [123, '      ReactRef.detachRefs(internalInstance, prevElement);'],
                    [124, '    }'],
                    [125, ''],
                    [
                      126,
                      '    internalInstance.receiveComponent(nextElement, transaction, context);'
                    ],
                    [127, ''],
                    [
                      128,
                      '    if (refsChanged && internalInstance._currentElement && internalInstance._currentElement.ref != null) {'
                    ],
                    [
                      129,
                      '      transaction.getReactMountReady().enqueue(attachRefs, internalInstance);'
                    ],
                    [130, '    }'],
                    [131, '']
                  ],
                  symbolAddr: null,
                  origLineNo: '?'
                },
                {
                  function: 'ReactDOMComponent.receiveComponent',
                  map: 'vendor.js.map',
                  colNo: 0,
                  vars: {},
                  symbol: null,
                  mapUrl: 'http://localhost:8000/_static/1500500019/sentry/dist/vendor.js.map',
                  module: 'Users/billy/Dev/sentry/~/react/lib/ReactDOMComponent',
                  origAbsPath: '?',
                  lineNo: 718,
                  origColNo: '?',
                  origFunction: '?',
                  errors: null,
                  package: null,
                  absPath: 'webpack:////Users/billy/Dev/sentry/~/react/lib/ReactDOMComponent.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '~/react/lib/ReactDOMComponent.js',
                  origFilename: '?',
                  platform: null,
                  context: [
                    [713, '   * @param {object} context'],
                    [714, '   */'],
                    [
                      715,
                      '  receiveComponent: function (nextElement, transaction, context) {'
                    ],
                    [716, '    var prevElement = this._currentElement;'],
                    [717, '    this._currentElement = nextElement;'],
                    [
                      718,
                      '    this.updateComponent(transaction, prevElement, nextElement, context);'
                    ],
                    [719, '  },'],
                    [720, ''],
                    [721, '  /**'],
                    [
                      722,
                      '   * Updates a DOM component after it has already been allocated and'
                    ],
                    [
                      723,
                      '   * attached to the DOM. Reconciles the root DOM node, then recurses.'
                    ]
                  ],
                  symbolAddr: null,
                  origLineNo: '?'
                },
                {
                  function: 'ReactDOMComponent.updateComponent',
                  map: 'vendor.js.map',
                  colNo: 0,
                  vars: {},
                  symbol: null,
                  mapUrl: 'http://localhost:8000/_static/1500500019/sentry/dist/vendor.js.map',
                  module: 'Users/billy/Dev/sentry/~/react/lib/ReactDOMComponent',
                  origAbsPath: '?',
                  lineNo: 760,
                  origColNo: '?',
                  origFunction: '?',
                  errors: null,
                  package: null,
                  absPath: 'webpack:////Users/billy/Dev/sentry/~/react/lib/ReactDOMComponent.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '~/react/lib/ReactDOMComponent.js',
                  origFilename: '?',
                  platform: null,
                  context: [
                    [755, '        break;'],
                    [756, '    }'],
                    [757, ''],
                    [758, '    assertValidProps(this, nextProps);'],
                    [
                      759,
                      '    this._updateDOMProperties(lastProps, nextProps, transaction);'
                    ],
                    [
                      760,
                      '    this._updateDOMChildren(lastProps, nextProps, transaction, context);'
                    ],
                    [761, ''],
                    [762, '    switch (this._tag) {'],
                    [763, "      case 'input':"],
                    [
                      764,
                      '        // Update the wrapper around inputs *after* updating props. This has to'
                    ],
                    [
                      765,
                      '        // happen after `_updateDOMProperties`. Otherwise HTML5 input validations'
                    ]
                  ],
                  symbolAddr: null,
                  origLineNo: '?'
                },
                {
                  function: 'ReactDOMComponent._updateDOMChildren',
                  map: 'vendor.js.map',
                  colNo: 0,
                  vars: {},
                  symbol: null,
                  mapUrl: 'http://localhost:8000/_static/1500500019/sentry/dist/vendor.js.map',
                  module: 'Users/billy/Dev/sentry/~/react/lib/ReactDOMComponent',
                  origAbsPath: '?',
                  lineNo: 942,
                  origColNo: '?',
                  origFunction: '?',
                  errors: null,
                  package: null,
                  absPath: 'webpack:////Users/billy/Dev/sentry/~/react/lib/ReactDOMComponent.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '~/react/lib/ReactDOMComponent.js',
                  origFilename: '?',
                  platform: null,
                  context: [
                    [937, '    } else if (nextChildren != null) {'],
                    [938, "      if (process.env.NODE_ENV !== 'production') {"],
                    [939, '        setAndValidateContentChildDev.call(this, null);'],
                    [940, '      }'],
                    [941, ''],
                    [
                      942,
                      '      this.updateChildren(nextChildren, transaction, context);'
                    ],
                    [943, '    }'],
                    [944, '  },'],
                    [945, ''],
                    [946, '  getHostNode: function () {'],
                    [947, '    return getNode(this);']
                  ],
                  symbolAddr: null,
                  origLineNo: '?'
                },
                {
                  function: 'ReactDOMComponent.updateChildren',
                  map: 'vendor.js.map',
                  colNo: 0,
                  vars: {},
                  symbol: null,
                  mapUrl: 'http://localhost:8000/_static/1500500019/sentry/dist/vendor.js.map',
                  module: 'Users/billy/Dev/sentry/~/react/lib/ReactMultiChild',
                  origAbsPath: '?',
                  lineNo: 301,
                  origColNo: '?',
                  origFunction: '?',
                  errors: null,
                  package: null,
                  absPath: 'webpack:////Users/billy/Dev/sentry/~/react/lib/ReactMultiChild.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '~/react/lib/ReactMultiChild.js',
                  origFilename: '?',
                  platform: null,
                  context: [
                    [296, '     * @param {ReactReconcileTransaction} transaction'],
                    [297, '     * @internal'],
                    [298, '     */'],
                    [
                      299,
                      '    updateChildren: function (nextNestedChildrenElements, transaction, context) {'
                    ],
                    [300, '      // Hook used by React ART'],
                    [
                      301,
                      '      this._updateChildren(nextNestedChildrenElements, transaction, context);'
                    ],
                    [302, '    },'],
                    [303, ''],
                    [304, '    /**'],
                    [
                      305,
                      '     * @param {?object} nextNestedChildrenElements Nested child element maps.'
                    ],
                    [306, '     * @param {ReactReconcileTransaction} transaction']
                  ],
                  symbolAddr: null,
                  origLineNo: '?'
                },
                {
                  function: 'ReactDOMComponent._updateChildren',
                  map: 'vendor.js.map',
                  colNo: 0,
                  vars: {},
                  symbol: null,
                  mapUrl: 'http://localhost:8000/_static/1500500019/sentry/dist/vendor.js.map',
                  module: 'Users/billy/Dev/sentry/~/react/lib/ReactMultiChild',
                  origAbsPath: '?',
                  lineNo: 314,
                  origColNo: '?',
                  origFunction: '?',
                  errors: null,
                  package: null,
                  absPath: 'webpack:////Users/billy/Dev/sentry/~/react/lib/ReactMultiChild.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '~/react/lib/ReactMultiChild.js',
                  origFilename: '?',
                  platform: null,
                  context: [
                    [309, '     */'],
                    [
                      310,
                      '    _updateChildren: function (nextNestedChildrenElements, transaction, context) {'
                    ],
                    [311, '      var prevChildren = this._renderedChildren;'],
                    [312, '      var removedNodes = {};'],
                    [313, '      var mountImages = [];'],
                    [
                      314,
                      '      var nextChildren = this._reconcilerUpdateChildren(prevChildren, nextNestedChildrenElements, mountImages, removedNodes, transaction, context);'
                    ],
                    [315, '      if (!nextChildren && !prevChildren) {'],
                    [316, '        return;'],
                    [317, '      }'],
                    [318, '      var updates = null;'],
                    [319, '      var name;']
                  ],
                  symbolAddr: null,
                  origLineNo: '?'
                },
                {
                  function: 'ReactDOMComponent._reconcilerUpdateChildren',
                  map: 'vendor.js.map',
                  colNo: 0,
                  vars: {},
                  symbol: null,
                  mapUrl: 'http://localhost:8000/_static/1500500019/sentry/dist/vendor.js.map',
                  module: 'Users/billy/Dev/sentry/~/react/lib/ReactMultiChild',
                  origAbsPath: '?',
                  lineNo: 210,
                  origColNo: '?',
                  origFunction: '?',
                  errors: null,
                  package: null,
                  absPath: 'webpack:////Users/billy/Dev/sentry/~/react/lib/ReactMultiChild.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '~/react/lib/ReactMultiChild.js',
                  origFilename: '?',
                  platform: null,
                  context: [
                    [
                      205,
                      '            ReactCurrentOwner.current = this._currentElement._owner;'
                    ],
                    [
                      206,
                      '            nextChildren = flattenChildren(nextNestedChildrenElements, selfDebugID);'
                    ],
                    [207, '          } finally {'],
                    [208, '            ReactCurrentOwner.current = null;'],
                    [209, '          }'],
                    [
                      210,
                      '          ReactChildReconciler.updateChildren(prevChildren, nextChildren, mountImages, removedNodes, transaction, this, this._hostContainerI {snip}'
                    ],
                    [211, '          return nextChildren;'],
                    [212, '        }'],
                    [213, '      }'],
                    [
                      214,
                      '      nextChildren = flattenChildren(nextNestedChildrenElements, selfDebugID);'
                    ],
                    [
                      215,
                      '      ReactChildReconciler.updateChildren(prevChildren, nextChildren, mountImages, removedNodes, transaction, this, this._hostContainerInfo, {snip}'
                    ]
                  ],
                  symbolAddr: null,
                  origLineNo: '?'
                },
                {
                  function: 'Object.updateChildren',
                  map: 'vendor.js.map',
                  colNo: 0,
                  vars: {},
                  symbol: null,
                  mapUrl: 'http://localhost:8000/_static/1500500019/sentry/dist/vendor.js.map',
                  module: 'Users/billy/Dev/sentry/~/react/lib/ReactChildReconciler',
                  origAbsPath: '?',
                  lineNo: 110,
                  origColNo: '?',
                  origFunction: '?',
                  errors: null,
                  package: null,
                  absPath: 'webpack:////Users/billy/Dev/sentry/~/react/lib/ReactChildReconciler.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '~/react/lib/ReactChildReconciler.js',
                  origFilename: '?',
                  platform: null,
                  context: [
                    [105, '      }'],
                    [106, '      prevChild = prevChildren && prevChildren[name];'],
                    [
                      107,
                      '      var prevElement = prevChild && prevChild._currentElement;'
                    ],
                    [108, '      var nextElement = nextChildren[name];'],
                    [
                      109,
                      '      if (prevChild != null && shouldUpdateReactComponent(prevElement, nextElement)) {'
                    ],
                    [
                      110,
                      '        ReactReconciler.receiveComponent(prevChild, nextElement, transaction, context);'
                    ],
                    [111, '        nextChildren[name] = prevChild;'],
                    [112, '      } else {'],
                    [113, '        if (prevChild) {'],
                    [
                      114,
                      '          removedNodes[name] = ReactReconciler.getHostNode(prevChild);'
                    ],
                    [115, '          ReactReconciler.unmountComponent(prevChild, false);']
                  ],
                  symbolAddr: null,
                  origLineNo: '?'
                },
                {
                  function: 'Object.receiveComponent',
                  map: 'vendor.js.map',
                  colNo: 0,
                  vars: {},
                  symbol: null,
                  mapUrl: 'http://localhost:8000/_static/1500500019/sentry/dist/vendor.js.map',
                  module: 'Users/billy/Dev/sentry/~/react/lib/ReactReconciler',
                  origAbsPath: '?',
                  lineNo: 126,
                  origColNo: '?',
                  origFunction: '?',
                  errors: null,
                  package: null,
                  absPath: 'webpack:////Users/billy/Dev/sentry/~/react/lib/ReactReconciler.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '~/react/lib/ReactReconciler.js',
                  origFilename: '?',
                  platform: null,
                  context: [
                    [121, ''],
                    [122, '    if (refsChanged) {'],
                    [123, '      ReactRef.detachRefs(internalInstance, prevElement);'],
                    [124, '    }'],
                    [125, ''],
                    [
                      126,
                      '    internalInstance.receiveComponent(nextElement, transaction, context);'
                    ],
                    [127, ''],
                    [
                      128,
                      '    if (refsChanged && internalInstance._currentElement && internalInstance._currentElement.ref != null) {'
                    ],
                    [
                      129,
                      '      transaction.getReactMountReady().enqueue(attachRefs, internalInstance);'
                    ],
                    [130, '    }'],
                    [131, '']
                  ],
                  symbolAddr: null,
                  origLineNo: '?'
                },
                {
                  function: 'ReactDOMComponent.receiveComponent',
                  map: 'vendor.js.map',
                  colNo: 0,
                  vars: {},
                  symbol: null,
                  mapUrl: 'http://localhost:8000/_static/1500500019/sentry/dist/vendor.js.map',
                  module: 'Users/billy/Dev/sentry/~/react/lib/ReactDOMComponent',
                  origAbsPath: '?',
                  lineNo: 718,
                  origColNo: '?',
                  origFunction: '?',
                  errors: null,
                  package: null,
                  absPath: 'webpack:////Users/billy/Dev/sentry/~/react/lib/ReactDOMComponent.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '~/react/lib/ReactDOMComponent.js',
                  origFilename: '?',
                  platform: null,
                  context: [
                    [713, '   * @param {object} context'],
                    [714, '   */'],
                    [
                      715,
                      '  receiveComponent: function (nextElement, transaction, context) {'
                    ],
                    [716, '    var prevElement = this._currentElement;'],
                    [717, '    this._currentElement = nextElement;'],
                    [
                      718,
                      '    this.updateComponent(transaction, prevElement, nextElement, context);'
                    ],
                    [719, '  },'],
                    [720, ''],
                    [721, '  /**'],
                    [
                      722,
                      '   * Updates a DOM component after it has already been allocated and'
                    ],
                    [
                      723,
                      '   * attached to the DOM. Reconciles the root DOM node, then recurses.'
                    ]
                  ],
                  symbolAddr: null,
                  origLineNo: '?'
                },
                {
                  function: 'ReactDOMComponent.updateComponent',
                  map: 'vendor.js.map',
                  colNo: 0,
                  vars: {},
                  symbol: null,
                  mapUrl: 'http://localhost:8000/_static/1500500019/sentry/dist/vendor.js.map',
                  module: 'Users/billy/Dev/sentry/~/react/lib/ReactDOMComponent',
                  origAbsPath: '?',
                  lineNo: 760,
                  origColNo: '?',
                  origFunction: '?',
                  errors: null,
                  package: null,
                  absPath: 'webpack:////Users/billy/Dev/sentry/~/react/lib/ReactDOMComponent.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '~/react/lib/ReactDOMComponent.js',
                  origFilename: '?',
                  platform: null,
                  context: [
                    [755, '        break;'],
                    [756, '    }'],
                    [757, ''],
                    [758, '    assertValidProps(this, nextProps);'],
                    [
                      759,
                      '    this._updateDOMProperties(lastProps, nextProps, transaction);'
                    ],
                    [
                      760,
                      '    this._updateDOMChildren(lastProps, nextProps, transaction, context);'
                    ],
                    [761, ''],
                    [762, '    switch (this._tag) {'],
                    [763, "      case 'input':"],
                    [
                      764,
                      '        // Update the wrapper around inputs *after* updating props. This has to'
                    ],
                    [
                      765,
                      '        // happen after `_updateDOMProperties`. Otherwise HTML5 input validations'
                    ]
                  ],
                  symbolAddr: null,
                  origLineNo: '?'
                },
                {
                  function: 'ReactDOMComponent._updateDOMChildren',
                  map: 'vendor.js.map',
                  colNo: 0,
                  vars: {},
                  symbol: null,
                  mapUrl: 'http://localhost:8000/_static/1500500019/sentry/dist/vendor.js.map',
                  module: 'Users/billy/Dev/sentry/~/react/lib/ReactDOMComponent',
                  origAbsPath: '?',
                  lineNo: 942,
                  origColNo: '?',
                  origFunction: '?',
                  errors: null,
                  package: null,
                  absPath: 'webpack:////Users/billy/Dev/sentry/~/react/lib/ReactDOMComponent.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '~/react/lib/ReactDOMComponent.js',
                  origFilename: '?',
                  platform: null,
                  context: [
                    [937, '    } else if (nextChildren != null) {'],
                    [938, "      if (process.env.NODE_ENV !== 'production') {"],
                    [939, '        setAndValidateContentChildDev.call(this, null);'],
                    [940, '      }'],
                    [941, ''],
                    [
                      942,
                      '      this.updateChildren(nextChildren, transaction, context);'
                    ],
                    [943, '    }'],
                    [944, '  },'],
                    [945, ''],
                    [946, '  getHostNode: function () {'],
                    [947, '    return getNode(this);']
                  ],
                  symbolAddr: null,
                  origLineNo: '?'
                },
                {
                  function: 'ReactDOMComponent.updateChildren',
                  map: 'vendor.js.map',
                  colNo: 0,
                  vars: {},
                  symbol: null,
                  mapUrl: 'http://localhost:8000/_static/1500500019/sentry/dist/vendor.js.map',
                  module: 'Users/billy/Dev/sentry/~/react/lib/ReactMultiChild',
                  origAbsPath: '?',
                  lineNo: 301,
                  origColNo: '?',
                  origFunction: '?',
                  errors: null,
                  package: null,
                  absPath: 'webpack:////Users/billy/Dev/sentry/~/react/lib/ReactMultiChild.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '~/react/lib/ReactMultiChild.js',
                  origFilename: '?',
                  platform: null,
                  context: [
                    [296, '     * @param {ReactReconcileTransaction} transaction'],
                    [297, '     * @internal'],
                    [298, '     */'],
                    [
                      299,
                      '    updateChildren: function (nextNestedChildrenElements, transaction, context) {'
                    ],
                    [300, '      // Hook used by React ART'],
                    [
                      301,
                      '      this._updateChildren(nextNestedChildrenElements, transaction, context);'
                    ],
                    [302, '    },'],
                    [303, ''],
                    [304, '    /**'],
                    [
                      305,
                      '     * @param {?object} nextNestedChildrenElements Nested child element maps.'
                    ],
                    [306, '     * @param {ReactReconcileTransaction} transaction']
                  ],
                  symbolAddr: null,
                  origLineNo: '?'
                },
                {
                  function: 'ReactDOMComponent._updateChildren',
                  map: 'vendor.js.map',
                  colNo: 0,
                  vars: {},
                  symbol: null,
                  mapUrl: 'http://localhost:8000/_static/1500500019/sentry/dist/vendor.js.map',
                  module: 'Users/billy/Dev/sentry/~/react/lib/ReactMultiChild',
                  origAbsPath: '?',
                  lineNo: 314,
                  origColNo: '?',
                  origFunction: '?',
                  errors: null,
                  package: null,
                  absPath: 'webpack:////Users/billy/Dev/sentry/~/react/lib/ReactMultiChild.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '~/react/lib/ReactMultiChild.js',
                  origFilename: '?',
                  platform: null,
                  context: [
                    [309, '     */'],
                    [
                      310,
                      '    _updateChildren: function (nextNestedChildrenElements, transaction, context) {'
                    ],
                    [311, '      var prevChildren = this._renderedChildren;'],
                    [312, '      var removedNodes = {};'],
                    [313, '      var mountImages = [];'],
                    [
                      314,
                      '      var nextChildren = this._reconcilerUpdateChildren(prevChildren, nextNestedChildrenElements, mountImages, removedNodes, transaction, context);'
                    ],
                    [315, '      if (!nextChildren && !prevChildren) {'],
                    [316, '        return;'],
                    [317, '      }'],
                    [318, '      var updates = null;'],
                    [319, '      var name;']
                  ],
                  symbolAddr: null,
                  origLineNo: '?'
                },
                {
                  function: 'ReactDOMComponent._reconcilerUpdateChildren',
                  map: 'vendor.js.map',
                  colNo: 0,
                  vars: {},
                  symbol: null,
                  mapUrl: 'http://localhost:8000/_static/1500500019/sentry/dist/vendor.js.map',
                  module: 'Users/billy/Dev/sentry/~/react/lib/ReactMultiChild',
                  origAbsPath: '?',
                  lineNo: 210,
                  origColNo: '?',
                  origFunction: '?',
                  errors: null,
                  package: null,
                  absPath: 'webpack:////Users/billy/Dev/sentry/~/react/lib/ReactMultiChild.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '~/react/lib/ReactMultiChild.js',
                  origFilename: '?',
                  platform: null,
                  context: [
                    [
                      205,
                      '            ReactCurrentOwner.current = this._currentElement._owner;'
                    ],
                    [
                      206,
                      '            nextChildren = flattenChildren(nextNestedChildrenElements, selfDebugID);'
                    ],
                    [207, '          } finally {'],
                    [208, '            ReactCurrentOwner.current = null;'],
                    [209, '          }'],
                    [
                      210,
                      '          ReactChildReconciler.updateChildren(prevChildren, nextChildren, mountImages, removedNodes, transaction, this, this._hostContainerI {snip}'
                    ],
                    [211, '          return nextChildren;'],
                    [212, '        }'],
                    [213, '      }'],
                    [
                      214,
                      '      nextChildren = flattenChildren(nextNestedChildrenElements, selfDebugID);'
                    ],
                    [
                      215,
                      '      ReactChildReconciler.updateChildren(prevChildren, nextChildren, mountImages, removedNodes, transaction, this, this._hostContainerInfo, {snip}'
                    ]
                  ],
                  symbolAddr: null,
                  origLineNo: '?'
                },
                {
                  function: 'Object.updateChildren',
                  map: 'vendor.js.map',
                  colNo: 0,
                  vars: {},
                  symbol: null,
                  mapUrl: 'http://localhost:8000/_static/1500500019/sentry/dist/vendor.js.map',
                  module: 'Users/billy/Dev/sentry/~/react/lib/ReactChildReconciler',
                  origAbsPath: '?',
                  lineNo: 110,
                  origColNo: '?',
                  origFunction: '?',
                  errors: null,
                  package: null,
                  absPath: 'webpack:////Users/billy/Dev/sentry/~/react/lib/ReactChildReconciler.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '~/react/lib/ReactChildReconciler.js',
                  origFilename: '?',
                  platform: null,
                  context: [
                    [105, '      }'],
                    [106, '      prevChild = prevChildren && prevChildren[name];'],
                    [
                      107,
                      '      var prevElement = prevChild && prevChild._currentElement;'
                    ],
                    [108, '      var nextElement = nextChildren[name];'],
                    [
                      109,
                      '      if (prevChild != null && shouldUpdateReactComponent(prevElement, nextElement)) {'
                    ],
                    [
                      110,
                      '        ReactReconciler.receiveComponent(prevChild, nextElement, transaction, context);'
                    ],
                    [111, '        nextChildren[name] = prevChild;'],
                    [112, '      } else {'],
                    [113, '        if (prevChild) {'],
                    [
                      114,
                      '          removedNodes[name] = ReactReconciler.getHostNode(prevChild);'
                    ],
                    [115, '          ReactReconciler.unmountComponent(prevChild, false);']
                  ],
                  symbolAddr: null,
                  origLineNo: '?'
                },
                {
                  function: 'Object.receiveComponent',
                  map: 'vendor.js.map',
                  colNo: 0,
                  vars: {},
                  symbol: null,
                  mapUrl: 'http://localhost:8000/_static/1500500019/sentry/dist/vendor.js.map',
                  module: 'Users/billy/Dev/sentry/~/react/lib/ReactReconciler',
                  origAbsPath: '?',
                  lineNo: 126,
                  origColNo: '?',
                  origFunction: '?',
                  errors: null,
                  package: null,
                  absPath: 'webpack:////Users/billy/Dev/sentry/~/react/lib/ReactReconciler.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '~/react/lib/ReactReconciler.js',
                  origFilename: '?',
                  platform: null,
                  context: [
                    [121, ''],
                    [122, '    if (refsChanged) {'],
                    [123, '      ReactRef.detachRefs(internalInstance, prevElement);'],
                    [124, '    }'],
                    [125, ''],
                    [
                      126,
                      '    internalInstance.receiveComponent(nextElement, transaction, context);'
                    ],
                    [127, ''],
                    [
                      128,
                      '    if (refsChanged && internalInstance._currentElement && internalInstance._currentElement.ref != null) {'
                    ],
                    [
                      129,
                      '      transaction.getReactMountReady().enqueue(attachRefs, internalInstance);'
                    ],
                    [130, '    }'],
                    [131, '']
                  ],
                  symbolAddr: null,
                  origLineNo: '?'
                },
                {
                  function: 'ReactDOMComponent.receiveComponent',
                  map: 'vendor.js.map',
                  colNo: 0,
                  vars: {},
                  symbol: null,
                  mapUrl: 'http://localhost:8000/_static/1500500019/sentry/dist/vendor.js.map',
                  module: 'Users/billy/Dev/sentry/~/react/lib/ReactDOMComponent',
                  origAbsPath: '?',
                  lineNo: 718,
                  origColNo: '?',
                  origFunction: '?',
                  errors: null,
                  package: null,
                  absPath: 'webpack:////Users/billy/Dev/sentry/~/react/lib/ReactDOMComponent.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '~/react/lib/ReactDOMComponent.js',
                  origFilename: '?',
                  platform: null,
                  context: [
                    [713, '   * @param {object} context'],
                    [714, '   */'],
                    [
                      715,
                      '  receiveComponent: function (nextElement, transaction, context) {'
                    ],
                    [716, '    var prevElement = this._currentElement;'],
                    [717, '    this._currentElement = nextElement;'],
                    [
                      718,
                      '    this.updateComponent(transaction, prevElement, nextElement, context);'
                    ],
                    [719, '  },'],
                    [720, ''],
                    [721, '  /**'],
                    [
                      722,
                      '   * Updates a DOM component after it has already been allocated and'
                    ],
                    [
                      723,
                      '   * attached to the DOM. Reconciles the root DOM node, then recurses.'
                    ]
                  ],
                  symbolAddr: null,
                  origLineNo: '?'
                },
                {
                  function: 'ReactDOMComponent.updateComponent',
                  map: 'vendor.js.map',
                  colNo: 0,
                  vars: {},
                  symbol: null,
                  mapUrl: 'http://localhost:8000/_static/1500500019/sentry/dist/vendor.js.map',
                  module: 'Users/billy/Dev/sentry/~/react/lib/ReactDOMComponent',
                  origAbsPath: '?',
                  lineNo: 760,
                  origColNo: '?',
                  origFunction: '?',
                  errors: null,
                  package: null,
                  absPath: 'webpack:////Users/billy/Dev/sentry/~/react/lib/ReactDOMComponent.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '~/react/lib/ReactDOMComponent.js',
                  origFilename: '?',
                  platform: null,
                  context: [
                    [755, '        break;'],
                    [756, '    }'],
                    [757, ''],
                    [758, '    assertValidProps(this, nextProps);'],
                    [
                      759,
                      '    this._updateDOMProperties(lastProps, nextProps, transaction);'
                    ],
                    [
                      760,
                      '    this._updateDOMChildren(lastProps, nextProps, transaction, context);'
                    ],
                    [761, ''],
                    [762, '    switch (this._tag) {'],
                    [763, "      case 'input':"],
                    [
                      764,
                      '        // Update the wrapper around inputs *after* updating props. This has to'
                    ],
                    [
                      765,
                      '        // happen after `_updateDOMProperties`. Otherwise HTML5 input validations'
                    ]
                  ],
                  symbolAddr: null,
                  origLineNo: '?'
                },
                {
                  function: 'ReactDOMComponent._updateDOMChildren',
                  map: 'vendor.js.map',
                  colNo: 0,
                  vars: {},
                  symbol: null,
                  mapUrl: 'http://localhost:8000/_static/1500500019/sentry/dist/vendor.js.map',
                  module: 'Users/billy/Dev/sentry/~/react/lib/ReactDOMComponent',
                  origAbsPath: '?',
                  lineNo: 942,
                  origColNo: '?',
                  origFunction: '?',
                  errors: null,
                  package: null,
                  absPath: 'webpack:////Users/billy/Dev/sentry/~/react/lib/ReactDOMComponent.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '~/react/lib/ReactDOMComponent.js',
                  origFilename: '?',
                  platform: null,
                  context: [
                    [937, '    } else if (nextChildren != null) {'],
                    [938, "      if (process.env.NODE_ENV !== 'production') {"],
                    [939, '        setAndValidateContentChildDev.call(this, null);'],
                    [940, '      }'],
                    [941, ''],
                    [
                      942,
                      '      this.updateChildren(nextChildren, transaction, context);'
                    ],
                    [943, '    }'],
                    [944, '  },'],
                    [945, ''],
                    [946, '  getHostNode: function () {'],
                    [947, '    return getNode(this);']
                  ],
                  symbolAddr: null,
                  origLineNo: '?'
                },
                {
                  function: 'ReactDOMComponent.updateChildren',
                  map: 'vendor.js.map',
                  colNo: 0,
                  vars: {},
                  symbol: null,
                  mapUrl: 'http://localhost:8000/_static/1500500019/sentry/dist/vendor.js.map',
                  module: 'Users/billy/Dev/sentry/~/react/lib/ReactMultiChild',
                  origAbsPath: '?',
                  lineNo: 301,
                  origColNo: '?',
                  origFunction: '?',
                  errors: null,
                  package: null,
                  absPath: 'webpack:////Users/billy/Dev/sentry/~/react/lib/ReactMultiChild.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '~/react/lib/ReactMultiChild.js',
                  origFilename: '?',
                  platform: null,
                  context: [
                    [296, '     * @param {ReactReconcileTransaction} transaction'],
                    [297, '     * @internal'],
                    [298, '     */'],
                    [
                      299,
                      '    updateChildren: function (nextNestedChildrenElements, transaction, context) {'
                    ],
                    [300, '      // Hook used by React ART'],
                    [
                      301,
                      '      this._updateChildren(nextNestedChildrenElements, transaction, context);'
                    ],
                    [302, '    },'],
                    [303, ''],
                    [304, '    /**'],
                    [
                      305,
                      '     * @param {?object} nextNestedChildrenElements Nested child element maps.'
                    ],
                    [306, '     * @param {ReactReconcileTransaction} transaction']
                  ],
                  symbolAddr: null,
                  origLineNo: '?'
                },
                {
                  function: 'ReactDOMComponent._updateChildren',
                  map: 'vendor.js.map',
                  colNo: 0,
                  vars: {},
                  symbol: null,
                  mapUrl: 'http://localhost:8000/_static/1500500019/sentry/dist/vendor.js.map',
                  module: 'Users/billy/Dev/sentry/~/react/lib/ReactMultiChild',
                  origAbsPath: '?',
                  lineNo: 314,
                  origColNo: '?',
                  origFunction: '?',
                  errors: null,
                  package: null,
                  absPath: 'webpack:////Users/billy/Dev/sentry/~/react/lib/ReactMultiChild.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '~/react/lib/ReactMultiChild.js',
                  origFilename: '?',
                  platform: null,
                  context: [
                    [309, '     */'],
                    [
                      310,
                      '    _updateChildren: function (nextNestedChildrenElements, transaction, context) {'
                    ],
                    [311, '      var prevChildren = this._renderedChildren;'],
                    [312, '      var removedNodes = {};'],
                    [313, '      var mountImages = [];'],
                    [
                      314,
                      '      var nextChildren = this._reconcilerUpdateChildren(prevChildren, nextNestedChildrenElements, mountImages, removedNodes, transaction, context);'
                    ],
                    [315, '      if (!nextChildren && !prevChildren) {'],
                    [316, '        return;'],
                    [317, '      }'],
                    [318, '      var updates = null;'],
                    [319, '      var name;']
                  ],
                  symbolAddr: null,
                  origLineNo: '?'
                },
                {
                  function: 'ReactDOMComponent._reconcilerUpdateChildren',
                  map: 'vendor.js.map',
                  colNo: 0,
                  vars: {},
                  symbol: null,
                  mapUrl: 'http://localhost:8000/_static/1500500019/sentry/dist/vendor.js.map',
                  module: 'Users/billy/Dev/sentry/~/react/lib/ReactMultiChild',
                  origAbsPath: '?',
                  lineNo: 210,
                  origColNo: '?',
                  origFunction: '?',
                  errors: null,
                  package: null,
                  absPath: 'webpack:////Users/billy/Dev/sentry/~/react/lib/ReactMultiChild.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '~/react/lib/ReactMultiChild.js',
                  origFilename: '?',
                  platform: null,
                  context: [
                    [
                      205,
                      '            ReactCurrentOwner.current = this._currentElement._owner;'
                    ],
                    [
                      206,
                      '            nextChildren = flattenChildren(nextNestedChildrenElements, selfDebugID);'
                    ],
                    [207, '          } finally {'],
                    [208, '            ReactCurrentOwner.current = null;'],
                    [209, '          }'],
                    [
                      210,
                      '          ReactChildReconciler.updateChildren(prevChildren, nextChildren, mountImages, removedNodes, transaction, this, this._hostContainerI {snip}'
                    ],
                    [211, '          return nextChildren;'],
                    [212, '        }'],
                    [213, '      }'],
                    [
                      214,
                      '      nextChildren = flattenChildren(nextNestedChildrenElements, selfDebugID);'
                    ],
                    [
                      215,
                      '      ReactChildReconciler.updateChildren(prevChildren, nextChildren, mountImages, removedNodes, transaction, this, this._hostContainerInfo, {snip}'
                    ]
                  ],
                  symbolAddr: null,
                  origLineNo: '?'
                },
                {
                  function: 'Object.updateChildren',
                  map: 'vendor.js.map',
                  colNo: 0,
                  vars: {},
                  symbol: null,
                  mapUrl: 'http://localhost:8000/_static/1500500019/sentry/dist/vendor.js.map',
                  module: 'Users/billy/Dev/sentry/~/react/lib/ReactChildReconciler',
                  origAbsPath: '?',
                  lineNo: 122,
                  origColNo: '?',
                  origFunction: '?',
                  errors: null,
                  package: null,
                  absPath: 'webpack:////Users/billy/Dev/sentry/~/react/lib/ReactChildReconciler.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '~/react/lib/ReactChildReconciler.js',
                  origFilename: '?',
                  platform: null,
                  context: [
                    [
                      117,
                      "        // The child must be instantiated before it's mounted."
                    ],
                    [
                      118,
                      '        var nextChildInstance = instantiateReactComponent(nextElement, true);'
                    ],
                    [119, '        nextChildren[name] = nextChildInstance;'],
                    [
                      120,
                      '        // Creating mount image now ensures refs are resolved in right order'
                    ],
                    [
                      121,
                      '        // (see https://github.com/facebook/react/pull/7101 for explanation).'
                    ],
                    [
                      122,
                      '        var nextChildMountImage = ReactReconciler.mountComponent(nextChildInstance, transaction, hostParent, hostContainerInfo, context, selfDebugID);'
                    ],
                    [123, '        mountImages.push(nextChildMountImage);'],
                    [124, '      }'],
                    [125, '    }'],
                    [126, '    // Unmount children that are no longer present.'],
                    [127, '    for (name in prevChildren) {']
                  ],
                  symbolAddr: null,
                  origLineNo: '?'
                },
                {
                  function: 'Object.mountComponent',
                  map: 'vendor.js.map',
                  colNo: 0,
                  vars: {},
                  symbol: null,
                  mapUrl: 'http://localhost:8000/_static/1500500019/sentry/dist/vendor.js.map',
                  module: 'Users/billy/Dev/sentry/~/react/lib/ReactReconciler',
                  origAbsPath: '?',
                  lineNo: 47,
                  origColNo: '?',
                  origFunction: '?',
                  errors: null,
                  package: null,
                  absPath: 'webpack:////Users/billy/Dev/sentry/~/react/lib/ReactReconciler.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '~/react/lib/ReactReconciler.js',
                  origFilename: '?',
                  platform: null,
                  context: [
                    [42, "    if (process.env.NODE_ENV !== 'production') {"],
                    [43, '      if (internalInstance._debugID !== 0) {'],
                    [
                      44,
                      '        ReactInstrumentation.debugTool.onBeforeMountComponent(internalInstance._debugID, internalInstance._currentElement, parentDebugID);'
                    ],
                    [45, '      }'],
                    [46, '    }'],
                    [
                      47,
                      '    var markup = internalInstance.mountComponent(transaction, hostParent, hostContainerInfo, context, parentDebugID);'
                    ],
                    [
                      48,
                      '    if (internalInstance._currentElement && internalInstance._currentElement.ref != null) {'
                    ],
                    [
                      49,
                      '      transaction.getReactMountReady().enqueue(attachRefs, internalInstance);'
                    ],
                    [50, '    }'],
                    [51, "    if (process.env.NODE_ENV !== 'production') {"],
                    [52, '      if (internalInstance._debugID !== 0) {']
                  ],
                  symbolAddr: null,
                  origLineNo: '?'
                },
                {
                  function: 'ReactDOMComponent.mountComponent',
                  map: 'vendor.js.map',
                  colNo: 0,
                  vars: {},
                  symbol: null,
                  mapUrl: 'http://localhost:8000/_static/1500500019/sentry/dist/vendor.js.map',
                  module: 'Users/billy/Dev/sentry/~/react/lib/ReactDOMComponent',
                  origAbsPath: '?',
                  lineNo: 524,
                  origColNo: '?',
                  origFunction: '?',
                  errors: null,
                  package: null,
                  absPath: 'webpack:////Users/billy/Dev/sentry/~/react/lib/ReactDOMComponent.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '~/react/lib/ReactDOMComponent.js',
                  origFilename: '?',
                  platform: null,
                  context: [
                    [519, '      if (!this._hostParent) {'],
                    [520, '        DOMPropertyOperations.setAttributeForRoot(el);'],
                    [521, '      }'],
                    [522, '      this._updateDOMProperties(null, props, transaction);'],
                    [523, '      var lazyTree = DOMLazyTree(el);'],
                    [
                      524,
                      '      this._createInitialChildren(transaction, props, context, lazyTree);'
                    ],
                    [525, '      mountImage = lazyTree;'],
                    [526, '    } else {'],
                    [
                      527,
                      '      var tagOpen = this._createOpenTagMarkupAndPutListeners(transaction, props);'
                    ],
                    [
                      528,
                      '      var tagContent = this._createContentMarkup(transaction, props, context);'
                    ],
                    [529, '      if (!tagContent && omittedCloseTags[this._tag]) {']
                  ],
                  symbolAddr: null,
                  origLineNo: '?'
                },
                {
                  function: 'ReactDOMComponent._createInitialChildren',
                  map: 'vendor.js.map',
                  colNo: 0,
                  vars: {},
                  symbol: null,
                  mapUrl: 'http://localhost:8000/_static/1500500019/sentry/dist/vendor.js.map',
                  module: 'Users/billy/Dev/sentry/~/react/lib/ReactDOMComponent',
                  origAbsPath: '?',
                  lineNo: 699,
                  origColNo: '?',
                  origFunction: '?',
                  errors: null,
                  package: null,
                  absPath: 'webpack:////Users/billy/Dev/sentry/~/react/lib/ReactDOMComponent.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '~/react/lib/ReactDOMComponent.js',
                  origFilename: '?',
                  platform: null,
                  context: [
                    [694, "        if (process.env.NODE_ENV !== 'production') {"],
                    [
                      695,
                      '          setAndValidateContentChildDev.call(this, contentToUse);'
                    ],
                    [696, '        }'],
                    [697, '        DOMLazyTree.queueText(lazyTree, contentToUse);'],
                    [698, '      } else if (childrenToUse != null) {'],
                    [
                      699,
                      '        var mountImages = this.mountChildren(childrenToUse, transaction, context);'
                    ],
                    [700, '        for (var i = 0; i < mountImages.length; i++) {'],
                    [701, '          DOMLazyTree.queueChild(lazyTree, mountImages[i]);'],
                    [702, '        }'],
                    [703, '      }'],
                    [704, '    }']
                  ],
                  symbolAddr: null,
                  origLineNo: '?'
                },
                {
                  function: 'ReactDOMComponent.mountChildren',
                  map: 'vendor.js.map',
                  colNo: 0,
                  vars: {},
                  symbol: null,
                  mapUrl: 'http://localhost:8000/_static/1500500019/sentry/dist/vendor.js.map',
                  module: 'Users/billy/Dev/sentry/~/react/lib/ReactMultiChild',
                  origAbsPath: '?',
                  lineNo: 240,
                  origColNo: '?',
                  origFunction: '?',
                  errors: null,
                  package: null,
                  absPath: 'webpack:////Users/billy/Dev/sentry/~/react/lib/ReactMultiChild.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '~/react/lib/ReactMultiChild.js',
                  origFilename: '?',
                  platform: null,
                  context: [
                    [235, '          var child = children[name];'],
                    [236, '          var selfDebugID = 0;'],
                    [237, "          if (process.env.NODE_ENV !== 'production') {"],
                    [238, '            selfDebugID = getDebugID(this);'],
                    [239, '          }'],
                    [
                      240,
                      '          var mountImage = ReactReconciler.mountComponent(child, transaction, this, this._hostContainerInfo, context, selfDebugID);'
                    ],
                    [241, '          child._mountIndex = index++;'],
                    [242, '          mountImages.push(mountImage);'],
                    [243, '        }'],
                    [244, '      }'],
                    [245, '']
                  ],
                  symbolAddr: null,
                  origLineNo: '?'
                },
                {
                  function: 'Object.mountComponent',
                  map: 'vendor.js.map',
                  colNo: 0,
                  vars: {},
                  symbol: null,
                  mapUrl: 'http://localhost:8000/_static/1500500019/sentry/dist/vendor.js.map',
                  module: 'Users/billy/Dev/sentry/~/react/lib/ReactReconciler',
                  origAbsPath: '?',
                  lineNo: 47,
                  origColNo: '?',
                  origFunction: '?',
                  errors: null,
                  package: null,
                  absPath: 'webpack:////Users/billy/Dev/sentry/~/react/lib/ReactReconciler.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '~/react/lib/ReactReconciler.js',
                  origFilename: '?',
                  platform: null,
                  context: [
                    [42, "    if (process.env.NODE_ENV !== 'production') {"],
                    [43, '      if (internalInstance._debugID !== 0) {'],
                    [
                      44,
                      '        ReactInstrumentation.debugTool.onBeforeMountComponent(internalInstance._debugID, internalInstance._currentElement, parentDebugID);'
                    ],
                    [45, '      }'],
                    [46, '    }'],
                    [
                      47,
                      '    var markup = internalInstance.mountComponent(transaction, hostParent, hostContainerInfo, context, parentDebugID);'
                    ],
                    [
                      48,
                      '    if (internalInstance._currentElement && internalInstance._currentElement.ref != null) {'
                    ],
                    [
                      49,
                      '      transaction.getReactMountReady().enqueue(attachRefs, internalInstance);'
                    ],
                    [50, '    }'],
                    [51, "    if (process.env.NODE_ENV !== 'production') {"],
                    [52, '      if (internalInstance._debugID !== 0) {']
                  ],
                  symbolAddr: null,
                  origLineNo: '?'
                },
                {
                  function: 'ReactCompositeComponentWrapper.mountComponent',
                  map: 'vendor.js.map',
                  colNo: 0,
                  vars: {},
                  symbol: null,
                  mapUrl: 'http://localhost:8000/_static/1500500019/sentry/dist/vendor.js.map',
                  module: 'Users/billy/Dev/sentry/~/react/lib/ReactCompositeComponent',
                  origAbsPath: '?',
                  lineNo: 257,
                  origColNo: '?',
                  origFunction: '?',
                  errors: null,
                  package: null,
                  absPath: 'webpack:////Users/billy/Dev/sentry/~/react/lib/ReactCompositeComponent.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '~/react/lib/ReactCompositeComponent.js',
                  origFilename: '?',
                  platform: null,
                  context: [
                    [252, ''],
                    [253, '    var markup;'],
                    [254, '    if (inst.unstable_handleError) {'],
                    [
                      255,
                      '      markup = this.performInitialMountWithErrorHandling(renderedElement, hostParent, hostContainerInfo, transaction, context);'
                    ],
                    [256, '    } else {'],
                    [
                      257,
                      '      markup = this.performInitialMount(renderedElement, hostParent, hostContainerInfo, transaction, context);'
                    ],
                    [258, '    }'],
                    [259, ''],
                    [260, '    if (inst.componentDidMount) {'],
                    [261, "      if (process.env.NODE_ENV !== 'production') {"],
                    [
                      262,
                      '        transaction.getReactMountReady().enqueue(function () {'
                    ]
                  ],
                  symbolAddr: null,
                  origLineNo: '?'
                },
                {
                  function: 'ReactCompositeComponentWrapper.performInitialMount',
                  map: 'vendor.js.map',
                  colNo: 0,
                  vars: {},
                  symbol: null,
                  mapUrl: 'http://localhost:8000/_static/1500500019/sentry/dist/vendor.js.map',
                  module: 'Users/billy/Dev/sentry/~/react/lib/ReactCompositeComponent',
                  origAbsPath: '?',
                  lineNo: 370,
                  origColNo: '?',
                  origFunction: '?',
                  errors: null,
                  package: null,
                  absPath: 'webpack:////Users/billy/Dev/sentry/~/react/lib/ReactCompositeComponent.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '~/react/lib/ReactCompositeComponent.js',
                  origFilename: '?',
                  platform: null,
                  context: [
                    [365, '    this._renderedNodeType = nodeType;'],
                    [
                      366,
                      '    var child = this._instantiateReactComponent(renderedElement, nodeType !== ReactNodeTypes.EMPTY /* shouldHaveDebugID */'
                    ],
                    [367, '    );'],
                    [368, '    this._renderedComponent = child;'],
                    [369, ''],
                    [
                      370,
                      '    var markup = ReactReconciler.mountComponent(child, transaction, hostParent, hostContainerInfo, this._processChildContext(context), debugID);'
                    ],
                    [371, ''],
                    [372, "    if (process.env.NODE_ENV !== 'production') {"],
                    [373, '      if (debugID !== 0) {'],
                    [
                      374,
                      '        var childDebugIDs = child._debugID !== 0 ? [child._debugID] : [];'
                    ],
                    [
                      375,
                      '        ReactInstrumentation.debugTool.onSetChildren(debugID, childDebugIDs);'
                    ]
                  ],
                  symbolAddr: null,
                  origLineNo: '?'
                },
                {
                  function: 'Object.mountComponent',
                  map: 'vendor.js.map',
                  colNo: 0,
                  vars: {},
                  symbol: null,
                  mapUrl: 'http://localhost:8000/_static/1500500019/sentry/dist/vendor.js.map',
                  module: 'Users/billy/Dev/sentry/~/react/lib/ReactReconciler',
                  origAbsPath: '?',
                  lineNo: 47,
                  origColNo: '?',
                  origFunction: '?',
                  errors: null,
                  package: null,
                  absPath: 'webpack:////Users/billy/Dev/sentry/~/react/lib/ReactReconciler.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '~/react/lib/ReactReconciler.js',
                  origFilename: '?',
                  platform: null,
                  context: [
                    [42, "    if (process.env.NODE_ENV !== 'production') {"],
                    [43, '      if (internalInstance._debugID !== 0) {'],
                    [
                      44,
                      '        ReactInstrumentation.debugTool.onBeforeMountComponent(internalInstance._debugID, internalInstance._currentElement, parentDebugID);'
                    ],
                    [45, '      }'],
                    [46, '    }'],
                    [
                      47,
                      '    var markup = internalInstance.mountComponent(transaction, hostParent, hostContainerInfo, context, parentDebugID);'
                    ],
                    [
                      48,
                      '    if (internalInstance._currentElement && internalInstance._currentElement.ref != null) {'
                    ],
                    [
                      49,
                      '      transaction.getReactMountReady().enqueue(attachRefs, internalInstance);'
                    ],
                    [50, '    }'],
                    [51, "    if (process.env.NODE_ENV !== 'production') {"],
                    [52, '      if (internalInstance._debugID !== 0) {']
                  ],
                  symbolAddr: null,
                  origLineNo: '?'
                },
                {
                  function: 'ReactDOMComponent.mountComponent',
                  map: 'vendor.js.map',
                  colNo: 0,
                  vars: {},
                  symbol: null,
                  mapUrl: 'http://localhost:8000/_static/1500500019/sentry/dist/vendor.js.map',
                  module: 'Users/billy/Dev/sentry/~/react/lib/ReactDOMComponent',
                  origAbsPath: '?',
                  lineNo: 524,
                  origColNo: '?',
                  origFunction: '?',
                  errors: null,
                  package: null,
                  absPath: 'webpack:////Users/billy/Dev/sentry/~/react/lib/ReactDOMComponent.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '~/react/lib/ReactDOMComponent.js',
                  origFilename: '?',
                  platform: null,
                  context: [
                    [519, '      if (!this._hostParent) {'],
                    [520, '        DOMPropertyOperations.setAttributeForRoot(el);'],
                    [521, '      }'],
                    [522, '      this._updateDOMProperties(null, props, transaction);'],
                    [523, '      var lazyTree = DOMLazyTree(el);'],
                    [
                      524,
                      '      this._createInitialChildren(transaction, props, context, lazyTree);'
                    ],
                    [525, '      mountImage = lazyTree;'],
                    [526, '    } else {'],
                    [
                      527,
                      '      var tagOpen = this._createOpenTagMarkupAndPutListeners(transaction, props);'
                    ],
                    [
                      528,
                      '      var tagContent = this._createContentMarkup(transaction, props, context);'
                    ],
                    [529, '      if (!tagContent && omittedCloseTags[this._tag]) {']
                  ],
                  symbolAddr: null,
                  origLineNo: '?'
                },
                {
                  function: 'ReactDOMComponent._createInitialChildren',
                  map: 'vendor.js.map',
                  colNo: 0,
                  vars: {},
                  symbol: null,
                  mapUrl: 'http://localhost:8000/_static/1500500019/sentry/dist/vendor.js.map',
                  module: 'Users/billy/Dev/sentry/~/react/lib/ReactDOMComponent',
                  origAbsPath: '?',
                  lineNo: 699,
                  origColNo: '?',
                  origFunction: '?',
                  errors: null,
                  package: null,
                  absPath: 'webpack:////Users/billy/Dev/sentry/~/react/lib/ReactDOMComponent.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '~/react/lib/ReactDOMComponent.js',
                  origFilename: '?',
                  platform: null,
                  context: [
                    [694, "        if (process.env.NODE_ENV !== 'production') {"],
                    [
                      695,
                      '          setAndValidateContentChildDev.call(this, contentToUse);'
                    ],
                    [696, '        }'],
                    [697, '        DOMLazyTree.queueText(lazyTree, contentToUse);'],
                    [698, '      } else if (childrenToUse != null) {'],
                    [
                      699,
                      '        var mountImages = this.mountChildren(childrenToUse, transaction, context);'
                    ],
                    [700, '        for (var i = 0; i < mountImages.length; i++) {'],
                    [701, '          DOMLazyTree.queueChild(lazyTree, mountImages[i]);'],
                    [702, '        }'],
                    [703, '      }'],
                    [704, '    }']
                  ],
                  symbolAddr: null,
                  origLineNo: '?'
                },
                {
                  function: 'ReactDOMComponent.mountChildren',
                  map: 'vendor.js.map',
                  colNo: 0,
                  vars: {},
                  symbol: null,
                  mapUrl: 'http://localhost:8000/_static/1500500019/sentry/dist/vendor.js.map',
                  module: 'Users/billy/Dev/sentry/~/react/lib/ReactMultiChild',
                  origAbsPath: '?',
                  lineNo: 240,
                  origColNo: '?',
                  origFunction: '?',
                  errors: null,
                  package: null,
                  absPath: 'webpack:////Users/billy/Dev/sentry/~/react/lib/ReactMultiChild.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '~/react/lib/ReactMultiChild.js',
                  origFilename: '?',
                  platform: null,
                  context: [
                    [235, '          var child = children[name];'],
                    [236, '          var selfDebugID = 0;'],
                    [237, "          if (process.env.NODE_ENV !== 'production') {"],
                    [238, '            selfDebugID = getDebugID(this);'],
                    [239, '          }'],
                    [
                      240,
                      '          var mountImage = ReactReconciler.mountComponent(child, transaction, this, this._hostContainerInfo, context, selfDebugID);'
                    ],
                    [241, '          child._mountIndex = index++;'],
                    [242, '          mountImages.push(mountImage);'],
                    [243, '        }'],
                    [244, '      }'],
                    [245, '']
                  ],
                  symbolAddr: null,
                  origLineNo: '?'
                },
                {
                  function: 'Object.mountComponent',
                  map: 'vendor.js.map',
                  colNo: 0,
                  vars: {},
                  symbol: null,
                  mapUrl: 'http://localhost:8000/_static/1500500019/sentry/dist/vendor.js.map',
                  module: 'Users/billy/Dev/sentry/~/react/lib/ReactReconciler',
                  origAbsPath: '?',
                  lineNo: 47,
                  origColNo: '?',
                  origFunction: '?',
                  errors: null,
                  package: null,
                  absPath: 'webpack:////Users/billy/Dev/sentry/~/react/lib/ReactReconciler.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '~/react/lib/ReactReconciler.js',
                  origFilename: '?',
                  platform: null,
                  context: [
                    [42, "    if (process.env.NODE_ENV !== 'production') {"],
                    [43, '      if (internalInstance._debugID !== 0) {'],
                    [
                      44,
                      '        ReactInstrumentation.debugTool.onBeforeMountComponent(internalInstance._debugID, internalInstance._currentElement, parentDebugID);'
                    ],
                    [45, '      }'],
                    [46, '    }'],
                    [
                      47,
                      '    var markup = internalInstance.mountComponent(transaction, hostParent, hostContainerInfo, context, parentDebugID);'
                    ],
                    [
                      48,
                      '    if (internalInstance._currentElement && internalInstance._currentElement.ref != null) {'
                    ],
                    [
                      49,
                      '      transaction.getReactMountReady().enqueue(attachRefs, internalInstance);'
                    ],
                    [50, '    }'],
                    [51, "    if (process.env.NODE_ENV !== 'production') {"],
                    [52, '      if (internalInstance._debugID !== 0) {']
                  ],
                  symbolAddr: null,
                  origLineNo: '?'
                },
                {
                  function: 'ReactDOMComponent.mountComponent',
                  map: 'vendor.js.map',
                  colNo: 0,
                  vars: {},
                  symbol: null,
                  mapUrl: 'http://localhost:8000/_static/1500500019/sentry/dist/vendor.js.map',
                  module: 'Users/billy/Dev/sentry/~/react/lib/ReactDOMComponent',
                  origAbsPath: '?',
                  lineNo: 524,
                  origColNo: '?',
                  origFunction: '?',
                  errors: null,
                  package: null,
                  absPath: 'webpack:////Users/billy/Dev/sentry/~/react/lib/ReactDOMComponent.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '~/react/lib/ReactDOMComponent.js',
                  origFilename: '?',
                  platform: null,
                  context: [
                    [519, '      if (!this._hostParent) {'],
                    [520, '        DOMPropertyOperations.setAttributeForRoot(el);'],
                    [521, '      }'],
                    [522, '      this._updateDOMProperties(null, props, transaction);'],
                    [523, '      var lazyTree = DOMLazyTree(el);'],
                    [
                      524,
                      '      this._createInitialChildren(transaction, props, context, lazyTree);'
                    ],
                    [525, '      mountImage = lazyTree;'],
                    [526, '    } else {'],
                    [
                      527,
                      '      var tagOpen = this._createOpenTagMarkupAndPutListeners(transaction, props);'
                    ],
                    [
                      528,
                      '      var tagContent = this._createContentMarkup(transaction, props, context);'
                    ],
                    [529, '      if (!tagContent && omittedCloseTags[this._tag]) {']
                  ],
                  symbolAddr: null,
                  origLineNo: '?'
                },
                {
                  function: 'ReactDOMComponent._createInitialChildren',
                  map: 'vendor.js.map',
                  colNo: 0,
                  vars: {},
                  symbol: null,
                  mapUrl: 'http://localhost:8000/_static/1500500019/sentry/dist/vendor.js.map',
                  module: 'Users/billy/Dev/sentry/~/react/lib/ReactDOMComponent',
                  origAbsPath: '?',
                  lineNo: 699,
                  origColNo: '?',
                  origFunction: '?',
                  errors: null,
                  package: null,
                  absPath: 'webpack:////Users/billy/Dev/sentry/~/react/lib/ReactDOMComponent.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '~/react/lib/ReactDOMComponent.js',
                  origFilename: '?',
                  platform: null,
                  context: [
                    [694, "        if (process.env.NODE_ENV !== 'production') {"],
                    [
                      695,
                      '          setAndValidateContentChildDev.call(this, contentToUse);'
                    ],
                    [696, '        }'],
                    [697, '        DOMLazyTree.queueText(lazyTree, contentToUse);'],
                    [698, '      } else if (childrenToUse != null) {'],
                    [
                      699,
                      '        var mountImages = this.mountChildren(childrenToUse, transaction, context);'
                    ],
                    [700, '        for (var i = 0; i < mountImages.length; i++) {'],
                    [701, '          DOMLazyTree.queueChild(lazyTree, mountImages[i]);'],
                    [702, '        }'],
                    [703, '      }'],
                    [704, '    }']
                  ],
                  symbolAddr: null,
                  origLineNo: '?'
                },
                {
                  function: 'ReactDOMComponent.mountChildren',
                  map: 'vendor.js.map',
                  colNo: 0,
                  vars: {},
                  symbol: null,
                  mapUrl: 'http://localhost:8000/_static/1500500019/sentry/dist/vendor.js.map',
                  module: 'Users/billy/Dev/sentry/~/react/lib/ReactMultiChild',
                  origAbsPath: '?',
                  lineNo: 240,
                  origColNo: '?',
                  origFunction: '?',
                  errors: null,
                  package: null,
                  absPath: 'webpack:////Users/billy/Dev/sentry/~/react/lib/ReactMultiChild.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '~/react/lib/ReactMultiChild.js',
                  origFilename: '?',
                  platform: null,
                  context: [
                    [235, '          var child = children[name];'],
                    [236, '          var selfDebugID = 0;'],
                    [237, "          if (process.env.NODE_ENV !== 'production') {"],
                    [238, '            selfDebugID = getDebugID(this);'],
                    [239, '          }'],
                    [
                      240,
                      '          var mountImage = ReactReconciler.mountComponent(child, transaction, this, this._hostContainerInfo, context, selfDebugID);'
                    ],
                    [241, '          child._mountIndex = index++;'],
                    [242, '          mountImages.push(mountImage);'],
                    [243, '        }'],
                    [244, '      }'],
                    [245, '']
                  ],
                  symbolAddr: null,
                  origLineNo: '?'
                },
                {
                  function: 'Object.mountComponent',
                  map: 'vendor.js.map',
                  colNo: 0,
                  vars: {},
                  symbol: null,
                  mapUrl: 'http://localhost:8000/_static/1500500019/sentry/dist/vendor.js.map',
                  module: 'Users/billy/Dev/sentry/~/react/lib/ReactReconciler',
                  origAbsPath: '?',
                  lineNo: 47,
                  origColNo: '?',
                  origFunction: '?',
                  errors: null,
                  package: null,
                  absPath: 'webpack:////Users/billy/Dev/sentry/~/react/lib/ReactReconciler.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '~/react/lib/ReactReconciler.js',
                  origFilename: '?',
                  platform: null,
                  context: [
                    [42, "    if (process.env.NODE_ENV !== 'production') {"],
                    [43, '      if (internalInstance._debugID !== 0) {'],
                    [
                      44,
                      '        ReactInstrumentation.debugTool.onBeforeMountComponent(internalInstance._debugID, internalInstance._currentElement, parentDebugID);'
                    ],
                    [45, '      }'],
                    [46, '    }'],
                    [
                      47,
                      '    var markup = internalInstance.mountComponent(transaction, hostParent, hostContainerInfo, context, parentDebugID);'
                    ],
                    [
                      48,
                      '    if (internalInstance._currentElement && internalInstance._currentElement.ref != null) {'
                    ],
                    [
                      49,
                      '      transaction.getReactMountReady().enqueue(attachRefs, internalInstance);'
                    ],
                    [50, '    }'],
                    [51, "    if (process.env.NODE_ENV !== 'production') {"],
                    [52, '      if (internalInstance._debugID !== 0) {']
                  ],
                  symbolAddr: null,
                  origLineNo: '?'
                },
                {
                  function: 'ReactCompositeComponentWrapper.mountComponent',
                  map: 'vendor.js.map',
                  colNo: 0,
                  vars: {},
                  symbol: null,
                  mapUrl: 'http://localhost:8000/_static/1500500019/sentry/dist/vendor.js.map',
                  module: 'Users/billy/Dev/sentry/~/react/lib/ReactCompositeComponent',
                  origAbsPath: '?',
                  lineNo: 257,
                  origColNo: '?',
                  origFunction: '?',
                  errors: null,
                  package: null,
                  absPath: 'webpack:////Users/billy/Dev/sentry/~/react/lib/ReactCompositeComponent.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '~/react/lib/ReactCompositeComponent.js',
                  origFilename: '?',
                  platform: null,
                  context: [
                    [252, ''],
                    [253, '    var markup;'],
                    [254, '    if (inst.unstable_handleError) {'],
                    [
                      255,
                      '      markup = this.performInitialMountWithErrorHandling(renderedElement, hostParent, hostContainerInfo, transaction, context);'
                    ],
                    [256, '    } else {'],
                    [
                      257,
                      '      markup = this.performInitialMount(renderedElement, hostParent, hostContainerInfo, transaction, context);'
                    ],
                    [258, '    }'],
                    [259, ''],
                    [260, '    if (inst.componentDidMount) {'],
                    [261, "      if (process.env.NODE_ENV !== 'production') {"],
                    [
                      262,
                      '        transaction.getReactMountReady().enqueue(function () {'
                    ]
                  ],
                  symbolAddr: null,
                  origLineNo: '?'
                },
                {
                  function: 'ReactCompositeComponentWrapper.performInitialMount',
                  map: 'vendor.js.map',
                  colNo: 0,
                  vars: {},
                  symbol: null,
                  mapUrl: 'http://localhost:8000/_static/1500500019/sentry/dist/vendor.js.map',
                  module: 'Users/billy/Dev/sentry/~/react/lib/ReactCompositeComponent',
                  origAbsPath: '?',
                  lineNo: 361,
                  origColNo: '?',
                  origFunction: '?',
                  errors: null,
                  package: null,
                  absPath: 'webpack:////Users/billy/Dev/sentry/~/react/lib/ReactCompositeComponent.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '~/react/lib/ReactCompositeComponent.js',
                  origFilename: '?',
                  platform: null,
                  context: [
                    [356, '      }'],
                    [357, '    }'],
                    [358, ''],
                    [359, '    // If not a stateless component, we now render'],
                    [360, '    if (renderedElement === undefined) {'],
                    [361, '      renderedElement = this._renderValidatedComponent();'],
                    [362, '    }'],
                    [363, ''],
                    [364, '    var nodeType = ReactNodeTypes.getType(renderedElement);'],
                    [365, '    this._renderedNodeType = nodeType;'],
                    [
                      366,
                      '    var child = this._instantiateReactComponent(renderedElement, nodeType !== ReactNodeTypes.EMPTY /* shouldHaveDebugID */'
                    ]
                  ],
                  symbolAddr: null,
                  origLineNo: '?'
                },
                {
                  function: 'ReactCompositeComponentWrapper._renderValidatedComponent',
                  map: 'vendor.js.map',
                  colNo: 0,
                  vars: {},
                  symbol: null,
                  mapUrl: 'http://localhost:8000/_static/1500500019/sentry/dist/vendor.js.map',
                  module: 'Users/billy/Dev/sentry/~/react/lib/ReactCompositeComponent',
                  origAbsPath: '?',
                  lineNo: 819,
                  origColNo: '?',
                  origFunction: '?',
                  errors: null,
                  package: null,
                  absPath: 'webpack:////Users/billy/Dev/sentry/~/react/lib/ReactCompositeComponent.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '~/react/lib/ReactCompositeComponent.js',
                  origFilename: '?',
                  platform: null,
                  context: [
                    [814, '  _renderValidatedComponent: function () {'],
                    [815, '    var renderedComponent;'],
                    [
                      816,
                      "    if (process.env.NODE_ENV !== 'production' || this._compositeType !== CompositeTypes.StatelessFunctional) {"
                    ],
                    [817, '      ReactCurrentOwner.current = this;'],
                    [818, '      try {'],
                    [
                      819,
                      '        renderedComponent = this._renderValidatedComponentWithoutOwnerOrContext();'
                    ],
                    [820, '      } finally {'],
                    [821, '        ReactCurrentOwner.current = null;'],
                    [822, '      }'],
                    [823, '    } else {'],
                    [
                      824,
                      '      renderedComponent = this._renderValidatedComponentWithoutOwnerOrContext();'
                    ]
                  ],
                  symbolAddr: null,
                  origLineNo: '?'
                },
                {
                  function: 'ReactCompositeComponentWrapper._renderValidatedComponentWithoutOwnerOrContext',
                  map: 'vendor.js.map',
                  colNo: 0,
                  vars: {},
                  symbol: null,
                  mapUrl: 'http://localhost:8000/_static/1500500019/sentry/dist/vendor.js.map',
                  module: 'Users/billy/Dev/sentry/~/react/lib/ReactCompositeComponent',
                  origAbsPath: '?',
                  lineNo: 792,
                  origColNo: '?',
                  origFunction: '?',
                  errors: null,
                  package: null,
                  absPath: 'webpack:////Users/billy/Dev/sentry/~/react/lib/ReactCompositeComponent.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '~/react/lib/ReactCompositeComponent.js',
                  origFilename: '?',
                  platform: null,
                  context: [
                    [
                      787,
                      '  _renderValidatedComponentWithoutOwnerOrContext: function () {'
                    ],
                    [788, '    var inst = this._instance;'],
                    [789, '    var renderedComponent;'],
                    [790, ''],
                    [791, "    if (process.env.NODE_ENV !== 'production') {"],
                    [792, '      renderedComponent = measureLifeCyclePerf(function () {'],
                    [793, '        return inst.render();'],
                    [794, "      }, this._debugID, 'render');"],
                    [795, '    } else {'],
                    [796, '      renderedComponent = inst.render();'],
                    [797, '    }']
                  ],
                  symbolAddr: null,
                  origLineNo: '?'
                },
                {
                  function: 'measureLifeCyclePerf',
                  map: 'vendor.js.map',
                  colNo: 0,
                  vars: {},
                  symbol: null,
                  mapUrl: 'http://localhost:8000/_static/1500500019/sentry/dist/vendor.js.map',
                  module: 'Users/billy/Dev/sentry/~/react/lib/ReactCompositeComponent',
                  origAbsPath: '?',
                  lineNo: 74,
                  origColNo: '?',
                  origFunction: '?',
                  errors: null,
                  package: null,
                  absPath: 'webpack:////Users/billy/Dev/sentry/~/react/lib/ReactCompositeComponent.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '~/react/lib/ReactCompositeComponent.js',
                  origFilename: '?',
                  platform: null,
                  context: [
                    [69, '    return fn();'],
                    [70, '  }'],
                    [71, ''],
                    [
                      72,
                      '  ReactInstrumentation.debugTool.onBeginLifeCycleTimer(debugID, timerType);'
                    ],
                    [73, '  try {'],
                    [74, '    return fn();'],
                    [75, '  } finally {'],
                    [
                      76,
                      '    ReactInstrumentation.debugTool.onEndLifeCycleTimer(debugID, timerType);'
                    ],
                    [77, '  }'],
                    [78, '}'],
                    [79, '']
                  ],
                  symbolAddr: null,
                  origLineNo: '?'
                },
                {
                  function: null,
                  map: 'vendor.js.map',
                  colNo: 0,
                  vars: {},
                  symbol: null,
                  mapUrl: 'http://localhost:8000/_static/1500500019/sentry/dist/vendor.js.map',
                  module: 'Users/billy/Dev/sentry/~/react/lib/ReactCompositeComponent',
                  origAbsPath: '?',
                  lineNo: 793,
                  origColNo: '?',
                  origFunction: '?',
                  errors: null,
                  package: null,
                  absPath: 'webpack:////Users/billy/Dev/sentry/~/react/lib/ReactCompositeComponent.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '~/react/lib/ReactCompositeComponent.js',
                  origFilename: '?',
                  platform: null,
                  context: [
                    [788, '    var inst = this._instance;'],
                    [789, '    var renderedComponent;'],
                    [790, ''],
                    [791, "    if (process.env.NODE_ENV !== 'production') {"],
                    [792, '      renderedComponent = measureLifeCyclePerf(function () {'],
                    [793, '        return inst.render();'],
                    [794, "      }, this._debugID, 'render');"],
                    [795, '    } else {'],
                    [796, '      renderedComponent = inst.render();'],
                    [797, '    }'],
                    [798, '']
                  ],
                  symbolAddr: null,
                  origLineNo: '?'
                },
                {
                  function: 'StreamGroupHeader.render',
                  map: 'app.js.map',
                  colNo: 0,
                  vars: {},
                  symbol: null,
                  mapUrl: 'http://localhost:8000/_static/1500500019/sentry/dist/app.js.map',
                  module: 'app/components/stream/StreamGroupHeader',
                  origAbsPath: '?',
                  lineNo: 54,
                  origColNo: '?',
                  origFunction: '?',
                  errors: null,
                  package: null,
                  absPath: 'webpack:///./app/components/stream/StreamGroupHeader.jsx',
                  inApp: true,
                  instructionAddr: null,
                  filename: './app/components/stream/StreamGroupHeader.jsx',
                  origFilename: '?',
                  platform: null,
                  context: [
                    [49, '      var id = data.id,'],
                    [50, '          level = data.level;'],
                    [51, ''],
                    [52, '      var message = this.getMessage();'],
                    [53, '      return React.createElement('],
                    [54, "        'div',"],
                    [55, '        null,'],
                    [56, '        React.createElement('],
                    [57, "          'h3',"],
                    [58, "          { className: 'truncate' },"],
                    [59, '          React.createElement(']
                  ],
                  symbolAddr: null,
                  origLineNo: '?'
                }
              ],
              framesOmitted: null,
              registers: null,
              hasSystemFrames: true
            },
            module: null,
            rawStacktrace: {
              frames: [
                {
                  function: 'ReactCompositeComponentWrapper.updateComponent',
                  colNo: 12,
                  vars: {},
                  symbol: null,
                  module: null,
                  lineNo: 74609,
                  errors: null,
                  package: null,
                  absPath: 'http://localhost:8000/_static/1500500019/sentry/dist/vendor.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '/_static/1500500019/sentry/dist/vendor.js',
                  platform: null,
                  context: [
                    [74604, ''],
                    [74605, '    this._updateBatchNumber = null;'],
                    [74606, '    if (shouldUpdate) {'],
                    [74607, '      this._pendingForceUpdate = false;'],
                    [
                      74608,
                      '      // Will set `this.props`, `this.state` and `this.context`.'
                    ],
                    [
                      74609,
                      '      this._performComponentUpdate(nextParentElement, nextProps, nextState, nextContext, transaction, nextUnmaskedContext);'
                    ],
                    [74610, '    } else {'],
                    [
                      74611,
                      "      // If it's determined that a component should not update, we still want"
                    ],
                    [
                      74612,
                      '      // to set props and state but we shortcut the rest of the update.'
                    ],
                    [74613, '      this._currentElement = nextParentElement;'],
                    [74614, '      this._context = nextUnmaskedContext;']
                  ],
                  symbolAddr: null
                },
                {
                  function: 'ReactCompositeComponentWrapper._performComponentUpdate',
                  colNo: 10,
                  vars: {},
                  symbol: null,
                  module: null,
                  lineNo: 74688,
                  errors: null,
                  package: null,
                  absPath: 'http://localhost:8000/_static/1500500019/sentry/dist/vendor.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '/_static/1500500019/sentry/dist/vendor.js',
                  platform: null,
                  context: [
                    [74683, '    this._context = unmaskedContext;'],
                    [74684, '    inst.props = nextProps;'],
                    [74685, '    inst.state = nextState;'],
                    [74686, '    inst.context = nextContext;'],
                    [74687, ''],
                    [
                      74688,
                      '    this._updateRenderedComponent(transaction, unmaskedContext);'
                    ],
                    [74689, ''],
                    [74690, '    if (hasComponentDidUpdate) {'],
                    [74691, "      if (undefined !== 'production') {"],
                    [
                      74692,
                      '        transaction.getReactMountReady().enqueue(function () {'
                    ],
                    [
                      74693,
                      "          measureLifeCyclePerf(inst.componentDidUpdate.bind(inst, prevProps, prevState, prevContext), _this2._debugID, 'componentDidUpdate');"
                    ]
                  ],
                  symbolAddr: null
                },
                {
                  function: 'ReactCompositeComponentWrapper._updateRenderedComponent',
                  colNo: 23,
                  vars: {},
                  symbol: null,
                  module: null,
                  lineNo: 74718,
                  errors: null,
                  package: null,
                  absPath: 'http://localhost:8000/_static/1500500019/sentry/dist/vendor.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '/_static/1500500019/sentry/dist/vendor.js',
                  platform: null,
                  context: [
                    [74713, "    if (undefined !== 'production') {"],
                    [74714, '      debugID = this._debugID;'],
                    [74715, '    }'],
                    [74716, ''],
                    [
                      74717,
                      '    if (shouldUpdateReactComponent(prevRenderedElement, nextRenderedElement)) {'
                    ],
                    [
                      74718,
                      '      ReactReconciler.receiveComponent(prevComponentInstance, nextRenderedElement, transaction, this._processChildContext(context));'
                    ],
                    [74719, '    } else {'],
                    [
                      74720,
                      '      var oldHostNode = ReactReconciler.getHostNode(prevComponentInstance);'
                    ],
                    [
                      74721,
                      '      ReactReconciler.unmountComponent(prevComponentInstance, false);'
                    ],
                    [74722, ''],
                    [
                      74723,
                      '      var nodeType = ReactNodeTypes.getType(nextRenderedElement);'
                    ]
                  ],
                  symbolAddr: null
                },
                {
                  function: 'Object.receiveComponent',
                  colNo: 22,
                  vars: {},
                  symbol: null,
                  module: null,
                  lineNo: 19382,
                  errors: null,
                  package: null,
                  absPath: 'http://localhost:8000/_static/1500500019/sentry/dist/vendor.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '/_static/1500500019/sentry/dist/vendor.js',
                  platform: null,
                  context: [
                    [19377, ''],
                    [19378, '    if (refsChanged) {'],
                    [19379, '      ReactRef.detachRefs(internalInstance, prevElement);'],
                    [19380, '    }'],
                    [19381, ''],
                    [
                      19382,
                      '    internalInstance.receiveComponent(nextElement, transaction, context);'
                    ],
                    [19383, ''],
                    [
                      19384,
                      '    if (refsChanged && internalInstance._currentElement && internalInstance._currentElement.ref != null) {'
                    ],
                    [
                      19385,
                      '      transaction.getReactMountReady().enqueue(attachRefs, internalInstance);'
                    ],
                    [19386, '    }'],
                    [19387, '']
                  ],
                  symbolAddr: null
                },
                {
                  function: 'ReactDOMComponent.receiveComponent',
                  colNo: 10,
                  vars: {},
                  symbol: null,
                  module: null,
                  lineNo: 75635,
                  errors: null,
                  package: null,
                  absPath: 'http://localhost:8000/_static/1500500019/sentry/dist/vendor.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '/_static/1500500019/sentry/dist/vendor.js',
                  platform: null,
                  context: [
                    [75630, '   * @param {object} context'],
                    [75631, '   */'],
                    [
                      75632,
                      '  receiveComponent: function (nextElement, transaction, context) {'
                    ],
                    [75633, '    var prevElement = this._currentElement;'],
                    [75634, '    this._currentElement = nextElement;'],
                    [
                      75635,
                      '    this.updateComponent(transaction, prevElement, nextElement, context);'
                    ],
                    [75636, '  },'],
                    [75637, ''],
                    [75638, '  /**'],
                    [
                      75639,
                      '   * Updates a DOM component after it has already been allocated and'
                    ],
                    [
                      75640,
                      '   * attached to the DOM. Reconciles the root DOM node, then recurses.'
                    ]
                  ],
                  symbolAddr: null
                },
                {
                  function: 'ReactDOMComponent.updateComponent',
                  colNo: 10,
                  vars: {},
                  symbol: null,
                  module: null,
                  lineNo: 75677,
                  errors: null,
                  package: null,
                  absPath: 'http://localhost:8000/_static/1500500019/sentry/dist/vendor.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '/_static/1500500019/sentry/dist/vendor.js',
                  platform: null,
                  context: [
                    [75672, '        break;'],
                    [75673, '    }'],
                    [75674, ''],
                    [75675, '    assertValidProps(this, nextProps);'],
                    [
                      75676,
                      '    this._updateDOMProperties(lastProps, nextProps, transaction);'
                    ],
                    [
                      75677,
                      '    this._updateDOMChildren(lastProps, nextProps, transaction, context);'
                    ],
                    [75678, ''],
                    [75679, '    switch (this._tag) {'],
                    [75680, "      case 'input':"],
                    [
                      75681,
                      '        // Update the wrapper around inputs *after* updating props. This has to'
                    ],
                    [
                      75682,
                      '        // happen after `_updateDOMProperties`. Otherwise HTML5 input validations'
                    ]
                  ],
                  symbolAddr: null
                },
                {
                  function: 'ReactDOMComponent._updateDOMChildren',
                  colNo: 12,
                  vars: {},
                  symbol: null,
                  module: null,
                  lineNo: 75859,
                  errors: null,
                  package: null,
                  absPath: 'http://localhost:8000/_static/1500500019/sentry/dist/vendor.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '/_static/1500500019/sentry/dist/vendor.js',
                  platform: null,
                  context: [
                    [75854, '    } else if (nextChildren != null) {'],
                    [75855, "      if (undefined !== 'production') {"],
                    [75856, '        setAndValidateContentChildDev.call(this, null);'],
                    [75857, '      }'],
                    [75858, ''],
                    [
                      75859,
                      '      this.updateChildren(nextChildren, transaction, context);'
                    ],
                    [75860, '    }'],
                    [75861, '  },'],
                    [75862, ''],
                    [75863, '  getHostNode: function () {'],
                    [75864, '    return getNode(this);']
                  ],
                  symbolAddr: null
                },
                {
                  function: 'ReactDOMComponent.updateChildren',
                  colNo: 12,
                  vars: {},
                  symbol: null,
                  module: null,
                  lineNo: 78566,
                  errors: null,
                  package: null,
                  absPath: 'http://localhost:8000/_static/1500500019/sentry/dist/vendor.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '/_static/1500500019/sentry/dist/vendor.js',
                  platform: null,
                  context: [
                    [78561, '     * @param {ReactReconcileTransaction} transaction'],
                    [78562, '     * @internal'],
                    [78563, '     */'],
                    [
                      78564,
                      '    updateChildren: function (nextNestedChildrenElements, transaction, context) {'
                    ],
                    [78565, '      // Hook used by React ART'],
                    [
                      78566,
                      '      this._updateChildren(nextNestedChildrenElements, transaction, context);'
                    ],
                    [78567, '    },'],
                    [78568, ''],
                    [78569, '    /**'],
                    [
                      78570,
                      '     * @param {?object} nextNestedChildrenElements Nested child element maps.'
                    ],
                    [78571, '     * @param {ReactReconcileTransaction} transaction']
                  ],
                  symbolAddr: null
                },
                {
                  function: 'ReactDOMComponent._updateChildren',
                  colNo: 31,
                  vars: {},
                  symbol: null,
                  module: null,
                  lineNo: 78579,
                  errors: null,
                  package: null,
                  absPath: 'http://localhost:8000/_static/1500500019/sentry/dist/vendor.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '/_static/1500500019/sentry/dist/vendor.js',
                  platform: null,
                  context: [
                    [78574, '     */'],
                    [
                      78575,
                      '    _updateChildren: function (nextNestedChildrenElements, transaction, context) {'
                    ],
                    [78576, '      var prevChildren = this._renderedChildren;'],
                    [78577, '      var removedNodes = {};'],
                    [78578, '      var mountImages = [];'],
                    [
                      78579,
                      '      var nextChildren = this._reconcilerUpdateChildren(prevChildren, nextNestedChildrenElements, mountImages, removedNodes, transaction, context);'
                    ],
                    [78580, '      if (!nextChildren && !prevChildren) {'],
                    [78581, '        return;'],
                    [78582, '      }'],
                    [78583, '      var updates = null;'],
                    [78584, '      var name;']
                  ],
                  symbolAddr: null
                },
                {
                  function: 'ReactDOMComponent._reconcilerUpdateChildren',
                  colNo: 32,
                  vars: {},
                  symbol: null,
                  module: null,
                  lineNo: 78475,
                  errors: null,
                  package: null,
                  absPath: 'http://localhost:8000/_static/1500500019/sentry/dist/vendor.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '/_static/1500500019/sentry/dist/vendor.js',
                  platform: null,
                  context: [
                    [
                      78470,
                      '            ReactCurrentOwner.current = this._currentElement._owner;'
                    ],
                    [
                      78471,
                      '            nextChildren = flattenChildren(nextNestedChildrenElements, selfDebugID);'
                    ],
                    [78472, '          } finally {'],
                    [78473, '            ReactCurrentOwner.current = null;'],
                    [78474, '          }'],
                    [
                      78475,
                      '          ReactChildReconciler.updateChildren(prevChildren, nextChildren, mountImages, removedNodes, transaction, this, this._hostContainerI {snip}'
                    ],
                    [78476, '          return nextChildren;'],
                    [78477, '        }'],
                    [78478, '      }'],
                    [
                      78479,
                      '      nextChildren = flattenChildren(nextNestedChildrenElements, selfDebugID);'
                    ],
                    [
                      78480,
                      '      ReactChildReconciler.updateChildren(prevChildren, nextChildren, mountImages, removedNodes, transaction, this, this._hostContainerInfo, {snip}'
                    ]
                  ],
                  symbolAddr: null
                },
                {
                  function: 'Object.updateChildren',
                  colNo: 25,
                  vars: {},
                  symbol: null,
                  module: null,
                  lineNo: 73804,
                  errors: null,
                  package: null,
                  absPath: 'http://localhost:8000/_static/1500500019/sentry/dist/vendor.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '/_static/1500500019/sentry/dist/vendor.js',
                  platform: null,
                  context: [
                    [73799, '      }'],
                    [73800, '      prevChild = prevChildren && prevChildren[name];'],
                    [
                      73801,
                      '      var prevElement = prevChild && prevChild._currentElement;'
                    ],
                    [73802, '      var nextElement = nextChildren[name];'],
                    [
                      73803,
                      '      if (prevChild != null && shouldUpdateReactComponent(prevElement, nextElement)) {'
                    ],
                    [
                      73804,
                      '        ReactReconciler.receiveComponent(prevChild, nextElement, transaction, context);'
                    ],
                    [73805, '        nextChildren[name] = prevChild;'],
                    [73806, '      } else {'],
                    [73807, '        if (prevChild) {'],
                    [
                      73808,
                      '          removedNodes[name] = ReactReconciler.getHostNode(prevChild);'
                    ],
                    [
                      73809,
                      '          ReactReconciler.unmountComponent(prevChild, false);'
                    ]
                  ],
                  symbolAddr: null
                },
                {
                  function: 'Object.receiveComponent',
                  colNo: 22,
                  vars: {},
                  symbol: null,
                  module: null,
                  lineNo: 19382,
                  errors: null,
                  package: null,
                  absPath: 'http://localhost:8000/_static/1500500019/sentry/dist/vendor.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '/_static/1500500019/sentry/dist/vendor.js',
                  platform: null,
                  context: [
                    [19377, ''],
                    [19378, '    if (refsChanged) {'],
                    [19379, '      ReactRef.detachRefs(internalInstance, prevElement);'],
                    [19380, '    }'],
                    [19381, ''],
                    [
                      19382,
                      '    internalInstance.receiveComponent(nextElement, transaction, context);'
                    ],
                    [19383, ''],
                    [
                      19384,
                      '    if (refsChanged && internalInstance._currentElement && internalInstance._currentElement.ref != null) {'
                    ],
                    [
                      19385,
                      '      transaction.getReactMountReady().enqueue(attachRefs, internalInstance);'
                    ],
                    [19386, '    }'],
                    [19387, '']
                  ],
                  symbolAddr: null
                },
                {
                  function: 'ReactDOMComponent.receiveComponent',
                  colNo: 10,
                  vars: {},
                  symbol: null,
                  module: null,
                  lineNo: 75635,
                  errors: null,
                  package: null,
                  absPath: 'http://localhost:8000/_static/1500500019/sentry/dist/vendor.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '/_static/1500500019/sentry/dist/vendor.js',
                  platform: null,
                  context: [
                    [75630, '   * @param {object} context'],
                    [75631, '   */'],
                    [
                      75632,
                      '  receiveComponent: function (nextElement, transaction, context) {'
                    ],
                    [75633, '    var prevElement = this._currentElement;'],
                    [75634, '    this._currentElement = nextElement;'],
                    [
                      75635,
                      '    this.updateComponent(transaction, prevElement, nextElement, context);'
                    ],
                    [75636, '  },'],
                    [75637, ''],
                    [75638, '  /**'],
                    [
                      75639,
                      '   * Updates a DOM component after it has already been allocated and'
                    ],
                    [
                      75640,
                      '   * attached to the DOM. Reconciles the root DOM node, then recurses.'
                    ]
                  ],
                  symbolAddr: null
                },
                {
                  function: 'ReactDOMComponent.updateComponent',
                  colNo: 10,
                  vars: {},
                  symbol: null,
                  module: null,
                  lineNo: 75677,
                  errors: null,
                  package: null,
                  absPath: 'http://localhost:8000/_static/1500500019/sentry/dist/vendor.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '/_static/1500500019/sentry/dist/vendor.js',
                  platform: null,
                  context: [
                    [75672, '        break;'],
                    [75673, '    }'],
                    [75674, ''],
                    [75675, '    assertValidProps(this, nextProps);'],
                    [
                      75676,
                      '    this._updateDOMProperties(lastProps, nextProps, transaction);'
                    ],
                    [
                      75677,
                      '    this._updateDOMChildren(lastProps, nextProps, transaction, context);'
                    ],
                    [75678, ''],
                    [75679, '    switch (this._tag) {'],
                    [75680, "      case 'input':"],
                    [
                      75681,
                      '        // Update the wrapper around inputs *after* updating props. This has to'
                    ],
                    [
                      75682,
                      '        // happen after `_updateDOMProperties`. Otherwise HTML5 input validations'
                    ]
                  ],
                  symbolAddr: null
                },
                {
                  function: 'ReactDOMComponent._updateDOMChildren',
                  colNo: 12,
                  vars: {},
                  symbol: null,
                  module: null,
                  lineNo: 75859,
                  errors: null,
                  package: null,
                  absPath: 'http://localhost:8000/_static/1500500019/sentry/dist/vendor.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '/_static/1500500019/sentry/dist/vendor.js',
                  platform: null,
                  context: [
                    [75854, '    } else if (nextChildren != null) {'],
                    [75855, "      if (undefined !== 'production') {"],
                    [75856, '        setAndValidateContentChildDev.call(this, null);'],
                    [75857, '      }'],
                    [75858, ''],
                    [
                      75859,
                      '      this.updateChildren(nextChildren, transaction, context);'
                    ],
                    [75860, '    }'],
                    [75861, '  },'],
                    [75862, ''],
                    [75863, '  getHostNode: function () {'],
                    [75864, '    return getNode(this);']
                  ],
                  symbolAddr: null
                },
                {
                  function: 'ReactDOMComponent.updateChildren',
                  colNo: 12,
                  vars: {},
                  symbol: null,
                  module: null,
                  lineNo: 78566,
                  errors: null,
                  package: null,
                  absPath: 'http://localhost:8000/_static/1500500019/sentry/dist/vendor.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '/_static/1500500019/sentry/dist/vendor.js',
                  platform: null,
                  context: [
                    [78561, '     * @param {ReactReconcileTransaction} transaction'],
                    [78562, '     * @internal'],
                    [78563, '     */'],
                    [
                      78564,
                      '    updateChildren: function (nextNestedChildrenElements, transaction, context) {'
                    ],
                    [78565, '      // Hook used by React ART'],
                    [
                      78566,
                      '      this._updateChildren(nextNestedChildrenElements, transaction, context);'
                    ],
                    [78567, '    },'],
                    [78568, ''],
                    [78569, '    /**'],
                    [
                      78570,
                      '     * @param {?object} nextNestedChildrenElements Nested child element maps.'
                    ],
                    [78571, '     * @param {ReactReconcileTransaction} transaction']
                  ],
                  symbolAddr: null
                },
                {
                  function: 'ReactDOMComponent._updateChildren',
                  colNo: 31,
                  vars: {},
                  symbol: null,
                  module: null,
                  lineNo: 78579,
                  errors: null,
                  package: null,
                  absPath: 'http://localhost:8000/_static/1500500019/sentry/dist/vendor.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '/_static/1500500019/sentry/dist/vendor.js',
                  platform: null,
                  context: [
                    [78574, '     */'],
                    [
                      78575,
                      '    _updateChildren: function (nextNestedChildrenElements, transaction, context) {'
                    ],
                    [78576, '      var prevChildren = this._renderedChildren;'],
                    [78577, '      var removedNodes = {};'],
                    [78578, '      var mountImages = [];'],
                    [
                      78579,
                      '      var nextChildren = this._reconcilerUpdateChildren(prevChildren, nextNestedChildrenElements, mountImages, removedNodes, transaction, context);'
                    ],
                    [78580, '      if (!nextChildren && !prevChildren) {'],
                    [78581, '        return;'],
                    [78582, '      }'],
                    [78583, '      var updates = null;'],
                    [78584, '      var name;']
                  ],
                  symbolAddr: null
                },
                {
                  function: 'ReactDOMComponent._reconcilerUpdateChildren',
                  colNo: 32,
                  vars: {},
                  symbol: null,
                  module: null,
                  lineNo: 78475,
                  errors: null,
                  package: null,
                  absPath: 'http://localhost:8000/_static/1500500019/sentry/dist/vendor.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '/_static/1500500019/sentry/dist/vendor.js',
                  platform: null,
                  context: [
                    [
                      78470,
                      '            ReactCurrentOwner.current = this._currentElement._owner;'
                    ],
                    [
                      78471,
                      '            nextChildren = flattenChildren(nextNestedChildrenElements, selfDebugID);'
                    ],
                    [78472, '          } finally {'],
                    [78473, '            ReactCurrentOwner.current = null;'],
                    [78474, '          }'],
                    [
                      78475,
                      '          ReactChildReconciler.updateChildren(prevChildren, nextChildren, mountImages, removedNodes, transaction, this, this._hostContainerI {snip}'
                    ],
                    [78476, '          return nextChildren;'],
                    [78477, '        }'],
                    [78478, '      }'],
                    [
                      78479,
                      '      nextChildren = flattenChildren(nextNestedChildrenElements, selfDebugID);'
                    ],
                    [
                      78480,
                      '      ReactChildReconciler.updateChildren(prevChildren, nextChildren, mountImages, removedNodes, transaction, this, this._hostContainerInfo, {snip}'
                    ]
                  ],
                  symbolAddr: null
                },
                {
                  function: 'Object.updateChildren',
                  colNo: 25,
                  vars: {},
                  symbol: null,
                  module: null,
                  lineNo: 73804,
                  errors: null,
                  package: null,
                  absPath: 'http://localhost:8000/_static/1500500019/sentry/dist/vendor.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '/_static/1500500019/sentry/dist/vendor.js',
                  platform: null,
                  context: [
                    [73799, '      }'],
                    [73800, '      prevChild = prevChildren && prevChildren[name];'],
                    [
                      73801,
                      '      var prevElement = prevChild && prevChild._currentElement;'
                    ],
                    [73802, '      var nextElement = nextChildren[name];'],
                    [
                      73803,
                      '      if (prevChild != null && shouldUpdateReactComponent(prevElement, nextElement)) {'
                    ],
                    [
                      73804,
                      '        ReactReconciler.receiveComponent(prevChild, nextElement, transaction, context);'
                    ],
                    [73805, '        nextChildren[name] = prevChild;'],
                    [73806, '      } else {'],
                    [73807, '        if (prevChild) {'],
                    [
                      73808,
                      '          removedNodes[name] = ReactReconciler.getHostNode(prevChild);'
                    ],
                    [
                      73809,
                      '          ReactReconciler.unmountComponent(prevChild, false);'
                    ]
                  ],
                  symbolAddr: null
                },
                {
                  function: 'Object.receiveComponent',
                  colNo: 22,
                  vars: {},
                  symbol: null,
                  module: null,
                  lineNo: 19382,
                  errors: null,
                  package: null,
                  absPath: 'http://localhost:8000/_static/1500500019/sentry/dist/vendor.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '/_static/1500500019/sentry/dist/vendor.js',
                  platform: null,
                  context: [
                    [19377, ''],
                    [19378, '    if (refsChanged) {'],
                    [19379, '      ReactRef.detachRefs(internalInstance, prevElement);'],
                    [19380, '    }'],
                    [19381, ''],
                    [
                      19382,
                      '    internalInstance.receiveComponent(nextElement, transaction, context);'
                    ],
                    [19383, ''],
                    [
                      19384,
                      '    if (refsChanged && internalInstance._currentElement && internalInstance._currentElement.ref != null) {'
                    ],
                    [
                      19385,
                      '      transaction.getReactMountReady().enqueue(attachRefs, internalInstance);'
                    ],
                    [19386, '    }'],
                    [19387, '']
                  ],
                  symbolAddr: null
                },
                {
                  function: 'ReactDOMComponent.receiveComponent',
                  colNo: 10,
                  vars: {},
                  symbol: null,
                  module: null,
                  lineNo: 75635,
                  errors: null,
                  package: null,
                  absPath: 'http://localhost:8000/_static/1500500019/sentry/dist/vendor.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '/_static/1500500019/sentry/dist/vendor.js',
                  platform: null,
                  context: [
                    [75630, '   * @param {object} context'],
                    [75631, '   */'],
                    [
                      75632,
                      '  receiveComponent: function (nextElement, transaction, context) {'
                    ],
                    [75633, '    var prevElement = this._currentElement;'],
                    [75634, '    this._currentElement = nextElement;'],
                    [
                      75635,
                      '    this.updateComponent(transaction, prevElement, nextElement, context);'
                    ],
                    [75636, '  },'],
                    [75637, ''],
                    [75638, '  /**'],
                    [
                      75639,
                      '   * Updates a DOM component after it has already been allocated and'
                    ],
                    [
                      75640,
                      '   * attached to the DOM. Reconciles the root DOM node, then recurses.'
                    ]
                  ],
                  symbolAddr: null
                },
                {
                  function: 'ReactDOMComponent.updateComponent',
                  colNo: 10,
                  vars: {},
                  symbol: null,
                  module: null,
                  lineNo: 75677,
                  errors: null,
                  package: null,
                  absPath: 'http://localhost:8000/_static/1500500019/sentry/dist/vendor.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '/_static/1500500019/sentry/dist/vendor.js',
                  platform: null,
                  context: [
                    [75672, '        break;'],
                    [75673, '    }'],
                    [75674, ''],
                    [75675, '    assertValidProps(this, nextProps);'],
                    [
                      75676,
                      '    this._updateDOMProperties(lastProps, nextProps, transaction);'
                    ],
                    [
                      75677,
                      '    this._updateDOMChildren(lastProps, nextProps, transaction, context);'
                    ],
                    [75678, ''],
                    [75679, '    switch (this._tag) {'],
                    [75680, "      case 'input':"],
                    [
                      75681,
                      '        // Update the wrapper around inputs *after* updating props. This has to'
                    ],
                    [
                      75682,
                      '        // happen after `_updateDOMProperties`. Otherwise HTML5 input validations'
                    ]
                  ],
                  symbolAddr: null
                },
                {
                  function: 'ReactDOMComponent._updateDOMChildren',
                  colNo: 12,
                  vars: {},
                  symbol: null,
                  module: null,
                  lineNo: 75859,
                  errors: null,
                  package: null,
                  absPath: 'http://localhost:8000/_static/1500500019/sentry/dist/vendor.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '/_static/1500500019/sentry/dist/vendor.js',
                  platform: null,
                  context: [
                    [75854, '    } else if (nextChildren != null) {'],
                    [75855, "      if (undefined !== 'production') {"],
                    [75856, '        setAndValidateContentChildDev.call(this, null);'],
                    [75857, '      }'],
                    [75858, ''],
                    [
                      75859,
                      '      this.updateChildren(nextChildren, transaction, context);'
                    ],
                    [75860, '    }'],
                    [75861, '  },'],
                    [75862, ''],
                    [75863, '  getHostNode: function () {'],
                    [75864, '    return getNode(this);']
                  ],
                  symbolAddr: null
                },
                {
                  function: 'ReactDOMComponent.updateChildren',
                  colNo: 12,
                  vars: {},
                  symbol: null,
                  module: null,
                  lineNo: 78566,
                  errors: null,
                  package: null,
                  absPath: 'http://localhost:8000/_static/1500500019/sentry/dist/vendor.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '/_static/1500500019/sentry/dist/vendor.js',
                  platform: null,
                  context: [
                    [78561, '     * @param {ReactReconcileTransaction} transaction'],
                    [78562, '     * @internal'],
                    [78563, '     */'],
                    [
                      78564,
                      '    updateChildren: function (nextNestedChildrenElements, transaction, context) {'
                    ],
                    [78565, '      // Hook used by React ART'],
                    [
                      78566,
                      '      this._updateChildren(nextNestedChildrenElements, transaction, context);'
                    ],
                    [78567, '    },'],
                    [78568, ''],
                    [78569, '    /**'],
                    [
                      78570,
                      '     * @param {?object} nextNestedChildrenElements Nested child element maps.'
                    ],
                    [78571, '     * @param {ReactReconcileTransaction} transaction']
                  ],
                  symbolAddr: null
                },
                {
                  function: 'ReactDOMComponent._updateChildren',
                  colNo: 31,
                  vars: {},
                  symbol: null,
                  module: null,
                  lineNo: 78579,
                  errors: null,
                  package: null,
                  absPath: 'http://localhost:8000/_static/1500500019/sentry/dist/vendor.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '/_static/1500500019/sentry/dist/vendor.js',
                  platform: null,
                  context: [
                    [78574, '     */'],
                    [
                      78575,
                      '    _updateChildren: function (nextNestedChildrenElements, transaction, context) {'
                    ],
                    [78576, '      var prevChildren = this._renderedChildren;'],
                    [78577, '      var removedNodes = {};'],
                    [78578, '      var mountImages = [];'],
                    [
                      78579,
                      '      var nextChildren = this._reconcilerUpdateChildren(prevChildren, nextNestedChildrenElements, mountImages, removedNodes, transaction, context);'
                    ],
                    [78580, '      if (!nextChildren && !prevChildren) {'],
                    [78581, '        return;'],
                    [78582, '      }'],
                    [78583, '      var updates = null;'],
                    [78584, '      var name;']
                  ],
                  symbolAddr: null
                },
                {
                  function: 'ReactDOMComponent._reconcilerUpdateChildren',
                  colNo: 32,
                  vars: {},
                  symbol: null,
                  module: null,
                  lineNo: 78475,
                  errors: null,
                  package: null,
                  absPath: 'http://localhost:8000/_static/1500500019/sentry/dist/vendor.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '/_static/1500500019/sentry/dist/vendor.js',
                  platform: null,
                  context: [
                    [
                      78470,
                      '            ReactCurrentOwner.current = this._currentElement._owner;'
                    ],
                    [
                      78471,
                      '            nextChildren = flattenChildren(nextNestedChildrenElements, selfDebugID);'
                    ],
                    [78472, '          } finally {'],
                    [78473, '            ReactCurrentOwner.current = null;'],
                    [78474, '          }'],
                    [
                      78475,
                      '          ReactChildReconciler.updateChildren(prevChildren, nextChildren, mountImages, removedNodes, transaction, this, this._hostContainerI {snip}'
                    ],
                    [78476, '          return nextChildren;'],
                    [78477, '        }'],
                    [78478, '      }'],
                    [
                      78479,
                      '      nextChildren = flattenChildren(nextNestedChildrenElements, selfDebugID);'
                    ],
                    [
                      78480,
                      '      ReactChildReconciler.updateChildren(prevChildren, nextChildren, mountImages, removedNodes, transaction, this, this._hostContainerInfo, {snip}'
                    ]
                  ],
                  symbolAddr: null
                },
                {
                  function: 'Object.updateChildren',
                  colNo: 51,
                  vars: {},
                  symbol: null,
                  module: null,
                  lineNo: 73816,
                  errors: null,
                  package: null,
                  absPath: 'http://localhost:8000/_static/1500500019/sentry/dist/vendor.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '/_static/1500500019/sentry/dist/vendor.js',
                  platform: null,
                  context: [
                    [
                      73811,
                      "        // The child must be instantiated before it's mounted."
                    ],
                    [
                      73812,
                      '        var nextChildInstance = instantiateReactComponent(nextElement, true);'
                    ],
                    [73813, '        nextChildren[name] = nextChildInstance;'],
                    [
                      73814,
                      '        // Creating mount image now ensures refs are resolved in right order'
                    ],
                    [
                      73815,
                      '        // (see https://github.com/facebook/react/pull/7101 for explanation).'
                    ],
                    [
                      73816,
                      '        var nextChildMountImage = ReactReconciler.mountComponent(nextChildInstance, transaction, hostParent, hostContainerInfo, context, selfDebugID);'
                    ],
                    [73817, '        mountImages.push(nextChildMountImage);'],
                    [73818, '      }'],
                    [73819, '    }'],
                    [73820, '    // Unmount children that are no longer present.'],
                    [73821, '    for (name in prevChildren) {']
                  ],
                  symbolAddr: null
                },
                {
                  function: 'Object.mountComponent',
                  colNo: 35,
                  vars: {},
                  symbol: null,
                  module: null,
                  lineNo: 19303,
                  errors: null,
                  package: null,
                  absPath: 'http://localhost:8000/_static/1500500019/sentry/dist/vendor.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '/_static/1500500019/sentry/dist/vendor.js',
                  platform: null,
                  context: [
                    [19298, "    if (undefined !== 'production') {"],
                    [19299, '      if (internalInstance._debugID !== 0) {'],
                    [
                      19300,
                      '        ReactInstrumentation.debugTool.onBeforeMountComponent(internalInstance._debugID, internalInstance._currentElement, parentDebugID);'
                    ],
                    [19301, '      }'],
                    [19302, '    }'],
                    [
                      19303,
                      '    var markup = internalInstance.mountComponent(transaction, hostParent, hostContainerInfo, context, parentDebugID);'
                    ],
                    [
                      19304,
                      '    if (internalInstance._currentElement && internalInstance._currentElement.ref != null) {'
                    ],
                    [
                      19305,
                      '      transaction.getReactMountReady().enqueue(attachRefs, internalInstance);'
                    ],
                    [19306, '    }'],
                    [19307, "    if (undefined !== 'production') {"],
                    [19308, '      if (internalInstance._debugID !== 0) {']
                  ],
                  symbolAddr: null
                },
                {
                  function: 'ReactDOMComponent.mountComponent',
                  colNo: 12,
                  vars: {},
                  symbol: null,
                  module: null,
                  lineNo: 75441,
                  errors: null,
                  package: null,
                  absPath: 'http://localhost:8000/_static/1500500019/sentry/dist/vendor.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '/_static/1500500019/sentry/dist/vendor.js',
                  platform: null,
                  context: [
                    [75436, '      if (!this._hostParent) {'],
                    [75437, '        DOMPropertyOperations.setAttributeForRoot(el);'],
                    [75438, '      }'],
                    [75439, '      this._updateDOMProperties(null, props, transaction);'],
                    [75440, '      var lazyTree = DOMLazyTree(el);'],
                    [
                      75441,
                      '      this._createInitialChildren(transaction, props, context, lazyTree);'
                    ],
                    [75442, '      mountImage = lazyTree;'],
                    [75443, '    } else {'],
                    [
                      75444,
                      '      var tagOpen = this._createOpenTagMarkupAndPutListeners(transaction, props);'
                    ],
                    [
                      75445,
                      '      var tagContent = this._createContentMarkup(transaction, props, context);'
                    ],
                    [75446, '      if (!tagContent && omittedCloseTags[this._tag]) {']
                  ],
                  symbolAddr: null
                },
                {
                  function: 'ReactDOMComponent._createInitialChildren',
                  colNo: 32,
                  vars: {},
                  symbol: null,
                  module: null,
                  lineNo: 75616,
                  errors: null,
                  package: null,
                  absPath: 'http://localhost:8000/_static/1500500019/sentry/dist/vendor.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '/_static/1500500019/sentry/dist/vendor.js',
                  platform: null,
                  context: [
                    [75611, "        if (undefined !== 'production') {"],
                    [
                      75612,
                      '          setAndValidateContentChildDev.call(this, contentToUse);'
                    ],
                    [75613, '        }'],
                    [75614, '        DOMLazyTree.queueText(lazyTree, contentToUse);'],
                    [75615, '      } else if (childrenToUse != null) {'],
                    [
                      75616,
                      '        var mountImages = this.mountChildren(childrenToUse, transaction, context);'
                    ],
                    [75617, '        for (var i = 0; i < mountImages.length; i++) {'],
                    [
                      75618,
                      '          DOMLazyTree.queueChild(lazyTree, mountImages[i]);'
                    ],
                    [75619, '        }'],
                    [75620, '      }'],
                    [75621, '    }']
                  ],
                  symbolAddr: null
                },
                {
                  function: 'ReactDOMComponent.mountChildren',
                  colNo: 44,
                  vars: {},
                  symbol: null,
                  module: null,
                  lineNo: 78505,
                  errors: null,
                  package: null,
                  absPath: 'http://localhost:8000/_static/1500500019/sentry/dist/vendor.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '/_static/1500500019/sentry/dist/vendor.js',
                  platform: null,
                  context: [
                    [78500, '          var child = children[name];'],
                    [78501, '          var selfDebugID = 0;'],
                    [78502, "          if (undefined !== 'production') {"],
                    [78503, '            selfDebugID = getDebugID(this);'],
                    [78504, '          }'],
                    [
                      78505,
                      '          var mountImage = ReactReconciler.mountComponent(child, transaction, this, this._hostContainerInfo, context, selfDebugID);'
                    ],
                    [78506, '          child._mountIndex = index++;'],
                    [78507, '          mountImages.push(mountImage);'],
                    [78508, '        }'],
                    [78509, '      }'],
                    [78510, '']
                  ],
                  symbolAddr: null
                },
                {
                  function: 'Object.mountComponent',
                  colNo: 35,
                  vars: {},
                  symbol: null,
                  module: null,
                  lineNo: 19303,
                  errors: null,
                  package: null,
                  absPath: 'http://localhost:8000/_static/1500500019/sentry/dist/vendor.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '/_static/1500500019/sentry/dist/vendor.js',
                  platform: null,
                  context: [
                    [19298, "    if (undefined !== 'production') {"],
                    [19299, '      if (internalInstance._debugID !== 0) {'],
                    [
                      19300,
                      '        ReactInstrumentation.debugTool.onBeforeMountComponent(internalInstance._debugID, internalInstance._currentElement, parentDebugID);'
                    ],
                    [19301, '      }'],
                    [19302, '    }'],
                    [
                      19303,
                      '    var markup = internalInstance.mountComponent(transaction, hostParent, hostContainerInfo, context, parentDebugID);'
                    ],
                    [
                      19304,
                      '    if (internalInstance._currentElement && internalInstance._currentElement.ref != null) {'
                    ],
                    [
                      19305,
                      '      transaction.getReactMountReady().enqueue(attachRefs, internalInstance);'
                    ],
                    [19306, '    }'],
                    [19307, "    if (undefined !== 'production') {"],
                    [19308, '      if (internalInstance._debugID !== 0) {']
                  ],
                  symbolAddr: null
                },
                {
                  function: 'ReactCompositeComponentWrapper.mountComponent',
                  colNo: 21,
                  vars: {},
                  symbol: null,
                  module: null,
                  lineNo: 74224,
                  errors: null,
                  package: null,
                  absPath: 'http://localhost:8000/_static/1500500019/sentry/dist/vendor.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '/_static/1500500019/sentry/dist/vendor.js',
                  platform: null,
                  context: [
                    [74219, ''],
                    [74220, '    var markup;'],
                    [74221, '    if (inst.unstable_handleError) {'],
                    [
                      74222,
                      '      markup = this.performInitialMountWithErrorHandling(renderedElement, hostParent, hostContainerInfo, transaction, context);'
                    ],
                    [74223, '    } else {'],
                    [
                      74224,
                      '      markup = this.performInitialMount(renderedElement, hostParent, hostContainerInfo, transaction, context);'
                    ],
                    [74225, '    }'],
                    [74226, ''],
                    [74227, '    if (inst.componentDidMount) {'],
                    [74228, "      if (undefined !== 'production') {"],
                    [
                      74229,
                      '        transaction.getReactMountReady().enqueue(function () {'
                    ]
                  ],
                  symbolAddr: null
                },
                {
                  function: 'ReactCompositeComponentWrapper.performInitialMount',
                  colNo: 34,
                  vars: {},
                  symbol: null,
                  module: null,
                  lineNo: 74337,
                  errors: null,
                  package: null,
                  absPath: 'http://localhost:8000/_static/1500500019/sentry/dist/vendor.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '/_static/1500500019/sentry/dist/vendor.js',
                  platform: null,
                  context: [
                    [74332, '    this._renderedNodeType = nodeType;'],
                    [
                      74333,
                      '    var child = this._instantiateReactComponent(renderedElement, nodeType !== ReactNodeTypes.EMPTY /* shouldHaveDebugID */'
                    ],
                    [74334, '    );'],
                    [74335, '    this._renderedComponent = child;'],
                    [74336, ''],
                    [
                      74337,
                      '    var markup = ReactReconciler.mountComponent(child, transaction, hostParent, hostContainerInfo, this._processChildContext(context), debugID);'
                    ],
                    [74338, ''],
                    [74339, "    if (undefined !== 'production') {"],
                    [74340, '      if (debugID !== 0) {'],
                    [
                      74341,
                      '        var childDebugIDs = child._debugID !== 0 ? [child._debugID] : [];'
                    ],
                    [
                      74342,
                      '        ReactInstrumentation.debugTool.onSetChildren(debugID, childDebugIDs);'
                    ]
                  ],
                  symbolAddr: null
                },
                {
                  function: 'Object.mountComponent',
                  colNo: 35,
                  vars: {},
                  symbol: null,
                  module: null,
                  lineNo: 19303,
                  errors: null,
                  package: null,
                  absPath: 'http://localhost:8000/_static/1500500019/sentry/dist/vendor.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '/_static/1500500019/sentry/dist/vendor.js',
                  platform: null,
                  context: [
                    [19298, "    if (undefined !== 'production') {"],
                    [19299, '      if (internalInstance._debugID !== 0) {'],
                    [
                      19300,
                      '        ReactInstrumentation.debugTool.onBeforeMountComponent(internalInstance._debugID, internalInstance._currentElement, parentDebugID);'
                    ],
                    [19301, '      }'],
                    [19302, '    }'],
                    [
                      19303,
                      '    var markup = internalInstance.mountComponent(transaction, hostParent, hostContainerInfo, context, parentDebugID);'
                    ],
                    [
                      19304,
                      '    if (internalInstance._currentElement && internalInstance._currentElement.ref != null) {'
                    ],
                    [
                      19305,
                      '      transaction.getReactMountReady().enqueue(attachRefs, internalInstance);'
                    ],
                    [19306, '    }'],
                    [19307, "    if (undefined !== 'production') {"],
                    [19308, '      if (internalInstance._debugID !== 0) {']
                  ],
                  symbolAddr: null
                },
                {
                  function: 'ReactDOMComponent.mountComponent',
                  colNo: 12,
                  vars: {},
                  symbol: null,
                  module: null,
                  lineNo: 75441,
                  errors: null,
                  package: null,
                  absPath: 'http://localhost:8000/_static/1500500019/sentry/dist/vendor.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '/_static/1500500019/sentry/dist/vendor.js',
                  platform: null,
                  context: [
                    [75436, '      if (!this._hostParent) {'],
                    [75437, '        DOMPropertyOperations.setAttributeForRoot(el);'],
                    [75438, '      }'],
                    [75439, '      this._updateDOMProperties(null, props, transaction);'],
                    [75440, '      var lazyTree = DOMLazyTree(el);'],
                    [
                      75441,
                      '      this._createInitialChildren(transaction, props, context, lazyTree);'
                    ],
                    [75442, '      mountImage = lazyTree;'],
                    [75443, '    } else {'],
                    [
                      75444,
                      '      var tagOpen = this._createOpenTagMarkupAndPutListeners(transaction, props);'
                    ],
                    [
                      75445,
                      '      var tagContent = this._createContentMarkup(transaction, props, context);'
                    ],
                    [75446, '      if (!tagContent && omittedCloseTags[this._tag]) {']
                  ],
                  symbolAddr: null
                },
                {
                  function: 'ReactDOMComponent._createInitialChildren',
                  colNo: 32,
                  vars: {},
                  symbol: null,
                  module: null,
                  lineNo: 75616,
                  errors: null,
                  package: null,
                  absPath: 'http://localhost:8000/_static/1500500019/sentry/dist/vendor.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '/_static/1500500019/sentry/dist/vendor.js',
                  platform: null,
                  context: [
                    [75611, "        if (undefined !== 'production') {"],
                    [
                      75612,
                      '          setAndValidateContentChildDev.call(this, contentToUse);'
                    ],
                    [75613, '        }'],
                    [75614, '        DOMLazyTree.queueText(lazyTree, contentToUse);'],
                    [75615, '      } else if (childrenToUse != null) {'],
                    [
                      75616,
                      '        var mountImages = this.mountChildren(childrenToUse, transaction, context);'
                    ],
                    [75617, '        for (var i = 0; i < mountImages.length; i++) {'],
                    [
                      75618,
                      '          DOMLazyTree.queueChild(lazyTree, mountImages[i]);'
                    ],
                    [75619, '        }'],
                    [75620, '      }'],
                    [75621, '    }']
                  ],
                  symbolAddr: null
                },
                {
                  function: 'ReactDOMComponent.mountChildren',
                  colNo: 44,
                  vars: {},
                  symbol: null,
                  module: null,
                  lineNo: 78505,
                  errors: null,
                  package: null,
                  absPath: 'http://localhost:8000/_static/1500500019/sentry/dist/vendor.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '/_static/1500500019/sentry/dist/vendor.js',
                  platform: null,
                  context: [
                    [78500, '          var child = children[name];'],
                    [78501, '          var selfDebugID = 0;'],
                    [78502, "          if (undefined !== 'production') {"],
                    [78503, '            selfDebugID = getDebugID(this);'],
                    [78504, '          }'],
                    [
                      78505,
                      '          var mountImage = ReactReconciler.mountComponent(child, transaction, this, this._hostContainerInfo, context, selfDebugID);'
                    ],
                    [78506, '          child._mountIndex = index++;'],
                    [78507, '          mountImages.push(mountImage);'],
                    [78508, '        }'],
                    [78509, '      }'],
                    [78510, '']
                  ],
                  symbolAddr: null
                },
                {
                  function: 'Object.mountComponent',
                  colNo: 35,
                  vars: {},
                  symbol: null,
                  module: null,
                  lineNo: 19303,
                  errors: null,
                  package: null,
                  absPath: 'http://localhost:8000/_static/1500500019/sentry/dist/vendor.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '/_static/1500500019/sentry/dist/vendor.js',
                  platform: null,
                  context: [
                    [19298, "    if (undefined !== 'production') {"],
                    [19299, '      if (internalInstance._debugID !== 0) {'],
                    [
                      19300,
                      '        ReactInstrumentation.debugTool.onBeforeMountComponent(internalInstance._debugID, internalInstance._currentElement, parentDebugID);'
                    ],
                    [19301, '      }'],
                    [19302, '    }'],
                    [
                      19303,
                      '    var markup = internalInstance.mountComponent(transaction, hostParent, hostContainerInfo, context, parentDebugID);'
                    ],
                    [
                      19304,
                      '    if (internalInstance._currentElement && internalInstance._currentElement.ref != null) {'
                    ],
                    [
                      19305,
                      '      transaction.getReactMountReady().enqueue(attachRefs, internalInstance);'
                    ],
                    [19306, '    }'],
                    [19307, "    if (undefined !== 'production') {"],
                    [19308, '      if (internalInstance._debugID !== 0) {']
                  ],
                  symbolAddr: null
                },
                {
                  function: 'ReactDOMComponent.mountComponent',
                  colNo: 12,
                  vars: {},
                  symbol: null,
                  module: null,
                  lineNo: 75441,
                  errors: null,
                  package: null,
                  absPath: 'http://localhost:8000/_static/1500500019/sentry/dist/vendor.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '/_static/1500500019/sentry/dist/vendor.js',
                  platform: null,
                  context: [
                    [75436, '      if (!this._hostParent) {'],
                    [75437, '        DOMPropertyOperations.setAttributeForRoot(el);'],
                    [75438, '      }'],
                    [75439, '      this._updateDOMProperties(null, props, transaction);'],
                    [75440, '      var lazyTree = DOMLazyTree(el);'],
                    [
                      75441,
                      '      this._createInitialChildren(transaction, props, context, lazyTree);'
                    ],
                    [75442, '      mountImage = lazyTree;'],
                    [75443, '    } else {'],
                    [
                      75444,
                      '      var tagOpen = this._createOpenTagMarkupAndPutListeners(transaction, props);'
                    ],
                    [
                      75445,
                      '      var tagContent = this._createContentMarkup(transaction, props, context);'
                    ],
                    [75446, '      if (!tagContent && omittedCloseTags[this._tag]) {']
                  ],
                  symbolAddr: null
                },
                {
                  function: 'ReactDOMComponent._createInitialChildren',
                  colNo: 32,
                  vars: {},
                  symbol: null,
                  module: null,
                  lineNo: 75616,
                  errors: null,
                  package: null,
                  absPath: 'http://localhost:8000/_static/1500500019/sentry/dist/vendor.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '/_static/1500500019/sentry/dist/vendor.js',
                  platform: null,
                  context: [
                    [75611, "        if (undefined !== 'production') {"],
                    [
                      75612,
                      '          setAndValidateContentChildDev.call(this, contentToUse);'
                    ],
                    [75613, '        }'],
                    [75614, '        DOMLazyTree.queueText(lazyTree, contentToUse);'],
                    [75615, '      } else if (childrenToUse != null) {'],
                    [
                      75616,
                      '        var mountImages = this.mountChildren(childrenToUse, transaction, context);'
                    ],
                    [75617, '        for (var i = 0; i < mountImages.length; i++) {'],
                    [
                      75618,
                      '          DOMLazyTree.queueChild(lazyTree, mountImages[i]);'
                    ],
                    [75619, '        }'],
                    [75620, '      }'],
                    [75621, '    }']
                  ],
                  symbolAddr: null
                },
                {
                  function: 'ReactDOMComponent.mountChildren',
                  colNo: 44,
                  vars: {},
                  symbol: null,
                  module: null,
                  lineNo: 78505,
                  errors: null,
                  package: null,
                  absPath: 'http://localhost:8000/_static/1500500019/sentry/dist/vendor.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '/_static/1500500019/sentry/dist/vendor.js',
                  platform: null,
                  context: [
                    [78500, '          var child = children[name];'],
                    [78501, '          var selfDebugID = 0;'],
                    [78502, "          if (undefined !== 'production') {"],
                    [78503, '            selfDebugID = getDebugID(this);'],
                    [78504, '          }'],
                    [
                      78505,
                      '          var mountImage = ReactReconciler.mountComponent(child, transaction, this, this._hostContainerInfo, context, selfDebugID);'
                    ],
                    [78506, '          child._mountIndex = index++;'],
                    [78507, '          mountImages.push(mountImage);'],
                    [78508, '        }'],
                    [78509, '      }'],
                    [78510, '']
                  ],
                  symbolAddr: null
                },
                {
                  function: 'Object.mountComponent',
                  colNo: 35,
                  vars: {},
                  symbol: null,
                  module: null,
                  lineNo: 19303,
                  errors: null,
                  package: null,
                  absPath: 'http://localhost:8000/_static/1500500019/sentry/dist/vendor.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '/_static/1500500019/sentry/dist/vendor.js',
                  platform: null,
                  context: [
                    [19298, "    if (undefined !== 'production') {"],
                    [19299, '      if (internalInstance._debugID !== 0) {'],
                    [
                      19300,
                      '        ReactInstrumentation.debugTool.onBeforeMountComponent(internalInstance._debugID, internalInstance._currentElement, parentDebugID);'
                    ],
                    [19301, '      }'],
                    [19302, '    }'],
                    [
                      19303,
                      '    var markup = internalInstance.mountComponent(transaction, hostParent, hostContainerInfo, context, parentDebugID);'
                    ],
                    [
                      19304,
                      '    if (internalInstance._currentElement && internalInstance._currentElement.ref != null) {'
                    ],
                    [
                      19305,
                      '      transaction.getReactMountReady().enqueue(attachRefs, internalInstance);'
                    ],
                    [19306, '    }'],
                    [19307, "    if (undefined !== 'production') {"],
                    [19308, '      if (internalInstance._debugID !== 0) {']
                  ],
                  symbolAddr: null
                },
                {
                  function: 'ReactCompositeComponentWrapper.mountComponent',
                  colNo: 21,
                  vars: {},
                  symbol: null,
                  module: null,
                  lineNo: 74224,
                  errors: null,
                  package: null,
                  absPath: 'http://localhost:8000/_static/1500500019/sentry/dist/vendor.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '/_static/1500500019/sentry/dist/vendor.js',
                  platform: null,
                  context: [
                    [74219, ''],
                    [74220, '    var markup;'],
                    [74221, '    if (inst.unstable_handleError) {'],
                    [
                      74222,
                      '      markup = this.performInitialMountWithErrorHandling(renderedElement, hostParent, hostContainerInfo, transaction, context);'
                    ],
                    [74223, '    } else {'],
                    [
                      74224,
                      '      markup = this.performInitialMount(renderedElement, hostParent, hostContainerInfo, transaction, context);'
                    ],
                    [74225, '    }'],
                    [74226, ''],
                    [74227, '    if (inst.componentDidMount) {'],
                    [74228, "      if (undefined !== 'production') {"],
                    [
                      74229,
                      '        transaction.getReactMountReady().enqueue(function () {'
                    ]
                  ],
                  symbolAddr: null
                },
                {
                  function: 'ReactCompositeComponentWrapper.performInitialMount',
                  colNo: 30,
                  vars: {},
                  symbol: null,
                  module: null,
                  lineNo: 74328,
                  errors: null,
                  package: null,
                  absPath: 'http://localhost:8000/_static/1500500019/sentry/dist/vendor.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '/_static/1500500019/sentry/dist/vendor.js',
                  platform: null,
                  context: [
                    [74323, '      }'],
                    [74324, '    }'],
                    [74325, ''],
                    [74326, '    // If not a stateless component, we now render'],
                    [74327, '    if (renderedElement === undefined) {'],
                    [74328, '      renderedElement = this._renderValidatedComponent();'],
                    [74329, '    }'],
                    [74330, ''],
                    [
                      74331,
                      '    var nodeType = ReactNodeTypes.getType(renderedElement);'
                    ],
                    [74332, '    this._renderedNodeType = nodeType;'],
                    [
                      74333,
                      '    var child = this._instantiateReactComponent(renderedElement, nodeType !== ReactNodeTypes.EMPTY /* shouldHaveDebugID */'
                    ]
                  ],
                  symbolAddr: null
                },
                {
                  function: 'ReactCompositeComponentWrapper._renderValidatedComponent',
                  colNo: 34,
                  vars: {},
                  symbol: null,
                  module: null,
                  lineNo: 74786,
                  errors: null,
                  package: null,
                  absPath: 'http://localhost:8000/_static/1500500019/sentry/dist/vendor.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '/_static/1500500019/sentry/dist/vendor.js',
                  platform: null,
                  context: [
                    [74781, '  _renderValidatedComponent: function () {'],
                    [74782, '    var renderedComponent;'],
                    [
                      74783,
                      "    if (undefined !== 'production' || this._compositeType !== CompositeTypes.StatelessFunctional) {"
                    ],
                    [74784, '      ReactCurrentOwner.current = this;'],
                    [74785, '      try {'],
                    [
                      74786,
                      '        renderedComponent = this._renderValidatedComponentWithoutOwnerOrContext();'
                    ],
                    [74787, '      } finally {'],
                    [74788, '        ReactCurrentOwner.current = null;'],
                    [74789, '      }'],
                    [74790, '    } else {'],
                    [
                      74791,
                      '      renderedComponent = this._renderValidatedComponentWithoutOwnerOrContext();'
                    ]
                  ],
                  symbolAddr: null
                },
                {
                  function: 'ReactCompositeComponentWrapper._renderValidatedComponentWithoutOwnerOrContext',
                  colNo: 27,
                  vars: {},
                  symbol: null,
                  module: null,
                  lineNo: 74759,
                  errors: null,
                  package: null,
                  absPath: 'http://localhost:8000/_static/1500500019/sentry/dist/vendor.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '/_static/1500500019/sentry/dist/vendor.js',
                  platform: null,
                  context: [
                    [
                      74754,
                      '  _renderValidatedComponentWithoutOwnerOrContext: function () {'
                    ],
                    [74755, '    var inst = this._instance;'],
                    [74756, '    var renderedComponent;'],
                    [74757, ''],
                    [74758, "    if (undefined !== 'production') {"],
                    [
                      74759,
                      '      renderedComponent = measureLifeCyclePerf(function () {'
                    ],
                    [74760, '        return inst.render();'],
                    [74761, "      }, this._debugID, 'render');"],
                    [74762, '    } else {'],
                    [74763, '      renderedComponent = inst.render();'],
                    [74764, '    }']
                  ],
                  symbolAddr: null
                },
                {
                  function: 'measureLifeCyclePerf',
                  colNo: 12,
                  vars: {},
                  symbol: null,
                  module: null,
                  lineNo: 74041,
                  errors: null,
                  package: null,
                  absPath: 'http://localhost:8000/_static/1500500019/sentry/dist/vendor.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '/_static/1500500019/sentry/dist/vendor.js',
                  platform: null,
                  context: [
                    [74036, '    return fn();'],
                    [74037, '  }'],
                    [74038, ''],
                    [
                      74039,
                      '  ReactInstrumentation.debugTool.onBeginLifeCycleTimer(debugID, timerType);'
                    ],
                    [74040, '  try {'],
                    [74041, '    return fn();'],
                    [74042, '  } finally {'],
                    [
                      74043,
                      '    ReactInstrumentation.debugTool.onEndLifeCycleTimer(debugID, timerType);'
                    ],
                    [74044, '  }'],
                    [74045, '}'],
                    [74046, '']
                  ],
                  symbolAddr: null
                },
                {
                  function: null,
                  colNo: 21,
                  vars: {},
                  symbol: null,
                  module: null,
                  lineNo: 74760,
                  errors: null,
                  package: null,
                  absPath: 'http://localhost:8000/_static/1500500019/sentry/dist/vendor.js',
                  inApp: false,
                  instructionAddr: null,
                  filename: '/_static/1500500019/sentry/dist/vendor.js',
                  platform: null,
                  context: [
                    [74755, '    var inst = this._instance;'],
                    [74756, '    var renderedComponent;'],
                    [74757, ''],
                    [74758, "    if (undefined !== 'production') {"],
                    [
                      74759,
                      '      renderedComponent = measureLifeCyclePerf(function () {'
                    ],
                    [74760, '        return inst.render();'],
                    [74761, "      }, this._debugID, 'render');"],
                    [74762, '    } else {'],
                    [74763, '      renderedComponent = inst.render();'],
                    [74764, '    }'],
                    [74765, '']
                  ],
                  symbolAddr: null
                },
                {
                  function: 'StreamGroupHeader.render',
                  colNo: 20,
                  vars: {},
                  symbol: null,
                  module: null,
                  lineNo: 17661,
                  errors: null,
                  package: null,
                  absPath: 'http://localhost:8000/_static/1500500019/sentry/dist/app.js',
                  inApp: true,
                  instructionAddr: null,
                  filename: '/_static/1500500019/sentry/dist/app.js',
                  platform: null,
                  context: [
                    [17656, '      var _props = this.props,'],
                    [17657, '          hideLevel = _props.hideLevel,'],
                    [17658, '          orgId = _props.orgId,'],
                    [17659, '          projectId = _props.projectId,'],
                    [17660, '          data = _props.data;'],
                    [17661, '      var id = data.id,'],
                    [17662, '          level = data.level;'],
                    [17663, ''],
                    [17664, '      var message = this.getMessage();'],
                    [
                      17665,
                      '      return __WEBPACK_IMPORTED_MODULE_0_react___default.a.createElement('
                    ],
                    [17666, "        'div',"]
                  ],
                  symbolAddr: null
                }
              ],
              framesOmitted: null,
              registers: null,
              hasSystemFrames: true
            },
            mechanism: null,
            threadId: null,
            value: "Cannot read property 'id' of undefined",
            type: 'TypeError'
          }
        ],
        excOmitted: null,
        hasSystemFrames: true
      }
    },
    {
      type: 'breadcrumbs',
      data: {
        values: [
          {
            category: 'xhr',
            level: 'info',
            event_id: null,
            timestamp: '2017-07-20T19:00:54.061Z',
            data: {url: '/api/0/internal/health/', status_code: '200', method: 'GET'},
            message: null,
            type: 'http'
          },
          {
            category: 'xhr',
            level: 'info',
            event_id: null,
            timestamp: '2017-07-20T19:00:54.209Z',
            data: {
              url: '/api/0/organizations/?member=1',
              status_code: '200',
              method: 'GET'
            },
            message: null,
            type: 'http'
          },
          {
            category: 'xhr',
            level: 'info',
            event_id: null,
            timestamp: '2017-07-20T19:00:54.311Z',
            data: {
              url: '/api/0/organizations/sentry/',
              status_code: '200',
              method: 'GET'
            },
            message: null,
            type: 'http'
          },
          {
            category: 'xhr',
            level: 'info',
            event_id: null,
            timestamp: '2017-07-20T19:00:54.490Z',
            data: {
              url: '/api/0/organizations/?member=1',
              status_code: '200',
              method: 'GET'
            },
            message: null,
            type: 'http'
          },
          {
            category: 'xhr',
            level: 'info',
            event_id: null,
            timestamp: '2017-07-20T19:00:54.547Z',
            data: {url: '/api/0/broadcasts/', status_code: '200', method: 'GET'},
            message: null,
            type: 'http'
          },
          {
            category: 'xhr',
            level: 'info',
            event_id: null,
            timestamp: '2017-07-20T19:00:54.597Z',
            data: {
              url: '/api/0/projects/sentry/internal/members/',
              status_code: '200',
              method: 'GET'
            },
            message: null,
            type: 'http'
          },
          {
            category: 'xhr',
            level: 'info',
            event_id: null,
            timestamp: '2017-07-20T19:00:54.624Z',
            data: {
              url: '/api/0/projects/sentry/internal/',
              status_code: '200',
              method: 'GET'
            },
            message: null,
            type: 'http'
          },
          {
            category: 'xhr',
            level: 'info',
            event_id: null,
            timestamp: '2017-07-20T19:00:54.697Z',
            data: {
              url: '/api/0/projects/sentry/internal/environments/',
              status_code: '200',
              method: 'GET'
            },
            message: null,
            type: 'http'
          },
          {
            category: 'xhr',
            level: 'info',
            event_id: null,
            timestamp: '2017-07-20T19:00:54.746Z',
            data: {
              url: '/api/0/projects/sentry/internal/searches/',
              status_code: '200',
              method: 'GET'
            },
            message: null,
            type: 'http'
          },
          {
            category: 'xhr',
            level: 'info',
            event_id: null,
            timestamp: '2017-07-20T19:00:54.887Z',
            data: {
              url: '/api/0/projects/sentry/internal/tags/',
              status_code: '200',
              method: 'GET'
            },
            message: null,
            type: 'http'
          },
          {
            category: 'xhr',
            level: 'info',
            event_id: null,
            timestamp: '2017-07-20T19:00:54.958Z',
            data: {
              url: '/api/0/projects/sentry/internal/processingissues/',
              status_code: '200',
              method: 'GET'
            },
            message: null,
            type: 'http'
          },
          {
            category: 'xhr',
            level: 'info',
            event_id: null,
            timestamp: '2017-07-20T19:00:55.198Z',
            data: {
              url: '/api/0/projects/sentry/internal/issues/?query=is%3Aunresolved&limit=25&sort=date&statsPeriod=24h&shortIdLookup=1',
              status_code: '200',
              method: 'GET'
            },
            message: null,
            type: 'http'
          }
        ]
      }
    },
    {
      type: 'request',
      data: {
        fragment: '',
        cookies: [],
        env: null,
        headers: [
          ['Referer', 'http://localhost:8000/sentry/internal/'],
          [
            'User-Agent',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/59.0.3071.115 Safari/537.36'
          ]
        ],
        url: 'http://localhost:8000/sentry/internal/',
        query: '',
        data: null,
        method: null
      }
    }
  ]
];
