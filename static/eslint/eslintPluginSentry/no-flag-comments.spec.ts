import {RuleTester} from '@typescript-eslint/rule-tester';

import {noFlagComments} from './no-flag-comments';

const ruleTester = new RuleTester();

ruleTester.run('no-flag-comments', noFlagComments, {
  valid: [
    {code: '// This is a normal comment'},
    {code: '// TODO: fix this'},
    {code: '/** JSDoc comment */'},
    {code: '// a - b - c'},
    {code: '// --strict flag enables strict mode'},
    {code: '// =='},
    {code: '// -=-=-=-=-'},
  ],
  invalid: [
    {
      code: '// ---------------------------------------------------------------------------',
      errors: [{messageId: 'noFlagComment'}],
    },
    {
      code: '// ---',
      errors: [{messageId: 'noFlagComment'}],
    },
    {
      code: '// ----------',
      errors: [{messageId: 'noFlagComment'}],
    },
    {
      code: '// ========================================================================',
      errors: [{messageId: 'noFlagComment'}],
    },
    {
      code: '// ***',
      errors: [{messageId: 'noFlagComment'}],
    },
    {
      code: '// ___',
      errors: [{messageId: 'noFlagComment'}],
    },
    {
      code: '// ###',
      errors: [{messageId: 'noFlagComment'}],
    },
    {
      code: '// ~~~',
      errors: [{messageId: 'noFlagComment'}],
    },
    {
      code: '// ─────────',
      errors: [{messageId: 'noFlagComment'}],
    },
    {
      code: [
        '// ========================================================================',
        '// RELEASE DETAIL CONTAINER',
        '// ========================================================================',
      ].join('\n'),
      errors: [{messageId: 'noFlagComment'}, {messageId: 'noFlagComment'}],
    },
    {
      code: [
        '// ---------------------------------------------------------------------------',
        '// Test implementations',
        '// ---------------------------------------------------------------------------',
      ].join('\n'),
      errors: [{messageId: 'noFlagComment'}, {messageId: 'noFlagComment'}],
    },
  ],
});
