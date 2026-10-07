import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {BreadcrumbTitle} from './breadcrumbTitle';
import {SettingsBreadcrumbSelector} from './settingsBreadcrumbSelector';

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

describe('SettingsBreadcrumbSelector', () => {
  it('renders a label link and opens the parent menu from its separate icon button', async () => {
    const onCrumbSelect = jest.fn();
    const onSearch = jest.fn();
    const {rerender} = render(
      <SettingsBreadcrumbSelector
        label="javascript"
        to="/settings/org-slug/projects/javascript/"
        hasMenu
        value="javascript"
        options={options}
        onCrumbSelect={onCrumbSelect}
        search={{placeholder: 'Search Projects', onChange: onSearch}}
      >
        <BreadcrumbTitle title={title} breadcrumbs={items} />
      </SettingsBreadcrumbSelector>
    );

    expect(screen.getAllByRole('link').map(link => link.textContent)).toEqual([
      'javascript',
      'Settings',
      'Keys',
    ]);
    expect(screen.getByRole('link', {name: 'javascript'})).toHaveAttribute(
      'href',
      '/settings/org-slug/projects/javascript/'
    );
    expect(screen.getByRole('heading', {name: 'Details', level: 1})).toBeInTheDocument();
    const label = screen.getByText('javascript');
    const trigger = screen.getByRole('button', {name: 'Switch javascript'});
    expect(trigger).not.toContainElement(label);
    await userEvent.hover(label);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    await userEvent.click(trigger);
    await userEvent.type(await screen.findByPlaceholderText('Search Projects'), 'python');
    expect(onSearch).toHaveBeenLastCalledWith('python');

    rerender(
      <SettingsBreadcrumbSelector
        label="javascript"
        to="/settings/org-slug/projects/javascript/"
        hasMenu
        value="javascript"
        options={[options[1]!]}
        onCrumbSelect={onCrumbSelect}
        search={{placeholder: 'Search Projects', onChange: onSearch}}
      >
        <BreadcrumbTitle title={title} breadcrumbs={items} />
      </SettingsBreadcrumbSelector>
    );
    expect(screen.getByRole('button', {name: 'Switch javascript'})).toBeInTheDocument();
    await userEvent.click(screen.getByRole('option', {name: 'python'}));
    expect(onCrumbSelect).toHaveBeenCalledWith('python');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('renders a plain link when there are no alternatives', () => {
    render(
      <SettingsBreadcrumbSelector
        label="javascript"
        to="/settings/org-slug/projects/javascript/"
        hasMenu={false}
        value="javascript"
        options={options}
        onCrumbSelect={jest.fn()}
      >
        <BreadcrumbTitle title={title} breadcrumbs={items} />
      </SettingsBreadcrumbSelector>
    );
    expect(screen.getByRole('link', {name: 'javascript'})).toBeInTheDocument();
    expect(
      screen.queryByRole('button', {name: 'Switch javascript'})
    ).not.toBeInTheDocument();
  });
});
