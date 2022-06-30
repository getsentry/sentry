import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import {OrganizationContext} from 'sentry/views/organizationContext';
import {RouteContext} from 'sentry/views/routeContext';
import ServerSideSampling from 'sentry/views/settings/project/server-side-sampling';
import {SERVER_SIDE_SAMPLING_DOC_LINK} from 'sentry/views/settings/project/server-side-sampling/utils';

describe('Server-side Sampling', function () {
  const {organization, project, router} = initializeOrg({
    ...initializeOrg(),
    organization: {
      ...initializeOrg().organization,
      features: ['server-side-sampling'],
    },
  });

  it('renders onboarding promo', async function () {
    MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/',
      method: 'GET',
      body: TestStubs.Project(),
    });

    const {container} = render(
      <RouteContext.Provider
        value={{
          router,
          location: router.location,
          params: {
            orgId: organization.slug,
            projectId: project.slug,
          },
          routes: [],
        }}
      >
        <OrganizationContext.Provider value={organization}>
          <ServerSideSampling />
        </OrganizationContext.Provider>
      </RouteContext.Provider>
    );

    expect(
      screen.getByRole('heading', {name: 'Server-side Sampling'})
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        'Server-side sampling provides an additional dial for dropping transactions. This comes in handy when your server-side sampling rules target the transactions you want to keep, but you need more of those transactions being sent by the SDK.'
      )
    ).toBeInTheDocument();

    expect(
      await screen.findByRole('heading', {name: 'No sampling rules active yet'})
    ).toBeInTheDocument();

    expect(
      screen.getByText('Set up your project for sampling success')
    ).toBeInTheDocument();

    expect(screen.getByRole('button', {name: 'Read Docs'})).toHaveAttribute(
      'href',
      SERVER_SIDE_SAMPLING_DOC_LINK
    );

    expect(screen.getByRole('button', {name: 'Get Started'})).toBeInTheDocument();

    expect(container).toSnapshot();
  });

  it('renders rules panel', async function () {
    MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/',
      method: 'GET',
      body: TestStubs.Project({
        dynamicSampling: {
          rules: [
            {
              sampleRate: 0.2,
              type: 'trace',
              condition: {
                op: 'and',
                inner: [
                  {
                    op: 'glob',
                    name: 'trace.release',
                    value: ['1.2.3'],
                  },
                ],
              },
              id: 40,
            },
          ],
          next_id: 41,
        },
      }),
    });

    const {container} = render(
      <RouteContext.Provider
        value={{
          router,
          location: router.location,
          params: {
            orgId: organization.slug,
            projectId: project.slug,
          },
          routes: [],
        }}
      >
        <OrganizationContext.Provider value={organization}>
          <ServerSideSampling />
        </OrganizationContext.Provider>
      </RouteContext.Provider>
    );

    // Rule Panel Header
    expect(await screen.findByText('Operator')).toBeInTheDocument();
    expect(screen.getByText('Condition')).toBeInTheDocument();
    expect(screen.getByText('Rate')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();

    // Rule Panel Content
    expect(screen.getAllByTestId('sampling-rule').length).toBe(1);
    expect(screen.queryByLabelText('Drag Rule')).not.toBeInTheDocument();
    expect(screen.getByTestId('sampling-rule')).toHaveTextContent('If');
    expect(screen.getByTestId('sampling-rule')).toHaveTextContent('Release');
    expect(screen.getByTestId('sampling-rule')).toHaveTextContent('1.2.3');
    expect(screen.getByTestId('sampling-rule')).toHaveTextContent('20%');
    expect(screen.getByLabelText('Activate Rule')).toBeInTheDocument();
    expect(screen.getByLabelText('Actions')).toBeInTheDocument();

    // Rule Panel Footer
    expect(screen.getByText('Add Rule')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Read Docs'})).toHaveAttribute(
      'href',
      SERVER_SIDE_SAMPLING_DOC_LINK
    );

    expect(container).toSnapshot();
  });
});
