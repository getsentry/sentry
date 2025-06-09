import {GroupingConfigsFixture} from 'sentry-fixture/groupingConfigs';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {
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

describe('projectGeneralSettings', function () {
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

  beforeEach(function () {
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

  afterEach(function () {
    MockApiClient.clearMockResponses();
    jest.clearAllMocks();
  });

  it('renders form fields', async function () {
    render(
      <ProjectGeneralSettings onChangeSlug={mockOnChangeSlug} />,

      {
        organization,
        initialRouterConfig,
      }
    );

    expect(await screen.findByRole('textbox', {name: 'Name'})).toHaveValue(
      'Project Name'
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

  it('disables scrapeJavaScript when equivalent org setting is false', async function () {
    const orgWithoutScrapeJavaScript = OrganizationFixture({
      scrapeJavaScript: false,
    });

    render(<ProjectGeneralSettings onChangeSlug={mockOnChangeSlug} />, {
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

  it('project admins can remove project', async function () {
    const deleteMock = MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/`,
      method: 'DELETE',
    });

    const {router} = render(<ProjectGeneralSettings onChangeSlug={mockOnChangeSlug} />, {
      organization,
      initialRouterConfig: {
        location: {
          pathname: `/${project.slug}/`,
        },
        route: '/:projectId/',
      },
    });

    await userEvent.click(await screen.findByRole('button', {name: 'Remove Project'}));

    // Click confirmation button
    renderGlobalModal();
    await userEvent.click(screen.getByTestId('confirm-button'));

    expect(deleteMock).toHaveBeenCalled();
    expect(removePageFiltersStorage).toHaveBeenCalledWith('org-slug');
    expect(router.location.pathname).toBe('/settings/org-slug/projects/');
  });

  it('project admins can transfer project', async function () {
    const deleteMock = MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/transfer/`,
      method: 'POST',
    });

    render(<ProjectGeneralSettings onChangeSlug={mockOnChangeSlug} />, {
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

  it('handles errors on transfer project', async function () {
    const deleteMock = MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/transfer/`,
      method: 'POST',
      statusCode: 400,
      body: {detail: 'An organization owner could not be found'},
    });

    render(<ProjectGeneralSettings onChangeSlug={mockOnChangeSlug} />, {
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

  it('displays transfer/remove message for non-admins', async function () {
    const nonAdminOrg = OrganizationFixture({
      access: ['org:read'],
    });

    render(<ProjectGeneralSettings onChangeSlug={mockOnChangeSlug} />, {
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

  it('disables the form for users without write permissions', async function () {
    const readOnlyOrg = OrganizationFixture({access: ['org:read']});

    render(<ProjectGeneralSettings onChangeSlug={mockOnChangeSlug} />, {
      organization: readOnlyOrg,
      initialRouterConfig,
    });

    // no textboxes are enabled
    screen.queryAllByRole('textbox').forEach(textbox => expect(textbox).toBeDisabled());

    expect(await screen.findByTestId('project-permission-alert')).toBeInTheDocument();
  });

  it('changing project platform updates ProjectsStore', async function () {
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
        <ProjectGeneralSettings onChangeSlug={mockOnChangeSlug} />
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

  it('changing name updates ProjectsStore', async function () {
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
        <ProjectGeneralSettings onChangeSlug={mockOnChangeSlug} />
      </ProjectContextProvider>,
      {
        organization,
        initialRouterConfig,
      }
    );

    await userEvent.type(
      await screen.findByRole('textbox', {name: 'Name'}),
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

  describe('Non-"save on blur" Field', function () {
    beforeEach(function () {
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
          <ProjectGeneralSettings onChangeSlug={mockOnChangeSlug} />
        </ProjectContextProvider>,
        {
          organization,
          initialRouterConfig,
        }
      );
    }

    it('can cancel unsaved changes for a field', async function () {
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

    it('saves when value is changed and "Save" clicked', async function () {
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
});
