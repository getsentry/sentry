import {RuleTester} from '@typescript-eslint/rule-tester';

import {noQueryDataTypeParameters} from './no-query-data-type-parameters';

const ruleTester = new RuleTester();

ruleTester.run('no-query-data-type-parameters', noQueryDataTypeParameters, {
  valid: [
    {code: 'queryClient.getQueryData(queryKey);'},
    {code: 'queryClient.setQueryData(queryKey, updater);'},
    {code: 'client.getQueryData(queryKey);'},
    {code: 'queryClient.invalidateQueries<Foo>({queryKey});'},
    {code: 'getQueryData<Foo>(queryKey);'},
    {code: 'setQueryData<Foo>(queryKey, updater);'},
  ],
  invalid: [
    {
      code: 'queryClient.getQueryData<Foo>(queryKey);',
      errors: [{messageId: 'noTypeParameters', data: {method: 'getQueryData'}}],
    },
    {
      code: 'queryClient.setQueryData<Foo>(queryKey, updater);',
      errors: [{messageId: 'noTypeParameters', data: {method: 'setQueryData'}}],
    },
    {
      code: 'client.getQueryData<Foo>(queryKey);',
      errors: [{messageId: 'noTypeParameters', data: {method: 'getQueryData'}}],
    },
    {
      code: 'queryClient.setQueryData<ApiResponse<Project>>(queryKey, prev => prev);',
      errors: [{messageId: 'noTypeParameters', data: {method: 'setQueryData'}}],
    },
  ],
});
