import {noCoreImport} from './no-core-import.mjs';
import {noTokenImport} from './no-token-import.mjs';
import {restrictJsxSlotChildren} from './restrict-jsx-slot-children.mjs';
import {useSemanticToken} from './use-semantic-token.mjs';

export const configs = {
  compactSelect: {
    /** @type {import('eslint').Linter.RulesRecord} */
    rules: {
      '@sentry/scraps/restrict-jsx-slot-children': [
        'error',
        {
          slots: [
            {
              componentNames: ['CompactSelect'],
              propNames: ['menuHeaderTrailingItems', 'menuFooter'],
              allowed: [
                {
                  source: '@sentry/scraps/compactSelect',
                  names: [
                    'MenuComponents.HeaderButton',
                    'MenuComponents.LinkButton',
                    'MenuComponents.CTAButton',
                    'MenuComponents.CTALinkButton',
                    'MenuComponents.ApplyButton',
                    'MenuComponents.CancelButton',
                    'MenuComponents.Alert',
                  ],
                },
                {
                  source: '@sentry/scraps/layout',
                  names: ['Flex', 'Stack', 'Grid', 'Container'],
                },
              ],
            },
            {
              componentNames: ['CompactSelect'],
              propNames: ['menuHeaderTrailingItems'],
              allowed: [
                {
                  source: '@sentry/scraps/compactSelect',
                  names: [
                    'MenuComponents.HeaderButton',
                    'MenuComponents.ClearButton',
                    'MenuComponents.ResetButton',
                  ],
                },
                {
                  source: '@sentry/scraps/layout',
                  names: ['Flex', 'Stack', 'Grid', 'Container'],
                },
              ],
            },
          ],
        },
      ],
    },
  },
};

export const rules = {
  'no-core-import': noCoreImport,
  'no-token-import': noTokenImport,
  'restrict-jsx-slot-children': restrictJsxSlotChildren,
  'use-semantic-token': useSemanticToken,
};
