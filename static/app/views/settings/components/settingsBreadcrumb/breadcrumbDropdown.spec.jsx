import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import BreadcrumbDropdown from 'sentry/views/settings/components/settingsBreadcrumb/breadcrumbDropdown';

describe('Settings Breadcrumb Dropdown', () => {
  const selectMock = jest.fn();
  const items = [
    {value: '1', label: 'foo'},
    {value: '2', label: 'bar'},
  ];

  const createWrapper = () => {
    return render(
      <BreadcrumbDropdown items={items} name="Test" hasMenu onSelect={selectMock} />
    );
  };

  it('opens when hovered over crumb', () => {
    createWrapper();
    expect(screen.getByText('Test')).toBeInTheDocument();
    userEvent.hover(screen.getByText('Test'));
    expect(screen.getByText('foo')).toBeInTheDocument();
    expect(screen.getByText('bar')).toBeInTheDocument();
  });

  it('closes immediately after selecting an item', () => {
    createWrapper();
    userEvent.hover(screen.getByText('Test'));
    expect(screen.getByText('foo')).toBeInTheDocument();

    userEvent.click(screen.getByText('foo'));
    expect(selectMock).toHaveBeenCalled();

    expect(screen.queryByText('foo')).not.toBeInTheDocument();
  });

  it('stays open when hovered over crumb and then into dropdown menu', () => {
    createWrapper();
    userEvent.hover(screen.getByText('Test'));
    expect(screen.getByText('foo')).toBeInTheDocument();

    userEvent.hover(screen.getByText('foo'));
    expect(screen.getByText('foo')).toBeInTheDocument();
  });

  it('closes after entering dropdown and then leaving dropdown', () => {
    createWrapper();
    userEvent.hover(screen.getByText('Test'));
    expect(screen.getByText('foo')).toBeInTheDocument();

    userEvent.hover(screen.getByText('foo'));
    expect(screen.getByText('foo')).toBeInTheDocument();
    userEvent.unhover(screen.getByText('foo'));

    expect(screen.queryByText('foo')).not.toBeInTheDocument();
  });
});
