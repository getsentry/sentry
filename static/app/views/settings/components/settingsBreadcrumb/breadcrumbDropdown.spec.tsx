import {Fragment} from 'react';

import {act, render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import BreadcrumbDropdown from './breadcrumbDropdown';

describe('Settings Breadcrumb Dropdown', () => {
  const selectMock = jest.fn();

  const createWrapper = () => {
    return render(
      <BreadcrumbDropdown
        value={undefined}
        route={{path: '/', name: 'root'}}
        options={[
          {value: '1', label: 'foo'},
          {value: '2', label: 'bar'},
        ]}
        name="The Crumb"
        hasMenu
        onCrumbSelect={selectMock}
      />
    );
  };

  it('opens when hovered over crumb', async () => {
    createWrapper();
    expect(screen.getByText('The Crumb')).toBeInTheDocument();
    await userEvent.hover(screen.getByText('The Crumb'));
    expect(screen.getByText('foo')).toBeInTheDocument();
    expect(screen.getByText('bar')).toBeInTheDocument();
  });

  it('closes immediately after selecting an item', async () => {
    createWrapper();
    await userEvent.hover(screen.getByText('The Crumb'));
    expect(screen.getByText('foo')).toBeInTheDocument();

    await userEvent.click(screen.getByText('foo'));
    expect(selectMock).toHaveBeenCalledWith('1');

    expect(screen.queryByText('foo')).not.toBeInTheDocument();
  });

  it('stays open when hovered over crumb and then into dropdown menu', async () => {
    createWrapper();
    await userEvent.hover(screen.getByText('The Crumb'));
    expect(screen.getByText('foo')).toBeInTheDocument();

    await userEvent.hover(screen.getByText('foo'));
    expect(screen.getByText('foo')).toBeInTheDocument();
  });

  it('closes after entering dropdown and then leaving after timeout', async () => {
    jest.useFakeTimers();
    createWrapper();

    await userEvent.hover(screen.getByText('The Crumb'), {delay: null});
    expect(screen.getByText('foo')).toBeInTheDocument();

    await userEvent.hover(screen.getByText('foo'), {delay: null});
    expect(screen.getByText('foo')).toBeInTheDocument();

    await userEvent.unhover(screen.getByText('foo'), {delay: null});

    // The menu will not disappear until after a timeout
    expect(screen.getByText('foo')).toBeInTheDocument();

    // Menu disappears after timeout
    await act(() => jest.runAllTimersAsync());
    expect(screen.queryByText('foo')).not.toBeInTheDocument();
  });

  it('closes other breadcrumbs upon hover immediately', async () => {
    render(
      <Fragment>
        <BreadcrumbDropdown
          value={undefined}
          route={{path: '/', name: 'root'}}
          options={[
            {value: '1', label: 'foo'},
            {value: '2', label: 'bar'},
          ]}
          name="Crumb One"
          hasMenu
          onCrumbSelect={selectMock}
        />
        <BreadcrumbDropdown
          value={undefined}
          route={{path: '/', name: 'root'}}
          options={[
            {value: '1', label: 'baz'},
            {value: '2', label: 'buzz'},
          ]}
          name="Crumb Two"
          hasMenu
          onCrumbSelect={selectMock}
        />
      </Fragment>
    );

    await userEvent.hover(screen.getByText('Crumb One'), {delay: null});
    expect(screen.getByText('foo')).toBeInTheDocument();

    // One menu closes and the other immediately opens
    await userEvent.hover(screen.getByText('Crumb Two'), {delay: null});
    expect(screen.queryByText('foo')).not.toBeInTheDocument();
    expect(screen.getByText('baz')).toBeInTheDocument();
  });
});
