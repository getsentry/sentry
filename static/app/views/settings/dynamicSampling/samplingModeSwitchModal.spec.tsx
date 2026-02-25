import {OrganizationFixture} from 'sentry-fixture/organization';

import {
  act,
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

import {openSamplingModeSwitchModal} from 'sentry/views/settings/dynamicSampling/samplingModeSwitchModal';

describe('SamplingModeSwitchModal', () => {
  const organization = OrganizationFixture({slug: 'org-slug'});

  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  function openModal(props: Parameters<typeof openSamplingModeSwitchModal>[0]) {
    act(() => openSamplingModeSwitchModal(props));
  }

  describe('samplingMode: organization (Deactivate Advanced Mode)', () => {
    it('renders the title and pre-fills the target rate input', async () => {
      renderGlobalModal({organization});
      openModal({samplingMode: 'organization', initialTargetRate: 0.5});

      expect(await screen.findByText('Deactivate Advanced Mode')).toBeInTheDocument();
      expect(
        screen.getByRole('spinbutton', {name: 'Global Target Sample Rate'})
      ).toHaveValue(50);
    });

    it('does not call the API when submitting with an out-of-range value', async () => {
      const putMock = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/',
        method: 'PUT',
        body: OrganizationFixture(),
      });

      renderGlobalModal({organization});
      openModal({samplingMode: 'organization', initialTargetRate: 0.5});

      await screen.findByText('Deactivate Advanced Mode');
      const input = screen.getByRole('spinbutton', {name: 'Global Target Sample Rate'});

      // Type an out-of-range value and submit — Zod validation should block the API call
      await userEvent.clear(input);
      await userEvent.type(input, '150');
      await userEvent.click(screen.getByRole('button', {name: 'Deactivate'}));

      // Modal should remain open and API should not have been called
      await waitFor(() => {
        expect(screen.getByText('Deactivate Advanced Mode')).toBeInTheDocument();
      });
      expect(putMock).not.toHaveBeenCalled();
    });

    it('submits samplingMode and targetSampleRate to the API', async () => {
      const putMock = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/',
        method: 'PUT',
        body: OrganizationFixture({samplingMode: 'organization', targetSampleRate: 0.3}),
      });

      renderGlobalModal({organization});
      openModal({samplingMode: 'organization', initialTargetRate: 0.5});

      await screen.findByText('Deactivate Advanced Mode');
      const input = screen.getByRole('spinbutton', {name: 'Global Target Sample Rate'});

      await userEvent.clear(input);
      await userEvent.type(input, '30');

      await userEvent.click(screen.getByRole('button', {name: 'Deactivate'}));

      await waitFor(() => {
        expect(putMock).toHaveBeenCalledWith(
          '/organizations/org-slug/',
          expect.objectContaining({
            data: {samplingMode: 'organization', targetSampleRate: 0.3},
          })
        );
      });
    });

    it('closes the modal on successful submit', async () => {
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/',
        method: 'PUT',
        body: OrganizationFixture({samplingMode: 'organization'}),
      });

      renderGlobalModal({organization});
      openModal({samplingMode: 'organization', initialTargetRate: 0.5});

      await screen.findByText('Deactivate Advanced Mode');
      await userEvent.click(screen.getByRole('button', {name: 'Deactivate'}));

      await waitFor(() => {
        expect(screen.queryByText('Deactivate Advanced Mode')).not.toBeInTheDocument();
      });
    });

    it('keeps the modal open when the API returns an error', async () => {
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/',
        method: 'PUT',
        statusCode: 500,
        body: {detail: 'Internal Server Error'},
      });

      renderGlobalModal({organization});
      openModal({samplingMode: 'organization', initialTargetRate: 0.5});

      await screen.findByText('Deactivate Advanced Mode');
      await userEvent.click(screen.getByRole('button', {name: 'Deactivate'}));

      await waitFor(() => {
        expect(screen.getByText('Deactivate Advanced Mode')).toBeInTheDocument();
      });
    });

    it('closes the modal when Cancel is clicked without submitting', async () => {
      const putMock = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/',
        method: 'PUT',
        body: OrganizationFixture(),
      });

      renderGlobalModal({organization});
      openModal({samplingMode: 'organization', initialTargetRate: 0.5});

      await screen.findByText('Deactivate Advanced Mode');
      await userEvent.click(screen.getByRole('button', {name: 'Cancel'}));

      await waitFor(() => {
        expect(screen.queryByText('Deactivate Advanced Mode')).not.toBeInTheDocument();
      });
      expect(putMock).not.toHaveBeenCalled();
    });
  });

  describe('samplingMode: project (Activate Advanced Mode)', () => {
    it('renders the title and does not show the target rate input', async () => {
      renderGlobalModal({organization});
      openModal({samplingMode: 'project'});

      expect(await screen.findByText('Activate Advanced Mode')).toBeInTheDocument();
      expect(
        screen.queryByRole('spinbutton', {name: 'Global Target Sample Rate'})
      ).not.toBeInTheDocument();
    });

    it('submits only samplingMode without targetSampleRate', async () => {
      const putMock = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/',
        method: 'PUT',
        body: OrganizationFixture({samplingMode: 'project'}),
      });

      renderGlobalModal({organization});
      openModal({samplingMode: 'project'});

      await screen.findByText('Activate Advanced Mode');
      await userEvent.click(screen.getByRole('button', {name: 'Activate'}));

      await waitFor(() => {
        expect(putMock).toHaveBeenCalledWith(
          '/organizations/org-slug/',
          expect.objectContaining({
            data: {samplingMode: 'project'},
          })
        );
      });
      expect(putMock).not.toHaveBeenCalledWith(
        '/organizations/org-slug/',
        expect.objectContaining({
          data: expect.objectContaining({targetSampleRate: expect.anything()}),
        })
      );
    });

    it('closes the modal on successful submit', async () => {
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/',
        method: 'PUT',
        body: OrganizationFixture({samplingMode: 'project'}),
      });

      renderGlobalModal({organization});
      openModal({samplingMode: 'project'});

      await screen.findByText('Activate Advanced Mode');
      await userEvent.click(screen.getByRole('button', {name: 'Activate'}));

      await waitFor(() => {
        expect(screen.queryByText('Activate Advanced Mode')).not.toBeInTheDocument();
      });
    });

    it('keeps the modal open when the API returns an error', async () => {
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/',
        method: 'PUT',
        statusCode: 500,
        body: {detail: 'Internal Server Error'},
      });

      renderGlobalModal({organization});
      openModal({samplingMode: 'project'});

      await screen.findByText('Activate Advanced Mode');
      await userEvent.click(screen.getByRole('button', {name: 'Activate'}));

      await waitFor(() => {
        expect(screen.getByText('Activate Advanced Mode')).toBeInTheDocument();
      });
    });

    it('closes the modal when Cancel is clicked without submitting', async () => {
      const putMock = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/',
        method: 'PUT',
        body: OrganizationFixture(),
      });

      renderGlobalModal({organization});
      openModal({samplingMode: 'project'});

      await screen.findByText('Activate Advanced Mode');
      await userEvent.click(screen.getByRole('button', {name: 'Cancel'}));

      await waitFor(() => {
        expect(screen.queryByText('Activate Advanced Mode')).not.toBeInTheDocument();
      });
      expect(putMock).not.toHaveBeenCalled();
    });
  });
});
