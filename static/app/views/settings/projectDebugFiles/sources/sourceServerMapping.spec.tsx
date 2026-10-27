import {OrganizationFixture} from 'sentry-fixture/organization';
import {DetailedProjectFixture} from 'sentry-fixture/project';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {SourceServerMapping} from 'sentry/views/settings/projectDebugFiles/sources/sourceServerMapping';

describe('SourceServerMapping', () => {
  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('saves the setting when toggled on', async () => {
    const organization = OrganizationFixture();
    const project = DetailedProjectFixture({enableNativeSourceServerMapping: false});
    const projectEndpoint = `/projects/${organization.slug}/${project.slug}/`;
    const mock = MockApiClient.addMockResponse({
      url: projectEndpoint,
      method: 'PUT',
      body: {...project, enableNativeSourceServerMapping: true},
    });

    render(<SourceServerMapping organization={organization} project={project} />, {
      organization,
    });

    const toggle = screen.getByRole('checkbox', {name: 'Use Source Server Information'});
    expect(toggle).not.toBeChecked();
    await userEvent.click(toggle);

    await waitFor(() =>
      expect(mock).toHaveBeenCalledWith(
        projectEndpoint,
        expect.objectContaining({
          method: 'PUT',
          data: {enableNativeSourceServerMapping: true},
        })
      )
    );
  });

  it('is disabled without project:write access', () => {
    const organization = OrganizationFixture({access: []});
    const project = DetailedProjectFixture({access: []});

    render(<SourceServerMapping organization={organization} project={project} />, {
      organization,
    });

    expect(
      screen.getByRole('checkbox', {name: 'Use Source Server Information'})
    ).toBeDisabled();
  });
});
