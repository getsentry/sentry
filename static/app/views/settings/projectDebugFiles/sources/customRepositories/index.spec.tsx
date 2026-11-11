import {Fragment} from 'react';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import {GlobalModal} from '@sentry/scraps/modal';

import {DEBUG_SOURCE_TYPES} from 'sentry/data/debugFileSources';
import type {CustomRepo, CustomRepoHttp} from 'sentry/types/debugFiles';
import {CustomRepoType} from 'sentry/types/debugFiles';
import {CustomRepositories} from 'sentry/views/settings/projectDebugFiles/sources/customRepositories';

function TestComponent({
  organization,
  customRepositories,
  ...props
}: Omit<React.ComponentProps<typeof CustomRepositories>, 'customRepositories'> & {
  customRepositories?: [CustomRepoHttp];
}) {
  return (
    <Fragment>
      <GlobalModal />
      <CustomRepositories
        {...props}
        organization={organization}
        customRepositories={customRepositories ?? []}
      />
    </Fragment>
  );
}

function getProps(props?: Parameters<typeof initializeOrg>[0]) {
  const {organization, project} = initializeOrg({
    router: props?.router,
  });

  return {organization, project};
}

describe('Custom Repositories', () => {
  const httpRepository: CustomRepo = {
    id: '7ebdb871-eb65-0183-8001-ea7df90613a7',
    layout: {type: 'native', casing: 'default'},
    name: 'New Repo',
    password: {'hidden-secret': true},
    type: CustomRepoType.HTTP,
    url: 'https://msdl.microsoft.com/download/symbols/',
    username: 'admin',
  };

  beforeAll(async () => {
    // TODO: figure out why this transpile is so slow
    // transpile the modal upfront so the test runs fast
    await import('sentry/components/modals/debugFileCustomRepository');
  });

  it('renders with custom-symbol-sources feature enabled', async () => {
    const props = getProps();
    const newOrganization = {...props.organization, features: ['custom-symbol-sources']};

    const {rerender} = render(
      <TestComponent {...props} organization={newOrganization} />
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
        customRepositories={[httpRepository]}
      />
    );

    // Content
    const actions = screen.queryAllByLabelText('Actions');
    expect(actions).toHaveLength(1);

    // HTTP Repository
    expect(screen.getByText(httpRepository.name)).toBeInTheDocument();
    expect(screen.getByText(DEBUG_SOURCE_TYPES.http)).toBeInTheDocument();
    expect(actions[0]).toBeEnabled();
  });

  it('opens the repository in the URL and removes it from the URL when the modal closes', async () => {
    const props = getProps();
    const newOrganization = {...props.organization, features: ['custom-symbol-sources']};

    const {router} = render(
      <TestComponent
        {...props}
        organization={newOrganization}
        customRepositories={[httpRepository]}
      />,
      {
        initialRouterConfig: {
          location: {
            pathname: '/settings/org-slug/projects/project-slug/debug-symbols/',
            query: {customRepository: httpRepository.id, query: 'abc'},
          },
        },
      }
    );

    expect(
      await screen.findByText(
        textWithMarkupMatcher(`Update ${DEBUG_SOURCE_TYPES.http} Repository`)
      )
    ).toBeInTheDocument();
    await userEvent.click(screen.getByLabelText('Close Modal'));

    await waitFor(() => expect(router.location.query).toEqual({query: 'abc'}));
  });
});
