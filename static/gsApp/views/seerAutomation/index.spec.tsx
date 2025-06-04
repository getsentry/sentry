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

  it('can update the org default autofix automation tuning slider', async function () {
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

    const slider = await screen.findByRole('slider', {
      name: /Default for New Projects/i,
    });

    act(() => {
      slider.focus();
    });

    await userEvent.keyboard('{ArrowRight}');

    act(() => {
      slider.blur();
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
