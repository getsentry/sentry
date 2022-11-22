import {render, screen} from 'sentry-test/reactTestingLibrary';

import ChevronDividedList from './chevronDividedList';

describe('ChevronDividedList', () => {
  it('should accept zero items and show an empty <List>', () => {
    const mockItems = [];
    render(<ChevronDividedList items={mockItems} />);

    expect(screen.queryByRole('listitem')).not.toBeInTheDocument();
    expect(screen.queryByRole('separator')).not.toBeInTheDocument();
  });

  it('should accept one item and show it in the <List>', () => {
    const mockItems = [<span key="1">first</span>];
    render(<ChevronDividedList items={mockItems} />);

    expect(screen.queryByRole('listitem')).toBeInTheDocument();
    expect(screen.queryByRole('separator')).not.toBeInTheDocument();
    expect(screen.getByText('first')).toBeInTheDocument();
  });

  it('should accept two items and show them both in the <List>', () => {
    const mockItems = [<span key="1">first</span>, <span key="2">second</span>];
    render(<ChevronDividedList items={mockItems} />);

    expect(screen.queryAllByRole('listitem')).toHaveLength(2);
    expect(screen.queryByRole('separator')).toBeInTheDocument();
    expect(screen.getByText('first')).toBeInTheDocument();
    expect(screen.getByText('second')).toBeInTheDocument();
  });

  it('should accept three items and show them all in the <List>', () => {
    const mockItems = [
      <span key="1">first</span>,
      <span key="2">second</span>,
      <span key="3">third</span>,
    ];
    render(<ChevronDividedList items={mockItems} />);

    expect(screen.queryAllByRole('listitem')).toHaveLength(3);
    expect(screen.queryAllByRole('separator')).toHaveLength(2);
    expect(screen.getByText('first')).toBeInTheDocument();
    expect(screen.getByText('second')).toBeInTheDocument();
    expect(screen.getByText('third')).toBeInTheDocument();
  });

  it('should accept many items and show them all in the <List>', () => {
    const mockItems = [
      <span key="1">first</span>,
      <span key="2">second</span>,
      <span key="3">third</span>,
      <span key="4">fourth</span>,
      <span key="5">fifth</span>,
      <span key="6">sixth</span>,
    ];
    render(<ChevronDividedList items={mockItems} />);

    expect(screen.queryAllByRole('listitem')).toHaveLength(6);
    expect(screen.queryAllByRole('separator')).toHaveLength(5);
  });
});
