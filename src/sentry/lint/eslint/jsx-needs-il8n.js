/*
 * @fileoverview Modified fork of jsx-no-literals to only consider literals w/
 *               letters, plus changed warning message string.
 *               See: https://github.com/yannickcr/eslint-plugin-react/blob/master/lib/rules/jsx-no-literals.js
 * @author Caleb Morris
 */
/*eslint-env node*/

// ------------------------------------------------------------------------------
// Rule Definition
// ------------------------------------------------------------------------------

module.exports = function(context) {

    function reportLiteralNode(node) {
        context.report(node, 'Missing translation function around literal string');
    }

    // --------------------------------------------------------------------------
    // Public
    // --------------------------------------------------------------------------

    return {

        Literal: function(node) {
            if (
              !/^[\s]+$/.test(node.value) &&
              /[A-Za-z]/.test(node.value) && // at least one letter; not symbols, numbers
              node.parent &&
              node.parent.type !== 'JSXExpressionContainer' &&
              node.parent.type !== 'JSXAttribute' &&
              node.parent.type.indexOf('JSX') !== -1
            ) {
                reportLiteralNode(node);
            }
        }

    };

};

module.exports.schema = [{
    type: 'object',
    properties: {},
    additionalProperties: false
}];