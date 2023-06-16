import {InjectedRouter} from 'react-router';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {act, render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import * as indicators from 'sentry/actionCreators/indicator';
import GlobalModal from 'sentry/components/globalModal';
import AppStoreConnectContext from 'sentry/components/projects/appStoreConnectContext';
import {DEBUG_SOURCE_TYPES} from 'sentry/data/debugFileSources';
import ModalStore from 'sentry/stores/modalStore';
import {
  AppStoreConnectCredentialsStatus,
  CustomRepo,
  CustomRepoAppStoreConnect,
  CustomRepoHttp,
  CustomRepoType,
} from 'sentry/types/debugFiles';
import CustomRepositories from 'sentry/views/settings/projectDebugFiles/sources/customRepositories';

function TestComponent({
  organization,
  customRepositories,
  credetialsStatus,
  ...props
}: Omit<React.ComponentProps<typeof CustomRepositories>, 'customRepositories'> & {
  credetialsStatus?: AppStoreConnectCredentialsStatus;
  customRepositories?:
    | [CustomRepoHttp, CustomRepoAppStoreConnect]
    | [CustomRepoHttp]
    | [CustomRepoAppStoreConnect];
}) {
  const appStoreConnectRepo = customRepositories?.find(
    customRepository => customRepository.type === CustomRepoType.APP_STORE_CONNECT
  );

  return (
    <AppStoreConnectContext.Provider
      value={
        appStoreConnectRepo
          ? {
              [appStoreConnectRepo.id]: {
                credentials: credetialsStatus ?? {status: 'valid'},
                lastCheckedBuilds: null,
                latestBuildNumber: null,
                latestBuildVersion: null,
                pendingDownloads: 0,
                updateAlertMessage: undefined,
              },
            }
          : undefined
      }
    >
      <GlobalModal />
      <CustomRepositories
        {...props}
        organization={organization}
        customRepositories={customRepositories ?? []}
      />
    </AppStoreConnectContext.Provider>
  );
}

function getProps(props?: {router: InjectedRouter}) {
  const {organization, router, project, routerContext} = initializeOrg({
    router: props?.router,
  });

  return {
    api: new MockApiClient(),
    organization,
    project,
    router,
    projSlug: project.slug,
    isLoading: false,
    location: router.location,
    routerContext,
  };
}

describe('Custom Repositories', function () {
  const httpRepository: CustomRepo = {
    id: '7ebdb871-eb65-0183-8001-ea7df90613a7',
    layout: {type: 'native', casing: 'default'},
    name: 'New Repo',
    password: {'hidden-secret': true},
    type: CustomRepoType.HTTP,
    url: 'https://msdl.microsoft.com/download/symbols/',
    username: 'admin',
  };

  const appStoreConnectRepository: CustomRepo = {
    id: '2192940b704a4e9987a676a0b0dba42c',
    appId: '7ebdb871',
    appName: 'Release Health',
    appconnectIssuer: '7ebdb871-eb65-0183-8001-ea7df90613a7',
    appconnectKey: 'XXXXX',
    appconnectPrivateKey: {'hidden-secret': true},
    bundleId: 'io.sentry.mobile.app',
    name: 'Release Health',
    type: CustomRepoType.APP_STORE_CONNECT,
  };

  beforeEach(() => {
    ModalStore.reset();
  });

  beforeAll(async function () {
    // TODO: figure out why this transpile is so slow
    // transpile the modal upfront so the test runs fast
    await import('sentry/components/modals/debugFileCustomRepository');
  });

  it('renders', async function () {
    const props = getProps();

    const {rerender} = render(<TestComponent {...props} />, {
      context: props.routerContext,
    });

    // Section title
    expect(screen.getByText('Custom Repositories')).toBeInTheDocument();

    // Enabled button
    expect(screen.getByText('Add Repository').closest('button')).toBeEnabled();

    // Content
    expect(screen.getByText('No custom repositories configured')).toBeInTheDocument();

    // Choose an App Store Connect source
    await userEvent.click(screen.getByText('Add Repository'));

    await userEvent.click(screen.getByText('App Store Connect'));

    // Display modal content
    // A single instance of App Store Connect is available on free plans
    expect(await screen.findByText('App Store Connect credentials')).toBeInTheDocument();

    // Close Modal
    await userEvent.click(screen.getByLabelText('Close Modal'));

    // Choose another source
    await userEvent.click(screen.getByText('Add Repository'));

    await userEvent.click(screen.getByText('Amazon S3'));

    // Feature disabled warning
    expect(
      await screen.findByText('This feature is not enabled on your Sentry installation.')
    ).toBeInTheDocument();

    // Help content
    expect(
      screen.getByText(
        "# Enables the Custom Symbol Sources feature SENTRY_FEATURES['custom-symbol-sources'] = True"
      )
    ).toBeInTheDocument();

    // Close Modal
    await userEvent.click(screen.getByLabelText('Close Modal'));

    await waitFor(() => {
      expect(screen.queryByText('App Store Connect credentials')).not.toBeInTheDocument();
    });

    // Renders disabled repository list
    rerender(
      <TestComponent
        {...props}
        customRepositories={[httpRepository, appStoreConnectRepository]}
      />
    );

    // Content
    const actions = screen.queryAllByLabelText('Actions');
    expect(actions).toHaveLength(2);

    // HTTP Repository
    expect(screen.getByText(httpRepository.name)).toBeInTheDocument();
    expect(screen.getByText(DEBUG_SOURCE_TYPES.http)).toBeInTheDocument();
    expect(actions[0]).toBeDisabled();

    // App Store Connect Repository
    expect(screen.getByText(appStoreConnectRepository.name)).toBeInTheDocument();
    expect(screen.getByText(DEBUG_SOURCE_TYPES.appStoreConnect)).toBeInTheDocument();
    expect(actions[1]).toBeEnabled();

    // A new App Store Connect instance is not available on free plans
    // Choose an App Store Connect source
    await userEvent.click(screen.getByText('Add Repository'));

    await userEvent.click(screen.getByRole('button', {name: 'App Store Connect'}));

    // Feature disabled warning
    expect(
      await screen.findByText('This feature is not enabled on your Sentry installation.')
    ).toBeInTheDocument();

    // Help content
    expect(
      screen.getByText(
        "# Enables the App Store Connect Multiple feature SENTRY_FEATURES['app-store-connect-multiple'] = True"
      )
    ).toBeInTheDocument();
  });

  it('renders with custom-symbol-sources feature enabled', async function () {
    const props = getProps();
    const newOrganization = {...props.organization, features: ['custom-symbol-sources']};

    const {rerender} = render(
      <TestComponent {...props} organization={newOrganization} />,
      {context: props.routerContext}
    );

    // Section title
    expect(screen.getByText('Custom Repositories')).toBeInTheDocument();

    // Enabled button
    expect(screen.getByText('Add Repository').closest('button')).toBeEnabled();

    // Content
    expect(screen.getByText('No custom repositories configured')).toBeInTheDocument();

    // Choose a source
    await userEvent.click(screen.getByText('Add Repository'));

    await userEvent.click(screen.getByText('Amazon S3'));

    // Display modal content
    expect(
      await screen.findByText(textWithMarkupMatcher('Add Amazon S3 Repository'))
    ).toBeInTheDocument();

    // Close Modal
    await userEvent.click(screen.getByLabelText('Close Modal'));

    // Renders enabled repository list
    rerender(
      <TestComponent
        {...props}
        organization={newOrganization}
        customRepositories={[httpRepository, appStoreConnectRepository]}
      />
    );

    // Content
    const actions = screen.queryAllByLabelText('Actions');
    expect(actions).toHaveLength(2);

    // HTTP Repository
    expect(screen.getByText(httpRepository.name)).toBeInTheDocument();
    expect(screen.getByText(DEBUG_SOURCE_TYPES.http)).toBeInTheDocument();
    expect(actions[0]).toBeEnabled();

    // App Store Connect Repository
    expect(screen.getByText(appStoreConnectRepository.name)).toBeInTheDocument();
    expect(screen.getByText(DEBUG_SOURCE_TYPES.appStoreConnect)).toBeInTheDocument();
    expect(actions[1]).toBeEnabled();
  });

  it('renders with app-store-connect-multiple feature enabled', async function () {
    const props = getProps();

    const newOrganization = {
      ...props.organization,
      features: ['app-store-connect-multiple'],
    };

    render(
      <TestComponent
        {...props}
        organization={newOrganization}
        customRepositories={[httpRepository, appStoreConnectRepository]}
      />,
      {context: props.routerContext}
    );

    // Section title
    expect(screen.getByText('Custom Repositories')).toBeInTheDocument();

    // Content
    const actions = screen.queryAllByLabelText('Actions');
    expect(actions).toHaveLength(2);

    // HTTP Repository
    expect(screen.getByText(httpRepository.name)).toBeInTheDocument();
    expect(screen.getByText(DEBUG_SOURCE_TYPES.http)).toBeInTheDocument();
    expect(actions[0]).toBeDisabled();

    // App Store Connect Repository
    expect(screen.getByText(appStoreConnectRepository.name)).toBeInTheDocument();
    expect(screen.getByText(DEBUG_SOURCE_TYPES.appStoreConnect)).toBeInTheDocument();
    expect(actions[1]).toBeEnabled();

    // Enabled button
    expect(screen.getByText('Add Repository').closest('button')).toBeEnabled();

    await userEvent.click(screen.getByText('Add Repository'));

    await userEvent.click(screen.getByRole('button', {name: 'App Store Connect'}));

    // Display modal content
    // A new App Store Connect instance is available
    expect(await screen.findByText('App Store Connect credentials')).toBeInTheDocument();

    // Close Modal
    await userEvent.click(screen.getByLabelText('Close Modal'));
  });

  it('renders with custom-symbol-sources and app-store-connect-multiple features enabled', function () {
    const props = getProps();

    const newOrganization = {
      ...props.organization,
      features: ['custom-symbol-sources', 'app-store-connect-multiple'],
    };

    render(
      <TestComponent
        {...props}
        organization={newOrganization}
        customRepositories={[httpRepository, appStoreConnectRepository]}
      />,
      {context: props.routerContext}
    );

    // Content
    const actions = screen.queryAllByLabelText('Actions');
    expect(actions).toHaveLength(2);

    // HTTP Repository
    expect(screen.getByText(httpRepository.name)).toBeInTheDocument();
    expect(screen.getByText(DEBUG_SOURCE_TYPES.http)).toBeInTheDocument();
    expect(actions[0]).toBeEnabled();

    // App Store Connect Repository
    expect(screen.getByText(appStoreConnectRepository.name)).toBeInTheDocument();
    expect(screen.getByText(DEBUG_SOURCE_TYPES.appStoreConnect)).toBeInTheDocument();
    expect(actions[1]).toBeEnabled();
  });

  describe('Sync Now button', function () {
    const props = getProps();

    it('enabled and send requests', async function () {
      // Request succeeds
      const refreshMockSuccess = MockApiClient.addMockResponse({
        url: `/projects/${props.organization.slug}/${props.project.slug}/appstoreconnect/${appStoreConnectRepository.id}/refresh/`,
        method: 'POST',
        statusCode: 200,
      });

      jest.spyOn(indicators, 'addSuccessMessage');

      const {rerender} = render(
        <TestComponent
          {...props}
          organization={props.organization}
          customRepositories={[httpRepository, appStoreConnectRepository]}
        />,
        {context: props.routerContext}
      );

      const syncNowButton = screen.getByRole('button', {name: 'Sync Now'});
      expect(syncNowButton).toBeEnabled();

      await userEvent.click(syncNowButton);

      await waitFor(() => expect(refreshMockSuccess).toHaveBeenCalledTimes(1));

      expect(indicators.addSuccessMessage).toHaveBeenCalledWith(
        'Repository sync started.'
      );

      // Request Fails
      const refreshMockFail = MockApiClient.addMockResponse({
        url: `/projects/${props.organization.slug}/${props.project.slug}/appstoreconnect/${appStoreConnectRepository.id}/refresh/`,
        method: 'POST',
        statusCode: 429,
      });

      jest.spyOn(indicators, 'addErrorMessage');

      rerender(
        <TestComponent
          {...props}
          organization={props.organization}
          customRepositories={[httpRepository, appStoreConnectRepository]}
        />
      );

      await userEvent.click(screen.getByRole('button', {name: 'Sync Now'}));

      await waitFor(() => expect(refreshMockFail).toHaveBeenCalledTimes(1));

      expect(indicators.addErrorMessage).toHaveBeenCalledWith(
        'Rate limit for refreshing repository exceeded. Try again in a few minutes.'
      );
    });

    it('disabled', async function () {
      const refreshMock = MockApiClient.addMockResponse({
        url: `/projects/${props.organization.slug}/${props.project.slug}/appstoreconnect/${appStoreConnectRepository.id}/refresh/`,
        method: 'POST',
        statusCode: 200,
      });

      render(
        <TestComponent
          {...props}
          organization={props.organization}
          customRepositories={[httpRepository, appStoreConnectRepository]}
          credetialsStatus={{status: 'invalid', code: 'app-connect-authentication-error'}}
        />,
        {context: props.routerContext}
      );

      const syncNowButton = screen.getByRole('button', {name: 'Sync Now'});
      expect(syncNowButton).toBeDisabled();

      await userEvent.hover(syncNowButton);

      expect(
        await screen.findByText(
          'Authentication is required before this repository can sync with App Store Connect.'
        )
      ).toBeInTheDocument();

      await userEvent.click(syncNowButton);

      await waitFor(() => expect(refreshMock).toHaveBeenCalledTimes(0));
    });

    it('does not render', function () {
      render(
        <TestComponent
          {...props}
          organization={props.organization}
          customRepositories={[httpRepository]}
        />,
        {context: props.routerContext}
      );

      expect(screen.queryByRole('button', {name: 'Sync Now'})).not.toBeInTheDocument();
    });
  });

  describe('Update saved store', function () {
    const props = getProps({
      router: {
        ...TestStubs.router(),
        location: {
          ...TestStubs.location(),
          pathname: `/settings/org-slug/projects/project-2/debug-symbols/`,
          query: {
            customRepository: appStoreConnectRepository.id,
          },
        },
        params: {orgId: 'org-slug', projectId: 'project-slug'},
      },
    });

    it('credentials valid for the application', async function () {
      jest.useFakeTimers();
      // Request succeeds
      const updateCredentialsMockSucceeds = MockApiClient.addMockResponse({
        url: `/projects/${props.organization.slug}/${props.project.slug}/appstoreconnect/apps/`,
        method: 'POST',
        statusCode: 200,
        body: {
          apps: [
            {
              appId: appStoreConnectRepository.appId,
              name: appStoreConnectRepository.appName,
              bundleId: appStoreConnectRepository.bundleId,
            },
          ],
        },
      });

      const updateMockSucceeds = MockApiClient.addMockResponse({
        url: `/projects/${props.organization.slug}/${props.project.slug}/appstoreconnect/${appStoreConnectRepository.id}/`,
        method: 'POST',
        statusCode: 200,
      });

      jest.spyOn(indicators, 'addSuccessMessage');

      render(
        <TestComponent
          {...props}
          organization={props.organization}
          customRepositories={[appStoreConnectRepository]}
        />,
        {context: props.routerContext}
      );

      // Display modal content
      expect(
        await screen.findByText('App Store Connect credentials')
      ).toBeInTheDocument();

      await userEvent.click(screen.getByText('Update'), {delay: null});

      await waitFor(() => expect(updateMockSucceeds).toHaveBeenCalledTimes(1));
      expect(updateCredentialsMockSucceeds).toHaveBeenCalledTimes(1);

      expect(indicators.addSuccessMessage).toHaveBeenCalledWith(
        'Successfully updated custom repository'
      );

      act(() => jest.runAllTimers());
      jest.useRealTimers();
    });

    it('credentials not authorized for the application', async function () {
      // Request fails
      const updateCredentialsMockFails = MockApiClient.addMockResponse({
        url: `/projects/${props.organization.slug}/${props.project.slug}/appstoreconnect/apps/`,
        method: 'POST',
        statusCode: 200,
        body: {
          apps: [
            {appId: '8172187', name: 'Release Health', bundleId: 'io.sentry.mobile.app'},
          ],
        },
      });

      jest.spyOn(indicators, 'addErrorMessage');

      render(
        <TestComponent
          {...props}
          organization={props.organization}
          customRepositories={[appStoreConnectRepository]}
        />,
        {context: props.routerContext}
      );

      // Display modal content
      expect(
        await screen.findByText('App Store Connect credentials')
      ).toBeInTheDocument();

      // Type invalid key
      await userEvent.type(
        screen.getByPlaceholderText('(Private Key unchanged)'),
        'invalid key{enter}'
      );

      await userEvent.click(screen.getByText('Update'));

      await waitFor(() => expect(updateCredentialsMockFails).toHaveBeenCalledTimes(1));

      expect(indicators.addErrorMessage).toHaveBeenCalledWith(
        'Credentials not authorized for this application'
      );
    });
  });
});
