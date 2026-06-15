import {IntegrationProviderFixture} from 'sentry-fixture/integrationProvider';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import * as pipelineModal from 'sentry/components/pipeline/modal';
import {AddIntegrationButton} from 'sentry/views/settings/organizationIntegrations/addIntegrationButton';

describe('AddIntegrationButton', () => {
  const provider = IntegrationProviderFixture();

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('opens the pipeline modal on click', async () => {
    const openPipelineModalSpy = jest
      .spyOn(pipelineModal, 'openPipelineModal')
      .mockImplementation(() => {});

    render(
      <AddIntegrationButton
        provider={provider}
        onAddIntegration={jest.fn()}
        organization={OrganizationFixture()}
      />
    );

    await userEvent.click(screen.getByLabelText('Add integration'));

    expect(openPipelineModalSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'integration',
        provider: provider.key,
        onComplete: expect.any(Function),
      })
    );
  });
});
