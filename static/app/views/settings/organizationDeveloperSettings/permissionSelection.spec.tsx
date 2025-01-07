import {render, screen} from 'sentry-test/reactTestingLibrary';
import selectEvent from 'sentry-test/selectEvent';

import Form from 'sentry/components/forms/form';
import FormModel from 'sentry/components/forms/model';
import ModalStore from 'sentry/stores/modalStore';
import PermissionSelection from 'sentry/views/settings/organizationDeveloperSettings/permissionSelection';

describe('PermissionSelection', () => {
  let onChange: jest.Mock;
  let model: FormModel;

  function renderForm() {
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
  }

  it('renders a row for each resource', () => {
    renderForm();
    expect(screen.getByRole('textbox', {name: 'Project'})).toBeInTheDocument();
    expect(screen.getByRole('textbox', {name: 'Team'})).toBeInTheDocument();
    expect(screen.getByRole('textbox', {name: 'Release'})).toBeInTheDocument();
    expect(screen.getByRole('textbox', {name: 'Issue & Event'})).toBeInTheDocument();
    expect(screen.getByRole('textbox', {name: 'Organization'})).toBeInTheDocument();
    expect(screen.getByRole('textbox', {name: 'Member'})).toBeInTheDocument();
  });

  it('lists human readable permissions', async () => {
    renderForm();
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
    renderForm();
    const selectByValue = (name: string, value: string) =>
      selectEvent.select(screen.getByRole('textbox', {name}), value);

    await selectByValue('Project', 'Read & Write');
    await selectByValue('Team', 'Read');
    await selectByValue('Release', 'Admin');
    await selectByValue('Issue & Event', 'Admin');
    await selectByValue('Organization', 'Read');
    await selectByValue('Member', 'No Access');

    expect(model.getValue('Project--permission')).toBe('write');
    expect(model.getValue('Team--permission')).toBe('read');
    expect(model.getValue('Release--permission')).toBe('admin');
    expect(model.getValue('Event--permission')).toBe('admin');
    expect(model.getValue('Organization--permission')).toBe('read');
    expect(model.getValue('Member--permission')).toBe('no-access');
  });
});
