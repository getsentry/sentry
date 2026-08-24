import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {PermissionsObserver} from 'sentry/views/settings/organizationDeveloperSettings/permissionsObserver';

const noop = () => {};

describe('PermissionsObserver', () => {
  it('defaults to no-access for resources not in scopes', () => {
    const onScopesChange = jest.fn();
    render(
      <PermissionsObserver
        scopes={['project:read', 'project:write', 'project:releases', 'org:admin']}
        events={['issue.created']}
        newApp={false}
        onScopesChange={onScopesChange}
        onEventsChange={noop}
      />
    );
    expect(screen.getByRole('textbox', {name: 'Team'})).toBeInTheDocument();
    expect(screen.getByRole('textbox', {name: 'Issue & Event'})).toBeInTheDocument();
    expect(screen.getByRole('textbox', {name: 'Member'})).toBeInTheDocument();
  });

  it('converts scopes into permissions and passes them through on change', () => {
    const onScopesChange = jest.fn();
    render(
      <PermissionsObserver
        scopes={[
          'project:read',
          'project:write',
          'project:releases',
          'org:admin',
          'org:ci',
        ]}
        events={['issue.created']}
        newApp={false}
        onScopesChange={onScopesChange}
        onEventsChange={noop}
      />
    );
    expect(screen.getByRole('textbox', {name: 'Project'})).toBeInTheDocument();
    expect(screen.getByRole('textbox', {name: 'Release'})).toBeInTheDocument();
    expect(screen.getByRole('textbox', {name: 'Organization'})).toBeInTheDocument();
  });

  it('checks the CI checkbox when org:ci is in scopes', () => {
    render(
      <PermissionsObserver
        scopes={['org:ci']}
        events={[]}
        newApp={false}
        onScopesChange={noop}
        onEventsChange={noop}
      />
    );
    expect(
      screen.getByRole('checkbox', {name: 'Continuous Integration (CI)'})
    ).toBeChecked();
  });

  it('does not check the CI checkbox when org:ci is not in scopes', () => {
    render(
      <PermissionsObserver
        scopes={['project:read']}
        events={[]}
        newApp={false}
        onScopesChange={noop}
        onEventsChange={noop}
      />
    );
    expect(
      screen.getByRole('checkbox', {name: 'Continuous Integration (CI)'})
    ).not.toBeChecked();
  });

  it('renders static panels by default', () => {
    render(
      <PermissionsObserver
        scopes={[]}
        events={[]}
        newApp={false}
        onScopesChange={noop}
        onEventsChange={noop}
      />
    );

    expect(screen.getByText('Permissions')).toBeInTheDocument();
    expect(screen.getByText('Webhooks')).toBeInTheDocument();
    expect(screen.getByRole('textbox', {name: 'Project'})).toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Permissions'})).not.toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Webhooks'})).not.toBeInTheDocument();
  });

  it('renders both panels collapsed when enabled', async () => {
    render(
      <PermissionsObserver
        scopes={['project:read']}
        events={['issue.created']}
        newApp={false}
        collapsePanels
        onScopesChange={noop}
        onEventsChange={noop}
      />
    );

    expect(screen.getByRole('button', {name: 'Permissions'})).toHaveAttribute(
      'aria-expanded',
      'false'
    );
    expect(screen.getByRole('button', {name: 'Webhooks'})).toHaveAttribute(
      'aria-expanded',
      'false'
    );
    expect(screen.queryByRole('textbox', {name: 'Project'})).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox', {name: 'issue'})).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'Permissions'}));

    expect(screen.getByRole('textbox', {name: 'Project'})).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'Webhooks'}));

    expect(screen.getByRole('checkbox', {name: 'issue'})).toBeInTheDocument();
  });

  it.each([
    {
      errorProps: {permissionErrors: {Project: 'Requires at least read access'}},
      message: 'Requires at least read access',
      type: 'resource permission',
    },
    {
      errorProps: {continuousIntegrationError: 'Continuous integration is required'},
      message: 'Continuous integration is required',
      type: 'continuous integration',
    },
  ])('expands the permissions panel for $type errors', ({errorProps, message}) => {
    const props: React.ComponentProps<typeof PermissionsObserver> = {
      scopes: ['project:read'],
      events: [],
      newApp: false,
      collapsePanels: true,
      onScopesChange: noop,
      onEventsChange: noop,
    };
    const {rerender} = render(<PermissionsObserver {...props} />);

    expect(screen.getByRole('button', {name: 'Permissions'})).toHaveAttribute(
      'aria-expanded',
      'false'
    );

    rerender(<PermissionsObserver {...props} {...errorProps} />);

    expect(screen.getByRole('button', {name: 'Permissions'})).toHaveAttribute(
      'aria-expanded',
      'true'
    );
    expect(screen.getByRole('alert')).toHaveTextContent(message);
  });
});
