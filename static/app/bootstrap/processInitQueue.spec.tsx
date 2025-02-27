import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {TeamFixture} from 'sentry-fixture/team';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {processInitQueue} from 'sentry/bootstrap/processInitQueue';
import AlertStore from 'sentry/stores/alertStore';
import IndicatorStore from 'sentry/stores/indicatorStore';
import {SentryInitRenderReactComponent} from 'sentry/types/system';

describe('processInitQueue', function () {
  describe('renderReact', function () {
    it('renders password strength input', async () => {
      window.__onSentryInit = [
        {
          name: 'passwordStrength',
          input: '#password',
          element: '#password-strength',
        },
      ];

      render(
        <div>
          <input id="password" placeholder="password" />
          <div id="password-strength" />
        </div>
      );

      processInitQueue();

      // Assert that password strength renders and reacts to user input
      await userEvent.type(screen.getByPlaceholderText('password'), '!');
      expect(await screen.findByText('Very Weak')).toBeInTheDocument();

      // Type the rest of the password
      await userEvent.type(
        screen.getByPlaceholderText('password'),
        '!!!!!supersecretpassword!!!!!!'
      );
      expect(await screen.findByText('Very Strong')).toBeInTheDocument();
    });

    it('renders indicators', async () => {
      window.__onSentryInit = [
        {
          component: SentryInitRenderReactComponent.INDICATORS,
          container: '#indicator-container',
          name: 'renderReact',
        },
      ];

      IndicatorStore.add('Indicator Alert', 'success');

      render(<div id="indicator-container" />);
      processInitQueue();
      expect(await screen.findByText('Indicator Alert')).toBeInTheDocument();
    });
    it('renders system alerts', async () => {
      window.__onSentryInit = [
        {
          component: SentryInitRenderReactComponent.SYSTEM_ALERTS,
          container: '#system-alerts-container',
          name: 'renderReact',
        },
      ];

      AlertStore.addAlert({
        message: 'System Alert',
        type: 'success',
      });

      render(<div id="system-alerts-container" />);
      processInitQueue();
      expect(await screen.findByText('System Alert')).toBeInTheDocument();
    });
    it('renders setup wizard', async () => {
      window.__onSentryInit = [
        {
          component: SentryInitRenderReactComponent.SETUP_WIZARD,
          container: '#setup-wizard-container',
          name: 'renderReact',
          props: {
            enableProjectSelection: true,
            hash: '1',
          },
        },
      ];

      MockApiClient.addMockResponse({
        url: '/organizations/',
        body: [
          OrganizationFixture({
            id: '1',
            slug: 'organization-1',
            name: 'Organization 1',
            access: [],
            features: [],
          }),
        ],
      });

      MockApiClient.addMockResponse({
        url: '/organizations/organization-1/',
        body: OrganizationFixture({
          id: '1',
          slug: 'organization-1',
          name: 'Organization 1',
          features: [],
          access: [],
        }),
      });

      MockApiClient.addMockResponse({
        url: '/organizations/organization-1/projects/',
        body: [
          ProjectFixture({
            id: '1',
            slug: 'project-1',
            name: 'Project 1',
          }),
        ],
      });

      MockApiClient.addMockResponse({
        url: '/organizations/organization-1/user-teams/',
        body: [TeamFixture({id: '1', slug: 'team-1', name: 'Team 1'})],
      });

      render(<div id="setup-wizard-container" />);
      processInitQueue();

      expect(await screen.findByText('Select your Sentry project')).toBeInTheDocument();
    });
    it('renders u2f sign', async () => {
      window.__onSentryInit = [
        {
          component: SentryInitRenderReactComponent.U2F_SIGN,
          container: '#u2f-sign-container',
          name: 'renderReact',
          props: {
            displayMode: 'signin',
          },
        },
      ];

      render(<div id="u2f-sign-container" />);
      processInitQueue();

      // U2F is not supported in the test environment
      expect(
        await screen.findByText(/Unfortunately your browser does not support U2F/)
      ).toBeInTheDocument();
    });

    it('renders superuser staff access form', async () => {
      window.__onSentryInit = [
        {
          component: SentryInitRenderReactComponent.SU_STAFF_ACCESS_FORM,
          container: '#su-staff-access-form-container',
          name: 'renderReact',
        },
      ];

      const authenticatorsResponse = MockApiClient.addMockResponse({
        url: '/authenticators/',
        body: [],
      });

      render(<div id="su-staff-access-form-container" />);
      processInitQueue();

      await waitFor(() => {
        expect(authenticatorsResponse).toHaveBeenCalled();
      });
      expect(await screen.findByText('COPS/CSM')).toBeInTheDocument();
    });
  });

  it('processes queued up items', function () {
    const mock = jest.fn();
    const init = {
      name: 'onReady',
      onReady: mock,
    } as const;

    window.__onSentryInit = [init];

    processInitQueue();
    expect(mock).toHaveBeenCalledTimes(1);

    processInitQueue();
    expect(mock).toHaveBeenCalledTimes(1);

    window.__onSentryInit.push(init);
    expect(mock).toHaveBeenCalledTimes(2);
  });

  it('is called after `processInitQueue` has already run', function () {
    processInitQueue();
    const mock = jest.fn();
    const init = {
      name: 'onReady',
      onReady: mock,
    } as const;

    window.__onSentryInit.push(init);
    expect(mock).toHaveBeenCalledTimes(1);

    processInitQueue();
    expect(mock).toHaveBeenCalledTimes(1);
  });
});
