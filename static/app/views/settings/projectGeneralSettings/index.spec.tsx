import {GroupingConfigsFixture} from 'sentry-fixture/groupingConfigs';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {
  act,
  fireEvent,
  render,
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';
import selectEvent from 'sentry-test/selectEvent';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {removePageFiltersStorage} from 'sentry/components/organizations/pageFilters/persistence';
import ProjectsStore from 'sentry/stores/projectsStore';
import ProjectContextProvider from 'sentry/views/projects/projectContext';
import {ProjectGeneralSettings} from 'sentry/views/settings/projectGeneralSettings';

jest.mock('sentry/actionCreators/indicator');
jest.mock('sentry/components/organizations/pageFilters/persistence');

function getField(role: string, name: string) {
  return screen.getByRole(role, {name});
}

describe('projectGeneralSettings', () => {
  const organization = OrganizationFixture();
  const project = ProjectFixture({
    subjectPrefix: '[my-org]',
    resolveAge: 48,
    allowedDomains: ['example.com', 'https://example.com'],
    scrapeJavaScript: true,
    securityToken: 'security-token',
    securityTokenHeader: 'x-security-header',
    verifySSL: true,
  });
  const groupingConfigs = GroupingConfigsFixture();
  let putMock: jest.Mock;
  const mockOnChangeSlug = jest.fn();

  const initialRouterConfig = {
    location: {
      pathname: `/settings/${organization.slug}/projects/${project.slug}/`,
    },
    route: '/settings/:orgId/projects/:projectId/',
  };

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/grouping-configs/`,
      method: 'GET',
      body: groupingConfigs,
    });
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/`,
      method: 'GET',
      body: project,
    });
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/environments/`,
      method: 'GET',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/users/`,
      method: 'GET',
      body: [],
    });
    mockOnChangeSlug.mockClear();
  });

  afterEach(() => {
    MockApiClient.clearMockResponses();
    jest.clearAllMocks();
  });

  it('renders form fields', async () => {
    render(
      <ProjectGeneralSettings project={project} onChangeSlug={mockOnChangeSlug} />,

      {
        organization,
        initialRouterConfig,
      }
    );

    expect(await screen.findByRole('textbox', {name: 'Slug'})).toHaveValue(
      'project-slug'
    );
    expect(screen.getByRole('textbox', {name: 'Subject Prefix'})).toHaveValue('[my-org]');

    // Step 19 of the auto resolve slider equates to 48 hours. This is
    // different from thee actual field value (which will be 48)
    expect(getField('slider', 'Auto Resolve')).toHaveValue('19');

    expect(getField('textbox', 'Allowed Domains')).toHaveValue(
      'example.com\nhttps://example.com'
    );
    expect(getField('checkbox', 'Enable JavaScript source fetching')).toBeChecked();
    expect(getField('textbox', 'Security Token')).toHaveValue('security-token');
    expect(getField('textbox', 'Security Token Header')).toHaveValue('x-security-header');
    expect(getField('checkbox', 'Verify TLS/SSL')).toBeChecked();
  });

  it('allows undoing an Allowed Domains change from the toast', async () => {
    putMock = MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/`,
      method: 'PUT',
      body: project,
    });

    render(<ProjectGeneralSettings project={project} onChangeSlug={mockOnChangeSlug} />, {
      organization,
      initialRouterConfig,
    });

    const allowedDomainsInput = await screen.findByRole('textbox', {
      name: 'Allowed Domains',
    });

    await userEvent.clear(allowedDomainsInput);
    await userEvent.type(allowedDomainsInput, 'changed.com');
    await userEvent.tab();

    await waitFor(() => expect(putMock).toHaveBeenCalledTimes(1));

    expect(putMock).toHaveBeenCalledWith(
      `/projects/${organization.slug}/${project.slug}/`,
      expect.objectContaining({
        method: 'PUT',
        data: {allowedDomains: ['changed.com']},
      })
    );

    const addSuccessMessageMock = addSuccessMessage as jest.MockedFunction<
      typeof addSuccessMessage
    >;
    const undo = addSuccessMessageMock.mock.calls[0]?.[1]?.undo;

    expect(undo).toBeInstanceOf(Function);

    act(() => {
      undo?.();
    });

    await waitFor(() => expect(putMock).toHaveBeenCalledTimes(2));

    expect(putMock).toHaveBeenLastCalledWith(
      `/projects/${organization.slug}/${project.slug}/`,
      expect.objectContaining({
        method: 'PUT',
        data: {allowedDomains: ['example.com', 'https://example.com']},
      })
    );

    await waitFor(() =>
      expect(screen.getByRole('textbox', {name: 'Allowed Domains'})).toHaveValue(
        'example.com,https://example.com'
      )
    );
  });

  it('disables scrapeJavaScript when equivalent org setting is false', async () => {
    const orgWithoutScrapeJavaScript = OrganizationFixture({
      scrapeJavaScript: false,
    });

    render(<ProjectGeneralSettings project={project} onChangeSlug={mockOnChangeSlug} />, {
      organization: orgWithoutScrapeJavaScript,
      initialRouterConfig,
    });

    expect(
      await screen.findByRole('checkbox', {name: 'Enable JavaScript source fetching'})
    ).toBeDisabled();
    expect(
      screen.getByRole('checkbox', {name: 'Enable JavaScript source fetching'})
    ).not.toBeChecked();
  });

  it('project admins can remove project', async () => {
    const deleteMock = MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/`,
      method: 'DELETE',
    });

    const {router} = render(
      <ProjectGeneralSettings project={project} onChangeSlug={mockOnChangeSlug} />,
      {
        organization,
        initialRouterConfig: {
          location: {
            pathname: `/${project.slug}/`,
          },
          route: '/:projectId/',
        },
      }
    );

    await userEvent.click(await screen.findByRole('button', {name: 'Remove Project'}));

    // Click confirmation button
    renderGlobalModal();
    await userEvent.click(screen.getByTestId('confirm-button'));

    expect(deleteMock).toHaveBeenCalled();
    expect(removePageFiltersStorage).toHaveBeenCalledWith('org-slug');
    expect(router.location.pathname).toBe('/settings/org-slug/projects/');
  });

  it('project admins can transfer project', async () => {
    const deleteMock = MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/transfer/`,
      method: 'POST',
    });

    render(<ProjectGeneralSettings project={project} onChangeSlug={mockOnChangeSlug} />, {
      organization,
      initialRouterConfig,
    });

    await userEvent.click(await screen.findByRole('button', {name: 'Transfer Project'}));

    // Click confirmation button
    renderGlobalModal();
    await userEvent.type(getField('textbox', 'Organization Owner'), 'billy@sentry.io');
    await userEvent.click(screen.getByTestId('confirm-button'));

    await waitFor(() =>
      expect(deleteMock).toHaveBeenCalledWith(
        `/projects/${organization.slug}/${project.slug}/transfer/`,
        expect.objectContaining({
          method: 'POST',
          data: {
            email: 'billy@sentry.io',
          },
        })
      )
    );

    expect(addSuccessMessage).toHaveBeenCalled();
  });

  it('handles errors on transfer project', async () => {
    const deleteMock = MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/transfer/`,
      method: 'POST',
      statusCode: 400,
      body: {detail: 'An organization owner could not be found'},
    });

    render(<ProjectGeneralSettings project={project} onChangeSlug={mockOnChangeSlug} />, {
      organization,
      initialRouterConfig,
    });

    await userEvent.click(await screen.findByRole('button', {name: 'Transfer Project'}));

    // Click confirmation button
    renderGlobalModal();
    await userEvent.type(getField('textbox', 'Organization Owner'), 'billy@sentry.io');
    await userEvent.click(screen.getByTestId('confirm-button'));

    await waitFor(() => expect(deleteMock).toHaveBeenCalled());

    expect(addSuccessMessage).not.toHaveBeenCalled();
    expect(addErrorMessage).toHaveBeenCalled();

    // Check the error message
    const {container} = render((addErrorMessage as jest.Mock).mock.calls[0][0]);
    expect(container).toHaveTextContent(
      'Error transferring project-slug. An organization owner could not be found'
    );
  });

  it('displays transfer/remove message for non-admins', async () => {
    const nonAdminOrg = OrganizationFixture({
      access: ['org:read'],
    });

    render(<ProjectGeneralSettings project={project} onChangeSlug={mockOnChangeSlug} />, {
      organization: nonAdminOrg,
      initialRouterConfig,
    });

    // Wait for the component to load
    await screen.findByRole('heading', {name: 'Project Settings'});

    expect(
      screen.getByText('You do not have the required permission to remove this project.')
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'You do not have the required permission to transfer this project.'
      )
    ).toBeInTheDocument();
  });

  it('disables the form for users without write permissions', async () => {
    const readOnlyOrg = OrganizationFixture({access: ['org:read']});

    render(<ProjectGeneralSettings project={project} onChangeSlug={mockOnChangeSlug} />, {
      organization: readOnlyOrg,
      initialRouterConfig,
    });

    // no textboxes are enabled
    screen.queryAllByRole('textbox').forEach(textbox => expect(textbox).toBeDisabled());

    expect(await screen.findByTestId('project-permission-alert')).toBeInTheDocument();
  });

  it('changing project platform updates ProjectsStore', async () => {
    ProjectsStore.loadInitialData([project]);

    putMock = MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/`,
      method: 'PUT',
      body: {
        ...project,
        platform: 'javascript',
      },
    });

    render(
      <ProjectContextProvider projectSlug={project.slug}>
        <ProjectGeneralSettings project={project} onChangeSlug={mockOnChangeSlug} />
      </ProjectContextProvider>,
      {
        organization,
        initialRouterConfig,
      }
    );

    const platformSelect = await screen.findByRole('textbox', {name: 'Platform'});
    await selectEvent.select(platformSelect, ['React']);

    expect(putMock).toHaveBeenCalled();

    // updates ProjectsStore
    expect(ProjectsStore.getById('2')!.platform).toBe('javascript');
  });

  it('changing name updates ProjectsStore', async () => {
    ProjectsStore.loadInitialData([project]);
    putMock = MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/`,
      method: 'PUT',
      body: {
        ...project,
        slug: 'new-project',
      },
    });

    render(
      <ProjectContextProvider projectSlug={project.slug}>
        <ProjectGeneralSettings project={project} onChangeSlug={mockOnChangeSlug} />
      </ProjectContextProvider>,
      {
        organization,
        initialRouterConfig,
      }
    );

    await userEvent.type(
      await screen.findByRole('textbox', {name: 'Slug'}),
      'New Project'
    );

    // Slug does not save on blur
    expect(putMock).not.toHaveBeenCalled();

    // Saves when clicking save
    await userEvent.click(screen.getByRole('button', {name: 'Save'}));

    // Check the mock was called with the new slug
    await waitFor(() => expect(mockOnChangeSlug).toHaveBeenCalledWith('new-project'));

    // Verify store was updated
    expect(ProjectsStore.getById('2')!.slug).toBe('new-project');
  });

  describe('Non-"save on blur" Field', () => {
    beforeEach(() => {
      ProjectsStore.loadInitialData([project]);

      putMock = MockApiClient.addMockResponse({
        url: `/projects/${organization.slug}/${project.slug}/`,
        method: 'PUT',
        body: {
          ...project,
          slug: 'new-project',
        },
      });
    });

    function renderProjectGeneralSettings() {
      render(
        <ProjectContextProvider projectSlug={project.slug}>
          <ProjectGeneralSettings project={project} onChangeSlug={mockOnChangeSlug} />
        </ProjectContextProvider>,
        {
          organization,
          initialRouterConfig,
        }
      );
    }

    it('can cancel unsaved changes for a field', async () => {
      renderProjectGeneralSettings();
      expect(screen.queryByRole('button', {name: 'Cancel'})).not.toBeInTheDocument();

      const autoResolveSlider = await screen.findByRole('slider', {name: 'Auto Resolve'});
      expect(autoResolveSlider).toHaveValue('19');

      // Change value
      fireEvent.change(autoResolveSlider, {target: {value: '12'}});
      expect(autoResolveSlider).toHaveValue('12');

      // Click cancel
      await userEvent.click(screen.getByRole('button', {name: 'Cancel'}));

      // Cancel row should disappear
      expect(screen.queryByRole('button', {name: 'Cancel'})).not.toBeInTheDocument();

      // Value should be reverted
      expect(autoResolveSlider).toHaveValue('19');

      // PUT should not be called
      expect(putMock).not.toHaveBeenCalled();
    });

    it('saves when value is changed and "Save" clicked', async () => {
      renderProjectGeneralSettings();
      expect(screen.queryByRole('button', {name: 'Save'})).not.toBeInTheDocument();

      const autoResolveSlider = await screen.findByRole('slider', {name: 'Auto Resolve'});
      expect(autoResolveSlider).toHaveValue('19');

      // Change value
      fireEvent.change(autoResolveSlider, {target: {value: '12'}});
      expect(autoResolveSlider).toHaveValue('12');

      // Should not have put mock called yet
      expect(putMock).not.toHaveBeenCalled();

      // Click "Save"
      await userEvent.click(screen.getByRole('button', {name: 'Save'}));

      // API endpoint should have been called
      await waitFor(() => {
        expect(putMock).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            data: {
              resolveAge: 12,
            },
          })
        );
      });

      expect(screen.queryByRole('button', {name: 'Save'})).not.toBeInTheDocument();
    });
  });

  describe('Console Platform Access Control', () => {
    beforeEach(() => {
      mockOnChangeSlug.mockClear();
      MockApiClient.clearMockResponses();
      MockApiClient.addMockResponse({
        url: `/organizations/org-slug/grouping-configs/`,
        method: 'GET',
        body: groupingConfigs,
      });
      MockApiClient.addMockResponse({
        url: `/projects/org-slug/project-slug/environments/`,
        method: 'GET',
        body: [],
      });
      MockApiClient.addMockResponse({
        url: `/organizations/org-slug/users/`,
        method: 'GET',
        body: [],
      });

      // required for async updates
      jest.spyOn(console, 'error').mockImplementation();
    });

    it('shows all platform options when all console platforms enabled', async () => {
      const orgWithGamingAccess = OrganizationFixture({
        enabledConsolePlatforms: ['nintendo-switch', 'playstation', 'xbox'],
      });

      const projectWithPlatform = ProjectFixture();

      // Add project API mock for this specific org
      MockApiClient.addMockResponse({
        url: `/projects/${orgWithGamingAccess.slug}/${projectWithPlatform.slug}/`,
        method: 'GET',
        body: projectWithPlatform,
      });

      const routerConfig = {
        location: {
          pathname: `/settings/${orgWithGamingAccess.slug}/projects/${projectWithPlatform.slug}/`,
        },
        route: '/settings/:orgId/projects/:projectId/',
      };

      render(
        <ProjectGeneralSettings
          project={projectWithPlatform}
          onChangeSlug={mockOnChangeSlug}
        />,
        {
          organization: orgWithGamingAccess,
          initialRouterConfig: routerConfig,
        }
      );

      const platformSelect = await screen.findByRole('textbox', {name: 'Platform'});
      await userEvent.click(platformSelect);

      // Should also show non-console platforms
      expect(screen.getByText('React')).toBeInTheDocument();

      // Should show console platforms
      expect(screen.getByText('PlayStation')).toBeInTheDocument();
      expect(screen.getByText('Xbox')).toBeInTheDocument();
      expect(screen.getByText('Nintendo Switch')).toBeInTheDocument();
    });

    it('shows only enabled console platforms', async () => {
      const orgWithoutGamingFeature = OrganizationFixture({
        enabledConsolePlatforms: ['nintendo-switch'], // only has nintendo access
      });
      const baseProject = ProjectFixture();

      MockApiClient.addMockResponse({
        url: `/projects/${orgWithoutGamingFeature.slug}/${baseProject.slug}/`,
        method: 'GET',
        body: baseProject,
      });

      const routerConfig = {
        location: {
          pathname: `/settings/${orgWithoutGamingFeature.slug}/projects/${baseProject.slug}/`,
        },
        route: '/settings/:orgId/projects/:projectId/',
      };

      render(
        <ProjectGeneralSettings project={baseProject} onChangeSlug={mockOnChangeSlug} />,
        {
          organization: orgWithoutGamingFeature,
          initialRouterConfig: routerConfig,
        }
      );

      const platformSelect = await screen.findByRole('textbox', {name: 'Platform'});
      await userEvent.click(platformSelect);

      // Should not show console platforms except nintendo
      expect(screen.queryByText('PlayStation')).not.toBeInTheDocument();
      expect(screen.queryByText('Xbox')).not.toBeInTheDocument();

      // Should show nintendo
      expect(screen.getByText('Nintendo Switch')).toBeInTheDocument();

      // Should still show non-console platforms
      expect(screen.getByText('React')).toBeInTheDocument();
    });
  });
});
