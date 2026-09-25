import {IntegrationProviderFixture} from 'sentry-fixture/integrationProvider';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {act, render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

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

  it('keeps the button focusable with a tooltip when the provider cannot be added', async () => {
    const openPipelineModalSpy = jest
      .spyOn(pipelineModal, 'openPipelineModal')
      .mockImplementation(() => {});

    render(
      <AddIntegrationButton
        provider={{...provider, canAdd: false}}
        onAddIntegration={jest.fn()}
        organization={OrganizationFixture()}
      />
    );

    const button = screen.getByRole('button', {name: 'Add integration'});
    expect(button).toHaveAttribute('aria-disabled', 'true');

    act(() => button.focus());
    expect(
      await screen.findByText(
        `Integration cannot be added on Sentry. Enable this integration via the ${provider.name} instance.`
      )
    ).toBeInTheDocument();

    await userEvent.click(button);
    expect(openPipelineModalSpy).not.toHaveBeenCalled();
  });
});
