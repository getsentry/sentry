import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {CompactSelect} from '@sentry/scraps/compactSelect';

describe('ListBox', () => {
  it('does not reserve scrollbar gutter if the list never overflowed', async () => {
    render(
      <CompactSelect
        search={{placeholder: 'Search here'}}
        onChange={jest.fn()}
        value={undefined}
        options={[
          {value: 'opt_one', label: 'Option One'},
          {value: 'opt_two', label: 'Option Two'},
          {value: 'opt_three', label: 'Option Three'},
        ]}
      />
    );

    await userEvent.click(screen.getByRole('button'));

    const listBox = screen.getByRole('listbox');
    const scrollContainer = listBox.parentElement?.parentElement;
    expect(scrollContainer).toBeInTheDocument();

    Object.defineProperty(scrollContainer, 'clientHeight', {
      value: 100,
      configurable: true,
    });
    Object.defineProperty(scrollContainer, 'scrollHeight', {
      value: 60,
      configurable: true,
    });

    await userEvent.type(screen.getByPlaceholderText('Search here'), 'Three');

    expect(scrollContainer).not.toHaveStyle({scrollbarGutter: 'stable'});
  });

  it('keeps scrollbar gutter once the list has overflowed', async () => {
    render(
      <CompactSelect
        search={{placeholder: 'Search here'}}
        onChange={jest.fn()}
        value={undefined}
        options={[
          {value: 'opt_one', label: 'Option One'},
          {value: 'opt_two', label: 'Option Two'},
          {value: 'opt_three', label: 'Option Three'},
        ]}
      />
    );

    await userEvent.click(screen.getByRole('button'));

    const listBox = screen.getByRole('listbox');
    const scrollContainer = listBox.parentElement?.parentElement;
    expect(scrollContainer).toBeInTheDocument();

    Object.defineProperty(scrollContainer, 'clientHeight', {
      value: 60,
      configurable: true,
    });
    Object.defineProperty(scrollContainer, 'scrollHeight', {
      value: 120,
      configurable: true,
    });

    await userEvent.type(screen.getByPlaceholderText('Search here'), 'Option');

    await waitFor(() => {
      expect(scrollContainer).toHaveStyle({scrollbarGutter: 'stable'});
    });

    Object.defineProperty(scrollContainer, 'scrollHeight', {
      value: 50,
      configurable: true,
    });

    await userEvent.clear(screen.getByPlaceholderText('Search here'));
    await userEvent.type(screen.getByPlaceholderText('Search here'), 'Three');

    expect(scrollContainer).toHaveStyle({scrollbarGutter: 'stable'});
  });

  it('hides details overlay when mouse leaves the list', async () => {
    render(
      <CompactSelect
        onChange={jest.fn()}
        value={undefined}
        options={[
          {
            value: 'opt_one',
            label: 'Option One',
            details: 'Details for option one',
            showDetailsInOverlay: true,
          },
          {
            value: 'opt_two',
            label: 'Option Two',
            details: 'Details for option two',
            showDetailsInOverlay: true,
          },
        ]}
      />
    );

    await userEvent.click(screen.getByRole('button'));

    await userEvent.hover(screen.getByRole('option', {name: 'Option One'}));

    const detailsOverlay = await screen.findByRole('tooltip');
    expect(detailsOverlay).toBeInTheDocument();
    expect(detailsOverlay).toHaveTextContent('Details for option one');

    const listBox = screen.getByRole('listbox');
    await userEvent.unhover(listBox);

    await waitFor(() => {
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });
  });

  it('shows different details when hovering over different options', async () => {
    render(
      <CompactSelect
        onChange={jest.fn()}
        value={undefined}
        options={[
          {
            value: 'opt_one',
            label: 'Option One',
            details: 'Details for option one',
            showDetailsInOverlay: true,
          },
          {
            value: 'opt_two',
            label: 'Option Two',
            details: 'Details for option two',
            showDetailsInOverlay: true,
          },
        ]}
      />
    );

    await userEvent.click(screen.getByRole('button'));

    await userEvent.hover(screen.getByRole('option', {name: 'Option One'}));
    expect(await screen.findByRole('tooltip')).toHaveTextContent(
      'Details for option one'
    );

    await userEvent.hover(screen.getByRole('option', {name: 'Option Two'}));
    expect(await screen.findByRole('tooltip')).toHaveTextContent(
      'Details for option two'
    );

    await userEvent.unhover(screen.getByRole('listbox'));

    await waitFor(() => {
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });
  });

  it('does not show details overlay when showDetailsInOverlay is false', async () => {
    render(
      <CompactSelect
        onChange={jest.fn()}
        value={undefined}
        options={[
          {
            value: 'opt_one',
            label: 'Option One',
            details: 'Details for option one',
            showDetailsInOverlay: false,
          },
        ]}
      />
    );

    await userEvent.click(screen.getByRole('button'));

    await userEvent.hover(screen.getByRole('option', {name: 'Option One'}));

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

    const option = screen.getByRole('option', {name: 'Option One'});
    expect(option).toHaveTextContent('Details for option one');
  });

  it('maintains keyboard navigation focus when hovering', async () => {
    render(
      <CompactSelect
        onChange={jest.fn()}
        value={undefined}
        options={[
          {
            value: 'opt_one',
            label: 'Option One',
            details: 'Details for option one',
            showDetailsInOverlay: true,
          },
          {
            value: 'opt_two',
            label: 'Option Two',
            details: 'Details for option two',
            showDetailsInOverlay: true,
          },
        ]}
      />
    );

    await userEvent.click(screen.getByRole('button'));

    await waitFor(() => {
      expect(screen.getByRole('option', {name: 'Option One'})).toHaveFocus();
    });

    expect(await screen.findByRole('tooltip')).toHaveTextContent(
      'Details for option one'
    );

    await userEvent.keyboard('{ArrowDown}');
    await waitFor(() => {
      expect(screen.getByRole('option', {name: 'Option Two'})).toHaveFocus();
    });

    expect(await screen.findByRole('tooltip')).toHaveTextContent(
      'Details for option two'
    );

    await userEvent.unhover(screen.getByRole('listbox'));
    await waitFor(() => {
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });
  });
});
