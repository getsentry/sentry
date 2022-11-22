import {render, screen} from 'sentry-test/reactTestingLibrary';

import ChevronDividedList from './chevronDividedList';

describe('ChevronDividedList', () => {
  it('should accept zero items and show an empty <List>', async () => {
    const mockItems = [];
    render(<ChevronDividedList items={mockItems} />);

    expect(await screen.queryByRole('listitem')).not.toBeInTheDocument();
    expect(await screen.queryByRole('separator')).not.toBeInTheDocument();
  });

  it('should accept one item and show it in the <List>', async () => {
    const mockItems = [<span key="1">first</span>];
    render(<ChevronDividedList items={mockItems} />);

    expect(await screen.queryByRole('listitem')).toBeInTheDocument();
    expect(await screen.queryByRole('separator')).not.toBeInTheDocument();
    expect(await screen.getByText('first')).toBeInTheDocument();
  });

  it('should accept two items and show them both in the <List>', async () => {
    const mockItems = [<span key="1">first</span>, <span key="2">second</span>];
    render(<ChevronDividedList items={mockItems} />);

    expect(await screen.queryAllByRole('listitem')).toHaveLength(2);
    expect(await screen.queryByRole('separator')).toBeInTheDocument();
    expect(await screen.getByText('first')).toBeInTheDocument();
    expect(await screen.getByText('second')).toBeInTheDocument();
  });

  it('should accept three items and show them all in the <List>', async () => {
    const mockItems = [
      <span key="1">first</span>,
      <span key="2">second</span>,
      <span key="3">third</span>,
    ];
    render(<ChevronDividedList items={mockItems} />);

    expect(await screen.queryAllByRole('listitem')).toHaveLength(3);
    expect(await screen.queryAllByRole('separator')).toHaveLength(2);
    expect(await screen.getByText('first')).toBeInTheDocument();
    expect(await screen.getByText('second')).toBeInTheDocument();
    expect(await screen.getByText('third')).toBeInTheDocument();
  });

  it('should accept many items and show them all in the <List>', async () => {
    const mockItems = [
      <span key="1">first</span>,
      <span key="2">second</span>,
      <span key="3">third</span>,
      <span key="4">fourth</span>,
      <span key="5">fifth</span>,
      <span key="6">sixth</span>,
    ];
    render(<ChevronDividedList items={mockItems} />);

    expect(await screen.queryAllByRole('listitem')).toHaveLength(6);
    expect(await screen.queryAllByRole('separator')).toHaveLength(5);
  });
});
