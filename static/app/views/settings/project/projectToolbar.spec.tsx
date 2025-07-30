import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import ProjectToolbarSettings from 'sentry/views/settings/project/projectToolbar';

describe('ProjectToolbarSettings', function () {
  const {organization, project} = initializeOrg({
    organization: {
      features: ['sentry-toolbar-ui'],
    },
  });
  const initialRouterConfig = {
    location: {
      pathname: `/settings/projects/${project.slug}/toolbar/`,
    },
    route: '/settings/projects/:projectId/toolbar/',
  };
  const getProjectEndpoint = `/projects/${organization.slug}/${project.slug}/`;

  beforeEach(function () {
    MockApiClient.clearMockResponses();
  });

  it('displays previously saved setting', function () {
    const initialOptionValue = 'sentry.io';
    project.options = {'sentry:toolbar_allowed_origins': initialOptionValue};
    render(<ProjectToolbarSettings project={project} />, {
      initialRouterConfig,
      organization,
    });
    expect(screen.getByRole('textbox')).toHaveValue(initialOptionValue);
  });

  it('can submit new allowed origins', async function () {
    render(<ProjectToolbarSettings project={project} />, {
      initialRouterConfig,
      organization,
    });

    const mockPut = MockApiClient.addMockResponse({
      url: getProjectEndpoint,
      method: 'PUT',
    });

    const textarea = screen.getByRole('textbox');
    expect(textarea).toBeEnabled();

    const mockInput = 'test.io\n*.example.com';
    await userEvent.clear(textarea);
    await userEvent.type(textarea, mockInput);
    await userEvent.tab(); // unfocus ("blur") the input

    expect(mockPut).toHaveBeenCalledWith(
      getProjectEndpoint,
      expect.objectContaining({
        method: 'PUT',
        data: {
          options: {'sentry:toolbar_allowed_origins': mockInput},
        },
      })
    );
  });

  it('displays nothing when project options are undefined', function () {
    project.options = undefined;
    render(<ProjectToolbarSettings project={project} />, {
      initialRouterConfig,
      organization,
    });
    expect(screen.getByRole('textbox')).toHaveValue('');
  });

  it('displays nothing when project options are empty', function () {
    project.options = {};
    render(<ProjectToolbarSettings project={project} />, {
      initialRouterConfig,
      organization,
    });
    expect(screen.getByRole('textbox')).toHaveValue('');
  });
});
