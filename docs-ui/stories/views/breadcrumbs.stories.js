import {action} from '@storybook/addon-actions';

import Breadcrumbs from 'sentry/components/breadcrumbs';

export default {
  title: 'Views/Breadcrumbs',
  component: Breadcrumbs,
};

export const _Breadcrumbs = () => (
  <Breadcrumbs
    crumbs={[
      {label: 'Test 1', to: '#'},
      {label: 'Test 2', to: '#'},
      {label: 'Test 3', to: '#'},
      {label: 'Test 4', to: null},
    ]}
  />
);

export const _BreadcrumbWithDropdown = () => (
  <Breadcrumbs
    crumbs={[
      {
        label: 'dropdown crumb',
        onSelect: action('onSelect'),
        items: [{label: 'item1'}, {label: 'item2'}, {label: 'item3'}],
      },
      {
        label: 'Test 2',
        to: '/test2',
      },
      {
        label: 'Test 3',
        to: null,
      },
    ]}
  />
);
