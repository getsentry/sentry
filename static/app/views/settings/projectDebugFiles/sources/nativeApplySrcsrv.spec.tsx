import {ProjectFixture} from 'sentry-fixture/project';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {NativeApplySrcsrv} from 'sentry/views/settings/projectDebugFiles/sources/nativeApplySrcsrv';

describe('NativeApplySrcsrv', () => {
  const {organization} = initializeOrg();

  it('reflects the current project setting and saves on toggle', async () => {
    const project = ProjectFixture({nativeApplySrcsrv: false});
    const updateProject = MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/`,
      method: 'PUT',
      body: {...project, nativeApplySrcsrv: true},
    });

    render(<NativeApplySrcsrv organization={organization} project={project} />);

    expect(screen.getByText('Source Server (srcsrv)')).toBeInTheDocument();
    const toggle = screen.getByRole('checkbox', {name: 'Use source server paths'});
    expect(toggle).not.toBeChecked();

    await userEvent.click(toggle);

    await waitFor(() =>
      expect(updateProject).toHaveBeenCalledWith(
        `/projects/${organization.slug}/${project.slug}/`,
        expect.objectContaining({
          method: 'PUT',
          data: {nativeApplySrcsrv: true},
        })
      )
    );
  });

  it('starts on when the project has the option enabled', () => {
    const project = ProjectFixture({nativeApplySrcsrv: true});
    render(<NativeApplySrcsrv organization={organization} project={project} />);

    expect(screen.getByRole('checkbox', {name: 'Use source server paths'})).toBeChecked();
  });
});
