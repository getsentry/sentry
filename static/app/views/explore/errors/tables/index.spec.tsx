import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {ErrorsTables} from './index';

describe('Errors Tab', () => {
  it('renders with Errors tab selected by default and shows respective components', () => {
    render(<ErrorsTables />);
    expect(screen.getByRole('tab', {name: 'Errors', selected: true})).toBeInTheDocument();
    expect(screen.getByTestId('errors-table')).toBeInTheDocument();
    const editButton = screen.getByRole('button', {name: 'Edit Table'});
    expect(editButton).toBeInTheDocument();
    expect(editButton).toBeEnabled();
  });
});

describe('Aggregates Tab', () => {
  it('renders the aggregates table when switching to Aggregates tab', async () => {
    render(<ErrorsTables />);
    await userEvent.click(screen.getByRole('tab', {name: 'Aggregates'}));
    expect(screen.getByTestId('aggregates-table')).toBeInTheDocument();
    expect(screen.queryByTestId('errors-table')).not.toBeInTheDocument();
    const editButton = screen.getByRole('button', {name: 'Edit Table'});
    expect(editButton).toBeInTheDocument();
    expect(editButton).toBeEnabled();
  });
});

describe('Attribute Breakdowns Tab', () => {
  it('hides the tables on the Attribute Breakdowns tab', async () => {
    render(<ErrorsTables />);
    await userEvent.click(screen.getByRole('tab', {name: 'Attribute Breakdowns'}));
    expect(screen.queryByTestId('errors-table')).not.toBeInTheDocument();
    expect(screen.queryByTestId('aggregates-table')).not.toBeInTheDocument();
  });

  it('renders a disabled Edit Table button on the Attribute Breakdowns tab', async () => {
    render(<ErrorsTables />);
    await userEvent.click(screen.getByRole('tab', {name: 'Attribute Breakdowns'}));
    expect(screen.getByRole('button', {name: 'Edit Table'})).toBeDisabled();
  });
});
