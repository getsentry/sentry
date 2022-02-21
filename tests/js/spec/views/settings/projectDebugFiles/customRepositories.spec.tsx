import {initializeOrg} from 'sentry-test/initializeOrg';
import {mountGlobalModal} from 'sentry-test/modal';
import {
  mountWithTheme,
  screen,
  userEvent,
  waitForElementToBeRemoved,
} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import AppStoreConnectContext from 'sentry/components/projects/appStoreConnectContext';
import {DEBUG_SOURCE_TYPES} from 'sentry/data/debugFileSources';
import {
  CustomRepo,
  CustomRepoAppStoreConnect,
  CustomRepoHttp,
  CustomRepoType,
} from 'sentry/types/debugFiles';
import CustomRepositories from 'sentry/views/settings/projectDebugFiles/sources/customRepositories';

function TestComponent({
  organization,
  customRepositories,
  ...props
}: Omit<React.ComponentProps<typeof CustomRepositories>, 'customRepositories'> & {
  customRepositories?: [CustomRepoHttp, CustomRepoAppStoreConnect];
}) {
  return (
    <AppStoreConnectContext.Provider
      value={
        customRepositories?.[1]
          ? {
              [customRepositories[1].id]: {
                credentials: {status: 'valid'},
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
      <CustomRepositories
        {...props}
        organization={organization}
        customRepositories={customRepositories ?? []}
      />
    </AppStoreConnectContext.Provider>
  );
}

describe('Custom Repositories', function () {
  const api = new MockApiClient();
  const {project, organization, router, routerContext} = initializeOrg();

  const props = {
    api,
    organization,
    project,
    router,
    projSlug: project.slug,
    isLoading: false,
    location: router.location,
  };

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

  beforeEach(async function () {
    await mountGlobalModal(routerContext);
  });

  it('renders', async function () {
    const {rerender} = mountWithTheme(<TestComponent {...props} />);

    // Section title
    expect(screen.getByText('Custom Repositories')).toBeInTheDocument();

    // Enabled button
    expect(screen.getByText('Add Repository').closest('button')).toBeEnabled();

    // Content
    expect(screen.getByText('No custom repositories configured')).toBeInTheDocument();

    // Choose an App Store Connect source
    userEvent.click(screen.getByText('Add Repository'));

    userEvent.click(screen.getByText('App Store Connect'));

    // Display modal content
    // A single instance of App Store Connect is available on free plans
    expect(await screen.findByText('App Store Connect credentials')).toBeInTheDocument();

    // Close Modal
    userEvent.click(screen.getByLabelText('Close Modal'));

    // Choose another source
    userEvent.click(screen.getByText('Add Repository'));

    userEvent.click(screen.getByText('Amazon S3'));

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
    userEvent.click(screen.getByLabelText('Close Modal'));

    await waitForElementToBeRemoved(() =>
      screen.queryByText('This feature is not enabled on your Sentry installation.')
    );

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
    userEvent.click(screen.getByText('Add Repository'));

    userEvent.click(screen.getByRole('button', {name: 'App Store Connect'}));

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
    const newOrganization = {...organization, features: ['custom-symbol-sources']};

    const {rerender} = mountWithTheme(
      <TestComponent {...props} organization={newOrganization} />
    );

    // Section title
    expect(screen.getByText('Custom Repositories')).toBeInTheDocument();

    // Enabled button
    expect(screen.getByText('Add Repository').closest('button')).toBeEnabled();

    // Content
    expect(screen.getByText('No custom repositories configured')).toBeInTheDocument();

    // Choose a source
    userEvent.click(screen.getByText('Add Repository'));

    userEvent.click(screen.getByText('Amazon S3'));

    // Display modal content
    expect(
      await screen.findByText(textWithMarkupMatcher('Add Amazon S3 Repository'))
    ).toBeInTheDocument();

    // Close Modal
    userEvent.click(screen.getByLabelText('Close Modal'));

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
    const newOrganization = {...organization, features: ['app-store-connect-multiple']};

    mountWithTheme(
      <TestComponent
        {...props}
        organization={newOrganization}
        customRepositories={[httpRepository, appStoreConnectRepository]}
      />
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

    userEvent.click(screen.getByText('Add Repository'));

    userEvent.click(screen.getByRole('button', {name: 'App Store Connect'}));

    // Display modal content
    // A new App Store Connect instance is available
    expect(await screen.findByText('App Store Connect credentials')).toBeInTheDocument();
  });

  it('renders with custom-symbol-sources and app-store-connect-multiple features enabled', async function () {
    const newOrganization = {
      ...organization,
      features: ['custom-symbol-sources', 'app-store-connect-multiple'],
    };

    mountWithTheme(
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
});
