import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {SettingsBreadcrumbSlot} from './settingsBreadcrumbSlot';

const items = [
  {type: 'link' as const, label: 'Settings', to: '/settings/'},
  {
    type: 'link' as const,
    label: 'Keys',
    to: '/settings/org-slug/projects/javascript/keys/',
  },
];
const title = {type: 'page-title' as const, label: 'Details'};

const options = [
  {value: 'javascript', label: 'javascript'},
  {value: 'python', label: 'python'},
];

describe('SettingsBreadcrumbSlot', () => {
  it('keeps navigation separate from selection and inserts the parent in route order', async () => {
    const onCrumbSelect = jest.fn();
    const onSearch = jest.fn();
    const {rerender} = render(
      <SettingsBreadcrumbSlot
        items={items}
        itemIndex={1}
        title={title}
        isLast={false}
        label="javascript"
        to="/settings/org-slug/projects/javascript/"
        hasMenu
        value="javascript"
        options={options}
        onCrumbSelect={onCrumbSelect}
        search={{placeholder: 'Search Projects', onChange: onSearch}}
      />
    );

    expect(screen.getAllByRole('link').map(link => link.textContent)).toEqual([
      'Settings',
      'javascript',
      'Keys',
    ]);
    expect(screen.getByRole('link', {name: 'javascript'})).toHaveAttribute(
      'href',
      '/settings/org-slug/projects/javascript/'
    );
    expect(screen.getByRole('heading', {name: 'Details', level: 1})).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', {name: 'Switch javascript'}));
    await userEvent.type(await screen.findByPlaceholderText('Search Projects'), 'python');
    expect(onSearch).toHaveBeenLastCalledWith('python');

    rerender(
      <SettingsBreadcrumbSlot
        items={items}
        itemIndex={1}
        title={title}
        isLast={false}
        label="javascript"
        to="/settings/org-slug/projects/javascript/"
        hasMenu
        value="javascript"
        options={[options[1]!]}
        onCrumbSelect={onCrumbSelect}
        search={{placeholder: 'Search Projects', onChange: onSearch}}
      />
    );
    expect(screen.getByRole('link', {name: 'javascript'})).toBeInTheDocument();
    await userEvent.click(screen.getByRole('option', {name: 'python'}));
    expect(onCrumbSelect).toHaveBeenCalledWith('python');
  });

  it('renders a plain link when there are no alternatives', () => {
    render(
      <SettingsBreadcrumbSlot
        items={items}
        itemIndex={1}
        title={title}
        isLast={false}
        label="javascript"
        to="/settings/org-slug/projects/javascript/"
        hasMenu={false}
        value="javascript"
        options={options}
        onCrumbSelect={jest.fn()}
      />
    );
    expect(screen.getByRole('link', {name: 'javascript'})).toBeInTheDocument();
    expect(
      screen.queryByRole('button', {name: 'Switch javascript'})
    ).not.toBeInTheDocument();
  });

  it('renders the last item only as the page title', () => {
    render(
      <SettingsBreadcrumbSlot
        items={items}
        itemIndex={2}
        title={title}
        isLast
        label="javascript"
        to="/settings/org-slug/projects/javascript/"
        hasMenu
        value="javascript"
        options={options}
        onCrumbSelect={jest.fn()}
      />
    );
    expect(
      screen.getByRole('heading', {name: 'javascript', level: 1})
    ).toBeInTheDocument();
    expect(screen.queryByRole('link', {name: 'javascript'})).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', {name: 'Switch javascript'})
    ).not.toBeInTheDocument();
  });
});
