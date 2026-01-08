import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import ProjectDetailsForm from './projectDetailsForm';

describe('ProjectDetailsForm', () => {
  const organization = OrganizationFixture();
  const defaultPreference = {
    repositories: [],
    automated_run_stopping_point: 'code_changes' as const,
    automation_handoff: undefined,
  };

  it('disables PR Auto Creation toggle when Auto-Triggered Fixes is off', async () => {
    const project = ProjectFixture({autofixAutomationTuning: 'off'});

    render(
      <ProjectDetailsForm canWrite project={project} preference={defaultPreference} />,
      {organization}
    );

    const toggle = screen.getByRole('checkbox', {name: /Allow PR Auto Creation/i});
    expect(toggle).toBeDisabled();

    await userEvent.hover(toggle);
    expect(
      await screen.findByText('Turn on Auto-Triggered Fixes to use this feature.')
    ).toBeInTheDocument();
  });

  it('enables PR Auto Creation toggle when Auto-Triggered Fixes is on', () => {
    const project = ProjectFixture({autofixAutomationTuning: 'medium'});

    render(
      <ProjectDetailsForm canWrite project={project} preference={defaultPreference} />,
      {organization}
    );

    const toggle = screen.getByRole('checkbox', {name: /Allow PR Auto Creation/i});
    expect(toggle).toBeEnabled();
  });
});
