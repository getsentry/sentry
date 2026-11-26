import {Fragment} from 'react';
import {render, screen} from '@testing-library/react';

import {ThemeWrapper} from '../../test/selectFixtures';

import {Select} from './select';

it('preserves creatable values with an empty options list', () => {
  render(
    <Fragment>
      <Select<string> onChange={jest.fn()} creatable options={[]} value="New fruit" />
      <Select<string>
        onChange={jest.fn()}
        creatable
        multiple
        options={[]}
        value={['New tag']}
      />
    </Fragment>,
    {wrapper: ThemeWrapper}
  );

  expect(screen.getByText('New fruit')).toBeInTheDocument();
  expect(screen.getByText('New tag')).toBeInTheDocument();
});
