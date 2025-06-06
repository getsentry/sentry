import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {act, render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import ProjectsStore from 'sentry/stores/projectsStore';

import SeerAutomationRoot from './index';

describe('SeerAutomation', function () {
  afterEach(() => {
    MockApiClient.clearMockResponses();
    jest.resetAllMocks();
    ProjectsStore.reset();
  });

  it('can update the org default autofix automation tuning setting', async function () {
    const organization = OrganizationFixture({
      features: ['trigger-autofix-on-issue-summary'],
    });
    const project = ProjectFixture();
    ProjectsStore.loadInitialData([project]);

    const orgPutRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/`,
      method: 'PUT',
      body: {defaultAutofixAutomationTuning: 'high'},
    });

    // Project details used to populate the project list
    MockApiClient.addMockResponse({
      url: `/projects/org-slug/${project.slug}/`,
      method: 'GET',
      body: {
        ...project,
        autofixAutomationTuning: 'off',
      },
    });

    render(<SeerAutomationRoot />, {organization});

    // Project details populate the project list
    const projectItem = await screen.findByRole('link', {name: project.slug});
    expect(projectItem).toBeInTheDocument();
    expect(projectItem.parentElement!.parentElement).toHaveTextContent('Off');

    // Find the select menu
    const select = await screen.findByRole('textbox', {
      name: /Default Automation for New Projects/i,
    });

    act(() => {
      select.focus();
    });

    // Open the menu and select a new value (e.g., 'Only Super Highly Actionable Issues')
    await userEvent.click(select);
    const option = await screen.findByText('Only Super Highly Actionable Issues');
    await userEvent.click(option);

    act(() => {
      select.blur();
    });

    await waitFor(() => {
      expect(orgPutRequest).toHaveBeenCalledTimes(1);
    });
    expect(orgPutRequest).toHaveBeenCalledWith(
      `/organizations/${organization.slug}/`,
      expect.objectContaining({
        data: {defaultAutofixAutomationTuning: 'super_low'},
      })
    );
  });
});
