import {initializeOrg} from 'sentry-test/initializeOrg';
import {
  render,
  screen,
  userEvent,
  waitForElementToBeRemoved,
  within,
} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import GlobalModal from 'sentry/components/globalModal';
import {OrganizationContext} from 'sentry/views/organizationContext';
import {RouteContext} from 'sentry/views/routeContext';
import ServerSideSampling from 'sentry/views/settings/project/server-side-sampling';
import {SERVER_SIDE_SAMPLING_DOC_LINK} from 'sentry/views/settings/project/server-side-sampling/utils';

describe('Server-side Sampling - Activate Modal', function () {
  const {organization, project, router} = initializeOrg({
    ...initializeOrg(),
    organization: {
      ...initializeOrg().organization,
      features: ['server-side-sampling'],
    },
    projects: [
      TestStubs.Project({
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
    ],
  });

  it('renders modal', async function () {
    render(
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
        <GlobalModal />
        <OrganizationContext.Provider value={organization}>
          <ServerSideSampling project={project} />
        </OrganizationContext.Provider>
      </RouteContext.Provider>
    );

    // Rules Panel Content
    userEvent.click(screen.getByLabelText('Activate Rule'));

    const dialog = await screen.findByRole('dialog');

    // Dialog Header
    expect(screen.getByRole('heading', {name: 'Activate Rule'})).toBeInTheDocument();

    // Dialog Content
    expect(
      screen.getByText(
        textWithMarkupMatcher(
          'Applying server-side sampling without first updating the Sentry SDK versions could sharply decrease the amount of accepted transactions. Resolve now.'
        )
      )
    ).toBeInTheDocument();
    expect(screen.getByRole('checkbox', {name: 'Check to agree'})).not.toBeChecked();
    expect(screen.getByText(/I understand the consequences/)).toBeInTheDocument();

    // Dialog Footer
    expect(within(dialog).getByRole('button', {name: 'Read Docs'})).toHaveAttribute(
      'href',
      SERVER_SIDE_SAMPLING_DOC_LINK
    );
    expect(screen.getByRole('button', {name: 'Cancel'})).toBeEnabled();
    expect(screen.getByRole('button', {name: 'Activate Rule'})).toBeDisabled();

    // Agree with consequences
    userEvent.click(screen.getByRole('checkbox', {name: 'Check to agree'}));
    expect(
      screen.getByRole('checkbox', {name: 'Uncheck to disagree'})
    ).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Activate Rule'})).toBeEnabled();

    // Submit form
    userEvent.click(screen.getByRole('button', {name: 'Activate Rule'}));

    // Dialog should close
    await waitForElementToBeRemoved(() =>
      screen.queryByRole('heading', {name: 'Activate Rule'})
    );
  });
});
