import {DetailedProjectFixture} from 'sentry-fixture/project';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';

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
    const fingerprintForm = fingerprintField.closest('form');
    if (!fingerprintForm) {
      throw new Error('Could not find the fingerprint rules form');
    }
    const fingerprint = within(fingerprintForm);

    // Save/Cancel are always visible; the alert only appears once dirty.
    expect(fingerprint.getByRole('button', {name: 'Save'})).toBeInTheDocument();
    expect(fingerprint.getByRole('button', {name: 'Cancel'})).toBeInTheDocument();
    expect(fingerprint.queryByText(/Changing fingerprint rules/)).not.toBeInTheDocument();

    await userEvent.type(fingerprintField, 'error.type:Foo -> bar');
    expect(
      await fingerprint.findByText(/Changing fingerprint rules/)
    ).toBeInTheDocument();

    await userEvent.click(fingerprint.getByRole('button', {name: 'Save'}));

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
