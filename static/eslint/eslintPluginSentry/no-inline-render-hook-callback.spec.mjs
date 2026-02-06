import {RuleTester} from 'eslint';

import noInlineRenderHookCallback from './no-inline-render-hook-callback.mjs';

const ruleTester = new RuleTester();

ruleTester.run('no-inline-render-hook-callback', noInlineRenderHookCallback, {
  valid: [
    {
      code: 'renderHook(useBootstrapOrganizationQuery, {wrapper, initialProps: orgSlug});',
    },
    {
      code: 'renderHookWithProviders(useBootstrapOrganizationQuery, {initialProps: orgSlug});',
    },
    {
      code: 'renderHook(callback, {wrapper});',
    },
    {
      code: 'someOtherRenderHook(() => useBootstrapOrganizationQuery(orgSlug), {wrapper});',
    },
  ],

  invalid: [
    {
      code: 'renderHook(() => useBootstrapOrganizationQuery(orgSlug), {wrapper});',
      errors: [{messageId: 'forbidden'}],
    },
    {
      code: 'renderHook(props => useBootstrapOrganizationQuery(props), {wrapper});',
      errors: [{messageId: 'forbidden'}],
    },
    {
      code: 'renderHookWithProviders(() => useBootstrapOrganizationQuery(orgSlug), {wrapper});',
      errors: [{messageId: 'forbidden'}],
    },
    {
      code: 'renderHookWithProviders(function () { return useBootstrapOrganizationQuery(orgSlug); }, {wrapper});',
      errors: [{messageId: 'forbidden'}],
    },
  ],
});
