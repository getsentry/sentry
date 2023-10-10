import selectEvent from 'react-select-event';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import Form from 'sentry/components/forms/form';
import FormModel from 'sentry/components/forms/model';
import ModalStore from 'sentry/stores/modalStore';
import PermissionSelection from 'sentry/views/settings/organizationDeveloperSettings/permissionSelection';

describe('PermissionSelection', () => {
  let onChange;
  let model;

  beforeEach(() => {
    model = new FormModel();
    onChange = jest.fn();
    render(
      <Form model={model}>
        <PermissionSelection
          appPublished={false}
          permissions={{
            Event: 'no-access',
            Team: 'no-access',
            Member: 'no-access',
            Project: 'write',
            Release: 'admin',
            Organization: 'admin',
          }}
          onChange={onChange}
        />
      </Form>
    );
    ModalStore.reset();
  });

  it('renders a row for each resource', () => {
    expect(screen.getByRole('textbox', {name: 'Project'})).toBeInTheDocument();
    expect(screen.getByRole('textbox', {name: 'Team'})).toBeInTheDocument();
    expect(screen.getByRole('textbox', {name: 'Release'})).toBeInTheDocument();
    expect(screen.getByRole('textbox', {name: 'Issue & Event'})).toBeInTheDocument();
    expect(screen.getByRole('textbox', {name: 'Organization'})).toBeInTheDocument();
    expect(screen.getByRole('textbox', {name: 'Member'})).toBeInTheDocument();
  });

  it('lists human readable permissions', async () => {
    const expectOptions = async (name, options) => {
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
    const selectByValue = (name, value) =>
      selectEvent.select(screen.getByRole('textbox', {name}), value);

    await selectByValue('Project', 'Read & Write');
    await selectByValue('Team', 'Read');
    await selectByValue('Release', 'Admin');
    await selectByValue('Issue & Event', 'Admin');
    await selectByValue('Organization', 'Read');
    await selectByValue('Member', 'No Access');

    expect(model.getValue('Project--permission')).toEqual('write');
    expect(model.getValue('Team--permission')).toEqual('read');
    expect(model.getValue('Release--permission')).toEqual('admin');
    expect(model.getValue('Event--permission')).toEqual('admin');
    expect(model.getValue('Organization--permission')).toEqual('read');
    expect(model.getValue('Member--permission')).toEqual('no-access');
  });
});
