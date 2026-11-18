import {RuleTester} from 'oxlint/plugins-dev';

import {namingConvention} from './namingConvention';

const ruleTester = new RuleTester({languageOptions: {parserOptions: {lang: 'ts'}}});

ruleTester.run('naming-convention', namingConvention, {
  valid: [
    'class ProjectStore {}',
    'interface _ProjectConfig {}',
    'type HTTPStatus<TValue> = TValue;',
    'enum ProjectState { ACTIVE, PENDING_DELETION, VALUE_2 }',
    'enum ProjectState { ["ACTIVE"] = 1, [`PENDING`] = 2 }',
    'enum ProjectState { [`\\u0041CTIVE`] = 1 }',
    'export default class {}',
    'const store = class {};',
  ],
  invalid: [
    {
      code: 'class projectStore {}',
      errors: [{messageId: 'typeLike'}],
    },
    {
      code: 'const Store = class store {};',
      errors: [{messageId: 'typeLike'}],
    },
    {
      code: 'interface projectConfig {}',
      errors: [{messageId: 'typeLike'}],
    },
    {
      code: 'enum projectState {}',
      errors: [{messageId: 'typeLike'}],
    },
    {
      code: 'type project_config = {};',
      errors: [{messageId: 'typeLike'}],
    },
    {
      code: 'enum ProjectState { active, "pendingDeletion" }',
      errors: [{messageId: 'enumMember'}, {messageId: 'enumMember'}],
    },
    {
      code: 'enum ProjectState { [`pendingDeletion`] = 1 }',
      errors: [{messageId: 'enumMember'}],
    },
    {
      code: 'type ProjectConfig<value> = value;',
      errors: [{messageId: 'typeLike'}],
    },
  ],
});
