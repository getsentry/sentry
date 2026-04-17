import {render, screen, within} from 'sentry-test/reactTestingLibrary';

import {ErrorsToolbar} from 'sentry/views/explore/errors/toolbar';

describe('ErrorsToolbar', () => {
  it('renders the visualize section', async () => {
    render(<ErrorsToolbar />);

    const section = await screen.findByTestId('section-visualizes');
    expect(within(section).getByText('Visualize')).toBeInTheDocument();
    expect(within(section).getByRole('button', {name: 'Count'})).toBeInTheDocument();
    expect(within(section).getByRole('button', {name: 'Add Chart'})).toBeInTheDocument();
    expect(
      within(section).getByRole('button', {name: 'Add Equation'})
    ).toBeInTheDocument();
  });

  it('renders the group by section', async () => {
    render(<ErrorsToolbar />);

    const section = await screen.findByTestId('section-group-by');
    expect(within(section).getByTestId('editor-column')).toBeInTheDocument();
    expect(within(section).getByRole('button', {name: 'Add Group'})).toBeInTheDocument();
  });

  it('renders the sort by section', async () => {
    render(<ErrorsToolbar />);

    const section = await screen.findByTestId('section-sort-by');
    expect(within(section).getByText('Sort By')).toBeInTheDocument();
    expect(within(section).getByRole('button', {name: 'Desc'})).toBeInTheDocument();
  });

  it('renders the save as section', async () => {
    render(<ErrorsToolbar />);

    const section = await screen.findByTestId('section-save-as');
    expect(within(section).getByRole('button', {name: 'Save as'})).toBeInTheDocument();
  });
});
