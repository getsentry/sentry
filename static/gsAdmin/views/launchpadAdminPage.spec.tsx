import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';

import {ConfigStore} from 'sentry/stores/configStore';
import {ModalStore} from 'sentry/stores/modalStore';

import {LaunchpadAdminPage} from 'admin/views/launchpadAdminPage';

describe('LaunchpadAdminPage', () => {
  const writeText = jest.fn().mockResolvedValue('');

  beforeEach(() => {
    ConfigStore.set('localities', [{name: 'us', url: 'https://us.test'}]);
    ModalStore.reset();
    MockApiClient.clearMockResponses();
    jest.clearAllMocks();
    Object.assign(navigator, {clipboard: {writeText}});
  });

  it('confirms before rerunning analyses', async () => {
    const rerunRequest = MockApiClient.addMockResponse({
      url: '/internal/preprod-artifact/batch-rerun-analysis/',
      method: 'POST',
      body: {results: []},
    });

    render(<LaunchpadAdminPage />);

    const rerunForm = screen
      .getByRole('heading', {name: 'Batch Rerun Analyses'})
      .closest('form');
    expect(rerunForm).not.toBeNull();

    await userEvent.type(within(rerunForm!).getByRole('textbox'), '123, 456');
    await userEvent.click(
      within(rerunForm!).getByRole('button', {name: 'Rerun Analysis'})
    );
    renderGlobalModal();

    expect(rerunRequest).not.toHaveBeenCalled();

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveTextContent('Rerun analyses for 2 artifacts?');
    expect(dialog).toHaveTextContent('Artifact IDs: 123, 456');
    expect(dialog).toHaveTextContent('Region: us');
    await userEvent.click(within(dialog).getByRole('button', {name: 'Rerun Analyses'}));

    await waitFor(() => {
      expect(rerunRequest).toHaveBeenCalledWith(
        '/internal/preprod-artifact/batch-rerun-analysis/',
        expect.objectContaining({
          method: 'POST',
          data: {artifact_ids: ['123', '456']},
          host: 'https://us.test',
        })
      );
    });
  });

  it('copies fetched artifact information as formatted JSON', async () => {
    const artifactInfo = {success: true, artifact_info: {id: 123, state: 1}};
    MockApiClient.addMockResponse({
      url: '/internal/preprod-artifact/123/info/',
      body: artifactInfo,
    });

    render(<LaunchpadAdminPage />);

    const fetchForm = screen
      .getByRole('heading', {name: 'Fetch Artifact Info'})
      .closest('form');
    expect(fetchForm).not.toBeNull();

    await userEvent.type(within(fetchForm!).getByRole('textbox'), '123');
    await userEvent.click(within(fetchForm!).getByRole('button', {name: 'Fetch Info'}));

    expect(
      await screen.findByRole('heading', {name: 'Fetched Artifact Information'})
    ).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole('button', {name: 'Copy artifact information'})
    );

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith(JSON.stringify(artifactInfo, null, 2));
    });
  });
});
