import {IntegrationProviderFixture} from 'sentry-fixture/integrationProvider';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import * as pipelineModal from 'sentry/components/pipeline/modal';
import {AddIntegrationRow} from 'sentry/views/alerts/rules/issue/addIntegrationRow';
import {IntegrationContext} from 'sentry/views/settings/organizationIntegrations/integrationContext';

jest.mock('sentry/actionCreators/modal');

describe('AddIntegrationRow', () => {
  let org: any;
  const provider = IntegrationProviderFixture({key: 'github', slug: 'github'});

  beforeEach(() => {
    org = OrganizationFixture();
    jest.clearAllMocks();
  });

  const getComponent = () => (
    <IntegrationContext
      value={{
        provider,
        type: 'first_party',
        installStatus: 'Not Installed',
        analyticsParams: {
          view: 'onboarding',
          already_installed: false,
        },
      }}
    >
      <AddIntegrationRow onClick={jest.fn()} />
    </IntegrationContext>
  );

  it('renders', async () => {
    render(getComponent(), {organization: org});

    const button = await screen.findByRole('button', {name: /add integration/i});
    expect(button).toBeInTheDocument();
  });

  it('opens the pipeline modal on click', async () => {
    const openPipelineModalSpy = jest
      .spyOn(pipelineModal, 'openPipelineModal')
      .mockImplementation(() => {});

    render(getComponent(), {organization: org});

    const button = await screen.findByRole('button', {name: /add integration/i});
    await userEvent.click(button);

    expect(openPipelineModalSpy).toHaveBeenCalledWith(
      expect.objectContaining({type: 'integration', provider: 'github'})
    );
  });

  it('renders request button when user does not have access', async () => {
    org.access = ['org:read'];

    render(getComponent(), {organization: org});

    await screen.findByRole('button', {name: /request installation/i});
  });
});
