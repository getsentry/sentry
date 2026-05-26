import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';
import {selectEvent} from 'sentry-test/selectEvent';

import type {Permissions} from 'sentry/types/integrations';
import {PermissionSelection} from 'sentry/views/settings/organizationDeveloperSettings/permissionSelection';

const defaultPermissions: Permissions = {
  Event: 'no-access',
  Team: 'no-access',
  Member: 'no-access',
  Project: 'write',
  Release: 'admin',
  Organization: 'admin',
};

const noop = () => {};

describe('PermissionSelection', () => {
  it('renders a row for each resource', async () => {
    render(
      <PermissionSelection
        appPublished={false}
        hasContinuousIntegration
        permissions={defaultPermissions}
        onChange={noop}
      />
    );
    expect(await screen.findByRole('textbox', {name: 'Project'})).toBeInTheDocument();
    expect(screen.getByRole('textbox', {name: 'Team'})).toBeInTheDocument();
    expect(screen.getByRole('textbox', {name: 'Release'})).toBeInTheDocument();
    expect(screen.getByRole('textbox', {name: 'Issue & Event'})).toBeInTheDocument();
    expect(screen.getByRole('textbox', {name: 'Organization'})).toBeInTheDocument();
    expect(screen.getByRole('textbox', {name: 'Member'})).toBeInTheDocument();
    expect(
      screen.getByRole('checkbox', {name: 'Continuous Integration (CI)'})
    ).toBeInTheDocument();
  });

  it('lists human readable permissions', async () => {
    render(
      <PermissionSelection
        appPublished={false}
        hasContinuousIntegration
        permissions={defaultPermissions}
        onChange={noop}
      />
    );
    await screen.findByRole('textbox', {name: 'Project'});
    const expectOptions = async (name: string, options: string[]) => {
      for (const option of options) {
        await selectEvent.select(screen.getByRole('textbox', {name}), option);
      }
    };

    await expectOptions('Project', ['No Access', 'Read', 'Read & Write', 'Admin']);
    await expectOptions('Team', ['No Access', 'Read', 'Read & Write', 'Admin']);
    await expectOptions('Release', ['No Access', 'Admin']);
    await expectOptions('Issue & Event', ['No Access', 'Read', 'Read & Write', 'Admin']);
    await expectOptions('Organization', ['No Access', 'Read', 'Read & Write', 'Admin']);
    await expectOptions('Member', ['No Access', 'Read', 'Read & Write', 'Admin']);
  });

  it('stores the permissions the User has selected', async () => {
    const onChange = jest.fn();
    render(
      <PermissionSelection
        appPublished={false}
        hasContinuousIntegration
        permissions={defaultPermissions}
        onChange={onChange}
      />
    );
    await screen.findByRole('textbox', {name: 'Project'});
    const selectByValue = (name: string, value: string) =>
      selectEvent.select(screen.getByRole('textbox', {name}), value);

    await selectByValue('Project', 'Read & Write');
    await selectByValue('Team', 'Read');
    await selectByValue('Release', 'Admin');
    await selectByValue('Issue & Event', 'Admin');
    await selectByValue('Organization', 'Read');
    await selectByValue('Member', 'No Access');

    expect(onChange).toHaveBeenLastCalledWith(
      {
        Project: 'write',
        Team: 'read',
        Release: 'admin',
        Event: 'admin',
        Organization: 'read',
        Member: 'no-access',
      },
      true
    );
  });

  it('reflects the initial CI checkbox state', () => {
    render(
      <PermissionSelection
        appPublished={false}
        hasContinuousIntegration
        permissions={defaultPermissions}
        onChange={noop}
      />
    );
    expect(
      screen.getByRole('checkbox', {name: 'Continuous Integration (CI)'})
    ).toBeChecked();
  });

  it('reflects initial unchecked CI checkbox state', () => {
    render(
      <PermissionSelection
        appPublished={false}
        hasContinuousIntegration={false}
        permissions={defaultPermissions}
        onChange={noop}
      />
    );
    expect(
      screen.getByRole('checkbox', {name: 'Continuous Integration (CI)'})
    ).not.toBeChecked();
  });

  it('unchecks the Continuous Integration permission', async () => {
    const onChange = jest.fn();
    render(
      <PermissionSelection
        appPublished={false}
        hasContinuousIntegration
        permissions={defaultPermissions}
        onChange={onChange}
      />
    );
    const ciCheckbox = screen.getByRole('checkbox', {
      name: 'Continuous Integration (CI)',
    });

    expect(ciCheckbox).toBeChecked();
    await userEvent.click(ciCheckbox);

    expect(ciCheckbox).not.toBeChecked();
    expect(onChange).toHaveBeenLastCalledWith(expect.any(Object), false);
  });

  it('disables all controls when the app is published', () => {
    render(
      <PermissionSelection
        appPublished
        hasContinuousIntegration
        permissions={defaultPermissions}
        onChange={noop}
      />
    );
    expect(screen.getByRole('textbox', {name: 'Project'})).toBeDisabled();
    expect(screen.getByRole('textbox', {name: 'Team'})).toBeDisabled();
    expect(screen.getByRole('textbox', {name: 'Release'})).toBeDisabled();
    expect(screen.getByRole('textbox', {name: 'Issue & Event'})).toBeDisabled();
    expect(screen.getByRole('textbox', {name: 'Organization'})).toBeDisabled();
    expect(screen.getByRole('textbox', {name: 'Member'})).toBeDisabled();
    expect(
      screen.getByRole('checkbox', {name: 'Continuous Integration (CI)'})
    ).toBeDisabled();
  });

  it('hides the CI checkbox when displaySpecialPermissions is false', () => {
    render(
      <PermissionSelection
        appPublished={false}
        hasContinuousIntegration
        permissions={defaultPermissions}
        onChange={noop}
        displaySpecialPermissions={false}
      />
    );
    expect(
      screen.queryByRole('checkbox', {name: 'Continuous Integration (CI)'})
    ).not.toBeInTheDocument();
  });

  it('renders only the provided displayedPermissions', () => {
    render(
      <PermissionSelection
        appPublished={false}
        hasContinuousIntegration
        permissions={defaultPermissions}
        onChange={noop}
        displayedPermissions={[
          {
            resource: 'Project',
            help: 'Projects',
            choices: {
              'no-access': {label: 'No Access', scopes: []},
              read: {label: 'Read', scopes: ['project:read']},
            },
          },
        ]}
      />
    );
    expect(screen.getByRole('textbox', {name: 'Project'})).toBeInTheDocument();
    expect(screen.queryByRole('textbox', {name: 'Team'})).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox', {name: 'Organization'})).not.toBeInTheDocument();
  });

  it('renders permission errors', () => {
    render(
      <PermissionSelection
        appPublished={false}
        hasContinuousIntegration
        permissions={defaultPermissions}
        onChange={noop}
        errors={{
          Project:
            "Requested permission of project:write exceeds requester's permission.",
        }}
      />
    );
    expect(screen.getByRole('alert')).toHaveTextContent(
      "Requested permission of project:write exceeds requester's permission."
    );
  });

  it('renders continuous integration error', () => {
    render(
      <PermissionSelection
        appPublished={false}
        hasContinuousIntegration
        permissions={defaultPermissions}
        onChange={noop}
        continuousIntegrationError="Requested permission of org:ci exceeds requester's permission."
      />
    );
    expect(screen.getByRole('alert')).toHaveTextContent(
      "Requested permission of org:ci exceeds requester's permission."
    );
  });
});
