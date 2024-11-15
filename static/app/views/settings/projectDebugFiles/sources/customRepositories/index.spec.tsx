import {Fragment} from 'react';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import GlobalModal from 'sentry/components/globalModal';
import {DEBUG_SOURCE_TYPES} from 'sentry/data/debugFileSources';
import ModalStore from 'sentry/stores/modalStore';
import type {CustomRepo, CustomRepoHttp} from 'sentry/types/debugFiles';
import {CustomRepoType} from 'sentry/types/debugFiles';
import CustomRepositories from 'sentry/views/settings/projectDebugFiles/sources/customRepositories';

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
  const {organization, router, project} = initializeOrg({
    router: props?.router,
  });

  return {
    api: new MockApiClient(),
    organization,
    project,
    router,
    isLoading: false,
    location: router.location,
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

  beforeEach(() => {
    ModalStore.reset();
  });

  beforeAll(async function () {
    // TODO: figure out why this transpile is so slow
    // transpile the modal upfront so the test runs fast
    await import('sentry/components/modals/debugFileCustomRepository');
  });

  it('renders with custom-symbol-sources feature enabled', async function () {
    const props = getProps();
    const newOrganization = {...props.organization, features: ['custom-symbol-sources']};

    const {rerender} = render(
      <TestComponent {...props} organization={newOrganization} />,
      {router: props.router}
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
});
