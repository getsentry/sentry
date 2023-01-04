import {render, screen, userEvent, within} from 'sentry-test/reactTestingLibrary';

import {Tree} from './tree';

const DEFAULT_VALUES = {alpha: 1, height: 1, width: 1, x: 1, y: 1, visible: true};
const MOCK_DATA = {
  ...DEFAULT_VALUES,
  id: 'parent',
  type: 'Container',
  children: [
    {
      ...DEFAULT_VALUES,
      id: 'intermediate',
      type: 'Nested Container',
      children: [
        {
          ...DEFAULT_VALUES,
          id: 'leaf',
          type: 'Text',
          children: [],
        },
      ],
    },
  ],
};

describe('View Hierarchy Tree', function () {
  it('renders nested JSON', function () {
    render(<Tree data={MOCK_DATA} getNodeLabel={({type}) => type} />);

    expect(screen.getByRole('listitem', {name: 'Container'})).toBeVisible();
    expect(screen.getByRole('listitem', {name: 'Nested Container'})).toBeVisible();
    expect(screen.getByRole('listitem', {name: 'Text'})).toBeVisible();
  });

  it('can collapse and expand sections with children', function () {
    render(<Tree data={MOCK_DATA} getNodeLabel={({type}) => type} />);

    userEvent.click(
      within(screen.getByRole('listitem', {name: 'Nested Container'})).getByLabelText(
        'Collapse'
      )
    );
    expect(screen.getByRole('listitem', {name: 'Text'})).not.toBeVisible();
    userEvent.click(
      within(screen.getByRole('listitem', {name: 'Nested Container'})).getByLabelText(
        'Expand'
      )
    );
    expect(screen.queryByRole('listitem', {name: 'Text'})).toBeVisible();
  });
});
