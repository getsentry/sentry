import {RuleTester} from '@typescript-eslint/rule-tester';

import {namingConvention} from './namingConvention';

const ruleTester = new RuleTester();

ruleTester.run('naming-convention', namingConvention, {
  valid: [
    'class ProjectStore {}',
    'interface _ProjectConfig {}',
    'type HTTPStatus<TValue> = TValue;',
    'enum ProjectState { ACTIVE, PENDING_DELETION, VALUE_2 }',
  ],
  invalid: [
    {
      code: 'class projectStore {}',
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
      code: 'type ProjectConfig<value> = value;',
      errors: [{messageId: 'typeLike'}],
    },
  ],
});
