import selectEvent from 'react-select-event';
import {Members} from 'sentry-fixture/members';
import {User} from 'sentry-fixture/user';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import MemberListStore from 'sentry/stores/memberListStore';
import OwnerInput from 'sentry/views/settings/project/projectOwnership/ownerInput';

describe('Project Ownership Input', function () {
  const {organization, project} = initializeOrg();
  let put: jest.Mock;

  beforeEach(function () {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/members/`,
      method: 'GET',
      body: Members(),
    });
    put = MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/ownership/`,
      method: 'PUT',
      body: {raw: 'url:src @dummy@example.com'},
    });
    MemberListStore.init();
    MemberListStore.loadInitialData([User({id: '1', email: 'bob@example.com'})]);
  });

  it('renders', async function () {
    render(
      <OwnerInput
        page="issue_details"
        onCancel={() => {}}
        dateUpdated={null}
        organization={organization}
        initialText="url:src @dummy@example.com"
        project={project}
      />
    );

    const submitButton = screen.getByRole('button', {name: 'Save'});
    expect(put).not.toHaveBeenCalled();

    // if text is unchanged, submit button is disabled
    await userEvent.click(submitButton);
    expect(put).not.toHaveBeenCalled();

    const textarea = screen.getByRole('textbox', {name: 'Ownership Rules'});

    await userEvent.clear(textarea);
    await userEvent.type(textarea, 'new');
    await userEvent.click(submitButton);

    expect(put).toHaveBeenCalled();
  });

  it('updates on add preserving existing text', async function () {
    render(
      <OwnerInput
        page="issue_details"
        onCancel={() => {}}
        dateUpdated={null}
        organization={organization}
        initialText="url:src @dummy@example.com"
        project={project}
      />
    );

    // Set a path, as path is selected bu default.
    await userEvent.type(screen.getByRole('textbox', {name: 'Rule pattern'}), 'file.js');

    // Select the user.
    await selectEvent.select(
      screen.getByRole('textbox', {name: 'Rule owner'}),
      'Foo Bar'
    );

    // Add the new rule.
    await userEvent.click(screen.getByRole('button', {name: 'Add rule'}));

    expect(put).toHaveBeenCalledWith(
      `/projects/${organization.slug}/${project.slug}/ownership/`,
      expect.objectContaining({
        data: {
          raw: 'url:src @dummy@example.com' + '\n' + 'path:file.js bob@example.com',
        },
      })
    );
  });
});
