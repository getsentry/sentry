import {render, screen} from 'sentry-test/reactTestingLibrary';

import {DetailsPanel} from './detailsPanel';

const DEFAULT_VALUES = {alpha: 1, height: 1, width: 1, x: 1, y: 1, visible: true};
const MOCK_DATA = {
  ...DEFAULT_VALUES,
  identifier: 'parent',
  type: 'Container',
  x: 200,
  y: 201,
  width: 202,
  height: 203,
  children: [
    {
      ...DEFAULT_VALUES,
      identifier: 'intermediate',
      type: 'Nested Container',
      children: [
        {
          ...DEFAULT_VALUES,
          identifier: 'leaf',
          type: 'Text',
          children: [],
        },
      ],
    },
  ],
};

describe('View Hierarchy Details Panel', function () {
  it('omits children from rendered data', function () {
    render(<DetailsPanel data={MOCK_DATA} />);

    expect(screen.getByRole('cell', {name: '200'})).toBeInTheDocument();
    expect(screen.getByRole('cell', {name: '201'})).toBeInTheDocument();
    expect(screen.getByRole('cell', {name: '202'})).toBeInTheDocument();
    expect(screen.getByRole('cell', {name: '203'})).toBeInTheDocument();
    expect(screen.queryByRole('cell', {name: 'children'})).not.toBeInTheDocument();
  });

  it('accepts a custom title renderer', function () {
    const testGetTitle = jest.fn().mockImplementation(data => {
      return `${data.type} - ${data.identifier}`;
    });
    render(<DetailsPanel data={MOCK_DATA} getTitle={testGetTitle} />);

    expect(testGetTitle).toHaveBeenCalled();
    expect(screen.getByText('Container - parent')).toBeInTheDocument();
  });
});
