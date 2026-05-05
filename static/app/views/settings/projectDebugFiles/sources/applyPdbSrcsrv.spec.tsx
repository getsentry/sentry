import {ProjectFixture} from 'sentry-fixture/project';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {ApplyPdbSrcsrv} from 'sentry/views/settings/projectDebugFiles/sources/applyPdbSrcsrv';

describe('ApplyPdbSrcsrv', () => {
  const {organization} = initializeOrg();

  it('reflects the current project setting and saves on toggle', async () => {
    const project = ProjectFixture({applyPdbSrcsrv: false});
    const updateProject = MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/`,
      method: 'PUT',
      body: {...project, applyPdbSrcsrv: true},
    });

    render(<ApplyPdbSrcsrv organization={organization} project={project} />);

    expect(screen.getByText('Source Server (PDB srcsrv)')).toBeInTheDocument();
    const toggle = screen.getByRole('checkbox', {name: 'Use PDB source server paths'});
    expect(toggle).not.toBeChecked();

    await userEvent.click(toggle);

    await waitFor(() =>
      expect(updateProject).toHaveBeenCalledWith(
        `/projects/${organization.slug}/${project.slug}/`,
        expect.objectContaining({
          method: 'PUT',
          data: {applyPdbSrcsrv: true},
        })
      )
    );
  });

  it('starts on when the project has the option enabled', () => {
    const project = ProjectFixture({applyPdbSrcsrv: true});
    render(<ApplyPdbSrcsrv organization={organization} project={project} />);

    expect(
      screen.getByRole('checkbox', {name: 'Use PDB source server paths'})
    ).toBeChecked();
  });
});
