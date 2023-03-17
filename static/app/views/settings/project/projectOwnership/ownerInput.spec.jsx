import selectEvent from 'react-select-event';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import MemberListStore from 'sentry/stores/memberListStore';
import OwnerInput from 'sentry/views/settings/project/projectOwnership/ownerInput';

describe('Project Ownership Input', function () {
  let org;
  let project;
  let put;

  beforeEach(function () {
    org = TestStubs.Organization();
    project = TestStubs.Project();

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/members/',
      method: 'GET',
      body: TestStubs.Members(),
    });
    put = MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/ownership/`,
      method: 'PUT',
      body: {raw: 'url:src @dummy@example.com'},
    });
    MemberListStore.init();
    MemberListStore.loadInitialData([
      TestStubs.User({id: '1', email: 'bob@example.com'}),
    ]);
  });

  it('renders', async function () {
    const {container} = render(
      <OwnerInput
        organization={org}
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

    expect(container).toSnapshot();
  });

  it('updates on add preserving existing text', async function () {
    render(
      <OwnerInput
        organization={org}
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
      '/projects/org-slug/project-slug/ownership/',
      expect.objectContaining({
        data: {
          raw: 'url:src @dummy@example.com' + '\n' + 'path:file.js bob@example.com',
        },
      })
    );
  });
});
