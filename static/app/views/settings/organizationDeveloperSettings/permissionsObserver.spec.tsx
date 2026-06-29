import {render, screen} from 'sentry-test/reactTestingLibrary';

import {PermissionsObserver} from 'sentry/views/settings/organizationDeveloperSettings/permissionsObserver';

const noop = () => {};

describe('PermissionsObserver', () => {
  it('defaults to no-access for resources not in scopes', () => {
    const onScopesChange = jest.fn();
    render(
      <PermissionsObserver
        scopes={['project:read', 'project:write', 'project:releases', 'org:admin']}
        events={['issue']}
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
        events={['issue']}
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
});
