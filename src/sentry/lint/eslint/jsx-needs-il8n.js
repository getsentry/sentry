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
            if (!/^[\s]+$/.test(node.value) && // ignore whitespace literals
                /[A-Za-z]/.test(node.value) && // must have at least one letter; not symbols, numbers
                node.parent
            ) {
               // alt or title attribute
               if (node.parent.type === 'JSXAttribute' && /title|alt|placeholder/.test(node.parent.name.name)) {
                   return void reportLiteralNode(node);
               }

               // inside component, e.g. <div>literal</div>
               if (node.parent.type !== 'JSXAttribute' &&
                   node.parent.type !== 'JSXExpressionContainer' &&
                   node.parent.type.indexOf('JSX') !== -1) {
                   return void reportLiteralNode(node);
               }
            }
        }

    };

};

module.exports.schema = [{
    type: 'object',
    properties: {},
    additionalProperties: false
}];