import {browserHistory} from 'react-router';
import selectEvent from 'react-select-event';
import {GroupingConfigsFixture} from 'sentry-fixture/groupingConfigs';
import {LocationFixture} from 'sentry-fixture/locationFixture';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {RouterContextFixture} from 'sentry-fixture/routerContextFixture';
import {RouterFixture} from 'sentry-fixture/routerFixture';

import {
  act,
  fireEvent,
  render,
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {removePageFiltersStorage} from 'sentry/components/organizations/pageFilters/persistence';
import ProjectsStore from 'sentry/stores/projectsStore';
import ProjectContext from 'sentry/views/projects/projectContext';
import ProjectGeneralSettings from 'sentry/views/settings/projectGeneralSettings';

jest.mock('sentry/actionCreators/indicator');
jest.mock('sentry/components/organizations/pageFilters/persistence');

function getField(role, name) {
  return screen.getByRole(role, {name});
}

describe('projectGeneralSettings', function () {
  const org = OrganizationFixture();
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
  let routerContext;
  let putMock;

  const router = RouterFixture();
  const routerProps = {
    location: LocationFixture(),
    routes: router.routes,
    route: router.routes[0],
    router,
    routeParams: router.params,
  };

  beforeEach(function () {
    jest.spyOn(window.location, 'assign');
    routerContext = RouterContextFixture([
      {
        router: RouterFixture({
          params: {
            projectId: project.slug,
          },
        }),
      },
    ]);

    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/grouping-configs/`,
      method: 'GET',
      body: groupingConfigs,
    });
    MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/`,
      method: 'GET',
      body: project,
    });
    MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/environments/`,
      method: 'GET',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/users/`,
      method: 'GET',
      body: [],
    });
  });

  afterEach(function () {
    MockApiClient.clearMockResponses();
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it('renders form fields', function () {
    render(
      <ProjectGeneralSettings {...routerProps} params={{projectId: project.slug}} />
    );

    expect(getField('textbox', 'Name')).toHaveValue('Project Name');
    expect(getField('textbox', 'Subject Prefix')).toHaveValue('[my-org]');

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

  it('disables scrapeJavaScript when equivalent org setting is false', function () {
    routerContext.context.organization.scrapeJavaScript = false;
    render(
      <ProjectGeneralSettings {...routerProps} params={{projectId: project.slug}} />,
      {
        context: routerContext,
      }
    );

    expect(getField('checkbox', 'Enable JavaScript source fetching')).toBeDisabled();
    expect(getField('checkbox', 'Enable JavaScript source fetching')).not.toBeChecked();
  });

  it('project admins can remove project', async function () {
    const deleteMock = MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/`,
      method: 'DELETE',
    });

    render(
      <ProjectGeneralSettings {...routerProps} params={{projectId: project.slug}} />
    );

    await userEvent.click(screen.getByRole('button', {name: 'Remove Project'}));

    // Click confirmation button
    renderGlobalModal();
    await userEvent.click(screen.getByTestId('confirm-button'));

    expect(deleteMock).toHaveBeenCalled();
    expect(removePageFiltersStorage).toHaveBeenCalledWith('org-slug');
  });

  it('project admins can transfer project', async function () {
    const deleteMock = MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/transfer/`,
      method: 'POST',
    });

    render(
      <ProjectGeneralSettings {...routerProps} params={{projectId: project.slug}} />
    );

    await userEvent.click(screen.getByRole('button', {name: 'Transfer Project'}));

    // Click confirmation button
    renderGlobalModal();
    await userEvent.type(getField('textbox', 'Organization Owner'), 'billy@sentry.io');
    await userEvent.click(screen.getByTestId('confirm-button'));

    await waitFor(() =>
      expect(deleteMock).toHaveBeenCalledWith(
        `/projects/${org.slug}/${project.slug}/transfer/`,
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
      url: `/projects/${org.slug}/${project.slug}/transfer/`,
      method: 'POST',
      statusCode: 400,
      body: {detail: 'An organization owner could not be found'},
    });

    render(
      <ProjectGeneralSettings {...routerProps} params={{projectId: project.slug}} />
    );

    await userEvent.click(screen.getByRole('button', {name: 'Transfer Project'}));

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

  it('displays transfer/remove message for non-admins', function () {
    routerContext.context.organization.access = ['org:read'];

    const {container} = render(
      <ProjectGeneralSettings {...routerProps} params={{projectId: project.slug}} />,
      {context: routerContext}
    );

    expect(container).toHaveTextContent(
      'You do not have the required permission to remove this project.'
    );
    expect(container).toHaveTextContent(
      'You do not have the required permission to transfer this project.'
    );
  });

  it('disables the form for users without write permissions', function () {
    const readOnlyOrg = OrganizationFixture({access: ['org:read']});
    routerContext.context.organization = readOnlyOrg;

    render(
      <ProjectGeneralSettings {...routerProps} params={{projectId: project.slug}} />,
      {
        context: routerContext,
        organization: readOnlyOrg,
      }
    );

    // no textboxes are enabled
    screen.queryAllByRole('textbox').forEach(textbox => expect(textbox).toBeDisabled());

    expect(screen.getByTestId('project-permission-alert')).toBeInTheDocument();
  });

  it('changing project platform updates ProjectsStore', async function () {
    const params = {projectId: project.slug};
    ProjectsStore.loadInitialData([project]);

    putMock = MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/`,
      method: 'PUT',
      body: {
        ...project,
        platform: 'javascript',
      },
    });

    render(
      <ProjectContext projectSlug={project.slug}>
        <ProjectGeneralSettings
          {...routerProps}
          routes={[]}
          location={routerContext.context.location}
          params={params}
        />
      </ProjectContext>,
      {context: routerContext}
    );

    const platformSelect = await screen.findByRole('textbox', {name: 'Platform'});
    await selectEvent.select(platformSelect, ['React']);

    expect(putMock).toHaveBeenCalled();

    // updates ProjectsStore
    expect(ProjectsStore.getById('2')!.platform).toBe('javascript');
  });

  it('changing name updates ProjectsStore', async function () {
    const params = {projectId: project.slug};
    ProjectsStore.loadInitialData([project]);

    putMock = MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/`,
      method: 'PUT',
      body: {
        ...project,
        slug: 'new-project',
      },
    });

    render(
      <ProjectContext projectSlug={project.slug}>
        <ProjectGeneralSettings
          {...routerProps}
          routes={[]}
          location={routerContext.context.location}
          params={params}
        />
      </ProjectContext>,
      {context: routerContext}
    );

    await userEvent.type(
      await screen.findByRole('textbox', {name: 'Name'}),
      'New Project'
    );

    // Slug does not save on blur
    expect(putMock).not.toHaveBeenCalled();

    // Saves when clicking save
    await userEvent.click(screen.getByRole('button', {name: 'Save'}));

    // Redirects the user
    await waitFor(() => expect(browserHistory.replace).toHaveBeenCalled());
    expect(ProjectsStore.getById('2')!.slug).toBe('new-project');
  });

  describe('Non-"save on blur" Field', function () {
    beforeEach(function () {
      const params = {projectId: project.slug};
      ProjectsStore.loadInitialData([project]);

      putMock = MockApiClient.addMockResponse({
        url: `/projects/${org.slug}/${project.slug}/`,
        method: 'PUT',
        body: {
          ...project,
          slug: 'new-project',
        },
      });

      render(
        <ProjectContext projectSlug={project.slug}>
          <ProjectGeneralSettings
            {...routerProps}
            routes={[]}
            location={routerContext.context.location}
            params={params}
          />
        </ProjectContext>,
        {context: routerContext}
      );
    });

    it('can cancel unsaved changes for a field', async function () {
      expect(screen.queryByRole('button', {name: 'Cancel'})).not.toBeInTheDocument();

      const autoResolveSlider = getField('slider', 'Auto Resolve');
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
      expect(screen.queryByRole('button', {name: 'Save'})).not.toBeInTheDocument();

      const autoResolveSlider = getField('slider', 'Auto Resolve');
      expect(autoResolveSlider).toHaveValue('19');

      // Change value
      fireEvent.change(autoResolveSlider, {target: {value: '12'}});
      expect(autoResolveSlider).toHaveValue('12');

      // Should not have put mock called yet
      expect(putMock).not.toHaveBeenCalled();

      // Click "Save"
      await userEvent.click(screen.getByRole('button', {name: 'Save'}));
      await act(tick);

      // API endpoint should have been called
      expect(putMock).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: {
            resolveAge: 12,
          },
        })
      );

      expect(screen.queryByRole('button', {name: 'Save'})).not.toBeInTheDocument();
    });
  });
});
