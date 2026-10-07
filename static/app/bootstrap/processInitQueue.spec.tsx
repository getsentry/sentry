// We don't want to render with any of our existing providers since this will
// mirror what is actually happening when the initQueue is processed.
//
// eslint-disable-next-line no-restricted-imports
import {render} from '@testing-library/react';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {TeamFixture} from 'sentry-fixture/team';

import {act, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {processInitQueue} from 'sentry/bootstrap/processInitQueue';
import {SentryInitRenderReactComponent} from 'sentry/types/system';

describe('processInitQueue', () => {
  describe('renderReact', () => {
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

      MockApiClient.addMockResponse({
        url: '/organizations/organization-1/teams/',
        body: [TeamFixture({id: '1', slug: 'team-1', name: 'Team 1'})],
      });

      render(<div id="setup-wizard-container" />);
      processInitQueue();

      await waitFor(
        () => {
          expect(screen.getByText('Select your Sentry project')).toBeInTheDocument();
        },
        {timeout: 5000}
      );
    });

    it('renders WebAuthn Assert', async () => {
      window.__onSentryInit = [
        {
          component: SentryInitRenderReactComponent.WEB_AUTHN_ASSSERT,
          container: '#webauthn-container',
          name: 'renderReact',
          props: {
            mode: 'signin',
          },
        },
      ];

      render(<div id="webauthn-container" />);
      processInitQueue();

      // WebAuthn is not supported in the test environment
      expect(
        await screen.findByText(/Your browser does not support WebAuthn/)
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

  it('renders components queued before and after initialization', async () => {
    const init = {
      component: SentryInitRenderReactComponent.WEB_AUTHN_ASSSERT,
      container: '#first-webauthn-container',
      name: 'renderReact',
      props: {mode: 'signin'},
    } as const;

    render(
      <div>
        <div id="first-webauthn-container" />
        <div id="second-webauthn-container" />
      </div>
    );
    window.__onSentryInit = [init];

    await act(() => processInitQueue());
    expect(
      await screen.findByText(/Your browser does not support WebAuthn/)
    ).toBeInTheDocument();

    await processInitQueue();
    act(() => {
      window.__onSentryInit.push({
        ...init,
        container: '#second-webauthn-container',
      });
    });

    await waitFor(() => {
      expect(screen.getAllByText(/Your browser does not support WebAuthn/)).toHaveLength(
        2
      );
    });
  });
});
