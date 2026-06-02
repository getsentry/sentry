import {DetailedProjectFixture} from 'sentry-fixture/project';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import ProjectIssueGrouping from 'sentry/views/settings/projectIssueGrouping';

describe('projectIssueGrouping', () => {
  const {organization} = initializeOrg({organization: {access: ['project:write']}});
  const project = DetailedProjectFixture({
    derivedGroupingEnhancements: 'stack.function:derived +app',
  });

  it('renders all sections with the derived rules read-only', async () => {
    render(<ProjectIssueGrouping />, {organization, outletContext: {project}});

    expect(
      await screen.findByRole('textbox', {name: 'Fingerprint Rules'})
    ).toBeInTheDocument();
    expect(screen.getByRole('textbox', {name: 'Stack Trace Rules'})).toBeInTheDocument();
    expect(
      screen.getByRole('textbox', {name: /Derived Grouping Enhancements/})
    ).toBeDisabled();
  });

  it('keeps Save/Cancel visible and gates the alert on edits', async () => {
    const updateRequest = MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/`,
      method: 'PUT',
      body: {...project, fingerprintingRules: 'error.type:Foo -> bar'},
    });

    render(<ProjectIssueGrouping />, {organization, outletContext: {project}});

    const fingerprintField = await screen.findByRole('textbox', {
      name: 'Fingerprint Rules',
    });

    // Save/Cancel are always visible (one pair per editable form); the alert only
    // appears once the form is dirty.
    expect(screen.getAllByRole('button', {name: 'Save'})).toHaveLength(2);
    expect(screen.getAllByRole('button', {name: 'Cancel'})).toHaveLength(2);
    expect(screen.queryByText(/Changing fingerprint rules/)).not.toBeInTheDocument();

    await userEvent.type(fingerprintField, 'error.type:Foo -> bar');
    expect(await screen.findByText(/Changing fingerprint rules/)).toBeInTheDocument();

    // The fingerprint form renders first, so its Save button comes first.
    const [fingerprintSave] = screen.getAllByRole('button', {name: 'Save'});
    if (fingerprintSave) {
      await userEvent.click(fingerprintSave);
    }

    await waitFor(() => {
      expect(updateRequest).toHaveBeenCalledWith(
        `/projects/${organization.slug}/${project.slug}/`,
        expect.objectContaining({
          data: {fingerprintingRules: 'error.type:Foo -> bar'},
        })
      );
    });
  });
});
