import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {ViewHierarchyTree} from './tree';

const MOCK_DATA = {
  id: 'parent',
  type: 'Container',
  children: [
    {
      id: 'intermediate',
      type: 'Nested Container',
      children: [
        {
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
    render(<ViewHierarchyTree hierarchy={MOCK_DATA} />);

    expect(screen.getByText('Container')).toBeInTheDocument();
    expect(screen.getByText('Nested Container')).toBeInTheDocument();
    expect(screen.getByText('Text')).toBeInTheDocument();
  });

  it('can collapse and expand sections with children', function () {
    render(<ViewHierarchyTree hierarchy={MOCK_DATA} />);

    userEvent.click(screen.getAllByLabelText('Collapse')[1]);
    expect(screen.queryByText('Text')).not.toBeInTheDocument();
    userEvent.click(screen.getByLabelText('Expand'));
    expect(screen.getByText('Text')).toBeInTheDocument();
  });
});
