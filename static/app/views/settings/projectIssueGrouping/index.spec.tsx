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

    // Save/Cancel are always visible (one pair per editable form); the alert only
    // appears once the form is dirty.
    expect(screen.getAllByRole('button', {name: 'Save'})).toHaveLength(2);
    expect(screen.getAllByRole('button', {name: 'Cancel'})).toHaveLength(2);
    expect(screen.queryByText(/Changing fingerprint rules/)).not.toBeInTheDocument();

    await userEvent.type(fingerprintField, 'error.type:Foo -> bar');
    expect(await screen.findByText(/Changing fingerprint rules/)).toBeInTheDocument();

    // Scope to the fingerprint form so we click its own Save button.
    const fingerprintForm = fingerprintField.closest('form');
    if (fingerprintForm) {
      await userEvent.click(within(fingerprintForm).getByRole('button', {name: 'Save'}));
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

  it('surfaces API validation errors inline', async () => {
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/`,
      method: 'PUT',
      statusCode: 400,
      body: {fingerprintingRules: ['Invalid fingerprint rule']},
    });

    render(<ProjectIssueGrouping />, {organization, outletContext: {project}});

    const input = await screen.findByRole('textbox', {name: 'Fingerprint Rules'});
    await userEvent.type(input, 'this is not a valid rule');

    // Scope to the fingerprint form so we click its own Save button.
    const fingerprintForm = input.closest('form');
    if (fingerprintForm) {
      await userEvent.click(within(fingerprintForm).getByRole('button', {name: 'Save'}));
    }

    expect(await screen.findByText('Invalid fingerprint rule')).toBeInTheDocument();
  });
});
