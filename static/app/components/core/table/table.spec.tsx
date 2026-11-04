import type {ComponentProps} from 'react';
import {expectTypeOf} from 'expect-type';
import type {LocationDescriptor} from 'history';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {Table} from '@sentry/scraps/table';

it('accepts existing app sort destinations', () => {
  expectTypeOf<LocationDescriptor>().toExtend<
    NonNullable<ComponentProps<typeof Table.HeadCell>['to']>
  >();
});

it('navigates through the app router when a sort link is clicked', async () => {
  const {router} = render(
    <Table>
      <Table.Head>
        <Table.Row>
          <Table.HeadCell to="/sorted/">Duration</Table.HeadCell>
        </Table.Row>
      </Table.Head>
    </Table>,
    {initialRouterConfig: {location: {pathname: '/before/'}}}
  );

  await userEvent.click(screen.getByRole('link', {name: 'Duration'}));

  expect(router.location.pathname).toBe('/sorted/');
});
