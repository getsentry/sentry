import {OrganizationFixture} from 'sentry-fixture/organization';

import {MetricHistoryFixture} from 'getsentry-test/fixtures/metricHistory';
import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';
import {
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

import openUpdateRetentionSettingsModal from 'admin/components/customers/updateRetentionSettingsModal';

describe('UpdateRetentionSettingsModal', () => {
  const onSuccess = jest.fn();
  const organization = OrganizationFixture();

  function getSpinbutton(name: string) {
    return screen.getByRole('spinbutton', {name});
  }

  async function loadModal() {
    renderGlobalModal();
    expect(await screen.findByText('Update Retention Settings')).toBeInTheDocument();
  }

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    jest.clearAllMocks();
  });

  it('prefills the form with existing retention values', async () => {
    const subscription = SubscriptionFixture({
      organization,
      categories: {
        spans: MetricHistoryFixture({
          retention: {
            standard: 90,
            downsampled: 30,
          },
        }),
        logBytes: MetricHistoryFixture({
          retention: {
            standard: 45,
            downsampled: 15,
          },
        }),
      },
    });

    openUpdateRetentionSettingsModal({
      subscription,
      organization,
      onSuccess,
    });

    await loadModal();

    expect(getSpinbutton('Spans Standard')).toHaveValue(90);
    expect(getSpinbutton('Spans Downsampled')).toHaveValue(30);
    expect(getSpinbutton('Logs Standard')).toHaveValue(45);
    expect(getSpinbutton('Logs Downsampled')).toHaveValue(15);

    expect(screen.getByRole('button', {name: 'Cancel'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Update Settings'})).toBeInTheDocument();
  });

  it('handles null retention values', async () => {
    const subscription = SubscriptionFixture({
      organization,
      categories: {
        spans: MetricHistoryFixture({
          retention: {
            standard: 90,
            downsampled: null,
          },
        }),
        logBytes: MetricHistoryFixture({
          retention: {
            standard: 30,
            downsampled: null,
          },
        }),
      },
    });

    openUpdateRetentionSettingsModal({
      subscription,
      organization,
      onSuccess,
    });

    await loadModal();

    expect(getSpinbutton('Spans Standard')).toHaveValue(90);
    expect(getSpinbutton('Spans Downsampled')).toHaveValue(null);
    expect(getSpinbutton('Logs Standard')).toHaveValue(30);
    expect(getSpinbutton('Logs Downsampled')).toHaveValue(null);
  });

  it('calls api with correct data when updating all fields', async () => {
    const subscription = SubscriptionFixture({
      organization,
      categories: {
        spans: MetricHistoryFixture({
          retention: {
            standard: 90,
            downsampled: 30,
          },
        }),
        logBytes: MetricHistoryFixture({
          retention: {
            standard: 30,
            downsampled: 7,
          },
        }),
      },
    });

    const updateMock = MockApiClient.addMockResponse({
      url: `/_admin/${organization.slug}/retention-settings/`,
      method: 'POST',
      body: {},
    });

    openUpdateRetentionSettingsModal({
      subscription,
      organization,
      onSuccess,
    });

    await loadModal();

    await userEvent.clear(getSpinbutton('Spans Standard'));
    await userEvent.type(getSpinbutton('Spans Standard'), '120');

    await userEvent.clear(getSpinbutton('Spans Downsampled'));
    await userEvent.type(getSpinbutton('Spans Downsampled'), '60');

    await userEvent.clear(getSpinbutton('Logs Standard'));
    await userEvent.type(getSpinbutton('Logs Standard'), '60');

    await userEvent.clear(getSpinbutton('Logs Downsampled'));
    await userEvent.type(getSpinbutton('Logs Downsampled'), '14');

    await userEvent.click(screen.getByRole('button', {name: 'Update Settings'}));

    await waitFor(() => {
      expect(updateMock).toHaveBeenCalledWith(
        `/_admin/${organization.slug}/retention-settings/`,
        expect.objectContaining({
          method: 'POST',
          data: {
            retentions: {
              spans: {
                standard: 120,
                downsampled: 60,
              },
              logBytes: {
                standard: 60,
                downsampled: 14,
              },
            },
          },
        })
      );
    });

    expect(onSuccess).toHaveBeenCalled();
  });

  it('calls api with null downsampled values when fields are empty', async () => {
    const subscription = SubscriptionFixture({
      organization,
      categories: {
        spans: MetricHistoryFixture({
          retention: {
            standard: 90,
            downsampled: 30,
          },
        }),
        logBytes: MetricHistoryFixture({
          retention: {
            standard: 30,
            downsampled: 7,
          },
        }),
      },
    });

    const updateMock = MockApiClient.addMockResponse({
      url: `/_admin/${organization.slug}/retention-settings/`,
      method: 'POST',
      body: {},
    });

    openUpdateRetentionSettingsModal({
      subscription,
      organization,
      onSuccess,
    });

    await loadModal();

    await userEvent.clear(getSpinbutton('Spans Standard'));
    await userEvent.type(getSpinbutton('Spans Standard'), '90');

    await userEvent.clear(getSpinbutton('Spans Downsampled'));

    await userEvent.clear(getSpinbutton('Logs Standard'));
    await userEvent.type(getSpinbutton('Logs Standard'), '30');

    await userEvent.clear(getSpinbutton('Logs Downsampled'));

    await userEvent.click(screen.getByRole('button', {name: 'Update Settings'}));

    await waitFor(() => {
      expect(updateMock).toHaveBeenCalledWith(
        `/_admin/${organization.slug}/retention-settings/`,
        expect.objectContaining({
          method: 'POST',
          data: {
            retentions: {
              spans: {
                standard: 90,
                downsampled: null,
              },
              logBytes: {
                standard: 30,
                downsampled: null,
              },
            },
          },
        })
      );
    });

    expect(onSuccess).toHaveBeenCalled();
  });

  it('calls api with zero for downsampled values when set to 0', async () => {
    const subscription = SubscriptionFixture({
      organization,
      categories: {
        spans: MetricHistoryFixture({
          retention: {
            standard: 90,
            downsampled: 30,
          },
        }),
        logBytes: MetricHistoryFixture({
          retention: {
            standard: 30,
            downsampled: 7,
          },
        }),
      },
    });

    const updateMock = MockApiClient.addMockResponse({
      url: `/_admin/${organization.slug}/retention-settings/`,
      method: 'POST',
      body: {},
    });

    openUpdateRetentionSettingsModal({
      subscription,
      organization,
      onSuccess,
    });

    await loadModal();

    await userEvent.clear(getSpinbutton('Spans Standard'));
    await userEvent.type(getSpinbutton('Spans Standard'), '90');

    await userEvent.clear(getSpinbutton('Spans Downsampled'));
    await userEvent.type(getSpinbutton('Spans Downsampled'), '0');

    await userEvent.clear(getSpinbutton('Logs Standard'));
    await userEvent.type(getSpinbutton('Logs Standard'), '30');

    await userEvent.clear(getSpinbutton('Logs Downsampled'));
    await userEvent.type(getSpinbutton('Logs Downsampled'), '0');

    await userEvent.click(screen.getByRole('button', {name: 'Update Settings'}));

    await waitFor(() => {
      expect(updateMock).toHaveBeenCalledWith(
        `/_admin/${organization.slug}/retention-settings/`,
        expect.objectContaining({
          method: 'POST',
          data: {
            retentions: {
              spans: {
                standard: 90,
                downsampled: 0,
              },
              logBytes: {
                standard: 30,
                downsampled: 0,
              },
            },
          },
        })
      );
    });

    expect(onSuccess).toHaveBeenCalled();
  });

  it('updates only spans retention', async () => {
    const subscription = SubscriptionFixture({
      organization,
      categories: {
        spans: MetricHistoryFixture({
          retention: {
            standard: 90,
            downsampled: 30,
          },
        }),
        logBytes: MetricHistoryFixture({
          retention: {
            standard: 30,
            downsampled: 7,
          },
        }),
      },
    });

    const updateMock = MockApiClient.addMockResponse({
      url: `/_admin/${organization.slug}/retention-settings/`,
      method: 'POST',
      body: {},
    });

    openUpdateRetentionSettingsModal({
      subscription,
      organization,
      onSuccess,
    });

    await loadModal();

    await userEvent.clear(getSpinbutton('Spans Standard'));
    await userEvent.type(getSpinbutton('Spans Standard'), '180');

    await userEvent.clear(getSpinbutton('Spans Downsampled'));
    await userEvent.type(getSpinbutton('Spans Downsampled'), '90');

    await userEvent.click(screen.getByRole('button', {name: 'Update Settings'}));

    await waitFor(() => {
      expect(updateMock).toHaveBeenCalledWith(
        `/_admin/${organization.slug}/retention-settings/`,
        expect.objectContaining({
          method: 'POST',
          data: {
            retentions: {
              spans: {
                standard: 180,
                downsampled: 90,
              },
              logBytes: {
                standard: 30,
                downsampled: 7,
              },
            },
          },
        })
      );
    });
  });

  it('updates only logBytes retention', async () => {
    const subscription = SubscriptionFixture({
      organization,
      categories: {
        spans: MetricHistoryFixture({
          retention: {
            standard: 90,
            downsampled: 30,
          },
        }),
        logBytes: MetricHistoryFixture({
          retention: {
            standard: 30,
            downsampled: 7,
          },
        }),
      },
    });

    const updateMock = MockApiClient.addMockResponse({
      url: `/_admin/${organization.slug}/retention-settings/`,
      method: 'POST',
      body: {},
    });

    openUpdateRetentionSettingsModal({
      subscription,
      organization,
      onSuccess,
    });

    await loadModal();

    await userEvent.clear(getSpinbutton('Logs Standard'));
    await userEvent.type(getSpinbutton('Logs Standard'), '60');

    await userEvent.clear(getSpinbutton('Logs Downsampled'));
    await userEvent.type(getSpinbutton('Logs Downsampled'), '30');

    await userEvent.click(screen.getByRole('button', {name: 'Update Settings'}));

    await waitFor(() => {
      expect(updateMock).toHaveBeenCalledWith(
        `/_admin/${organization.slug}/retention-settings/`,
        expect.objectContaining({
          method: 'POST',
          data: {
            retentions: {
              spans: {
                standard: 90,
                downsampled: 30,
              },
              logBytes: {
                standard: 60,
                downsampled: 30,
              },
            },
          },
        })
      );
    });
  });
});
