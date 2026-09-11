import {OrganizationFixture} from 'sentry-fixture/organization';

import {MetricHistoryFixture} from 'getsentry-test/fixtures/metricHistory';
import {PlanDetailsLookupFixture} from 'getsentry-test/fixtures/planDetailsLookup';
import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';
import {
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';
import {selectEvent} from 'sentry-test/selectEvent';

import {openUpdateRetentionSettingsModal} from 'admin/components/customers/updateRetentionSettingsModal';

describe('UpdateRetentionSettingsModal', () => {
  const onSuccess = jest.fn();
  const organization = OrganizationFixture();

  function getSelect(name: string) {
    return screen.getByRole('textbox', {name});
  }

  function getSelectContainer(name: string) {
    // scope assertions to a single select, since several share option labels
    return getSelect(name).closest<HTMLElement>('[class$="-container"]')!;
  }

  function expectSelectValue(name: string, value: string | null) {
    const container = getSelectContainer(name);
    expect(within(container).getByText(value ?? 'Plan default')).toBeInTheDocument();
  }

  async function selectRetention(name: string, option: string) {
    await selectEvent.select(getSelect(name), option);
  }

  async function clearRetention(name: string) {
    await userEvent.click(
      within(getSelectContainer(name)).getByLabelText('Clear choices')
    );
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
      planDetails: PlanDetailsLookupFixture('am3_f'),
      orgRetention: {standard: 1234567, downsampled: null},
    });

    openUpdateRetentionSettingsModal({
      subscription,
      organization,
      onSuccess,
    });

    await loadModal();

    expectSelectValue('Spans Standard', '90 days (current)');
    expectSelectValue('Spans Downsampled', '30 days (current)');
    // values that are not multiples of 30 are preserved as-is
    expectSelectValue('Logs Standard', '45 days (current)');
    expectSelectValue('Logs Downsampled', '15 days (current)');
    expectSelectValue('Org Retention', '1234567 days (current)');

    expect(screen.getByRole('button', {name: 'Cancel'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Update Settings'})).toBeInTheDocument();
  });

  it('only offers multiples of 30 up to 390', async () => {
    const subscription = SubscriptionFixture({
      organization,
      categories: {
        spans: MetricHistoryFixture({
          retention: {
            standard: 90,
            downsampled: 30,
          },
        }),
      },
      planDetails: PlanDetailsLookupFixture('am3_f'),
      orgRetention: {standard: null, downsampled: null},
    });

    openUpdateRetentionSettingsModal({
      subscription,
      organization,
      onSuccess,
    });

    await loadModal();

    await selectEvent.openMenu(getSelect('Spans Standard'));

    const options = screen
      .getAllByRole('menuitemradio')
      .map(option => option.textContent);

    expect(options).toEqual([
      '30 days',
      '60 days',
      '90 days (current)',
      '120 days',
      '150 days',
      '180 days',
      '210 days',
      '240 days',
      '270 days',
      '300 days',
      '330 days',
      '360 days',
      '390 days',
    ]);
  });

  it('does not offer zero for downsampled fields', async () => {
    const subscription = SubscriptionFixture({
      organization,
      categories: {
        spans: MetricHistoryFixture({
          retention: {
            standard: 90,
            downsampled: 30,
          },
        }),
      },
      planDetails: PlanDetailsLookupFixture('am3_f'),
      orgRetention: {standard: null, downsampled: null},
    });

    openUpdateRetentionSettingsModal({
      subscription,
      organization,
      onSuccess,
    });

    await loadModal();

    await selectEvent.openMenu(getSelect('Spans Downsampled'));

    const options = screen
      .getAllByRole('menuitemradio')
      .map(option => option.textContent);

    // Downsampled fields get exactly the same choices as standard ones; there
    // is no longer a zero option, and 30 is the smallest selectable retention.
    expect(options).toEqual([
      '30 days (current)',
      '60 days',
      '90 days',
      '120 days',
      '150 days',
      '180 days',
      '210 days',
      '240 days',
      '270 days',
      '300 days',
      '330 days',
      '360 days',
      '390 days',
    ]);
  });

  it('keeps an existing zero downsampled value as an option', async () => {
    const subscription = SubscriptionFixture({
      organization,
      categories: {
        spans: MetricHistoryFixture({
          retention: {
            standard: 90,
            downsampled: 0,
          },
        }),
      },
      planDetails: PlanDetailsLookupFixture('am3_f'),
      orgRetention: {standard: null, downsampled: null},
    });

    openUpdateRetentionSettingsModal({
      subscription,
      organization,
      onSuccess,
    });

    await loadModal();

    expectSelectValue('Spans Downsampled', '0 days (current)');
  });

  it('keeps a legacy value selectable after selecting away from it', async () => {
    const subscription = SubscriptionFixture({
      organization,
      categories: {
        logBytes: MetricHistoryFixture({
          retention: {
            standard: 45,
            downsampled: null,
          },
        }),
      },
      planDetails: PlanDetailsLookupFixture('am3_f'),
      orgRetention: {standard: null, downsampled: null},
    });

    const updateMock = MockApiClient.addMockResponse({
      url: `/_admin/customers/${organization.slug}/retention-settings/`,
      method: 'POST',
      body: {},
    });

    openUpdateRetentionSettingsModal({
      subscription,
      organization,
      onSuccess,
    });

    await loadModal();

    expectSelectValue('Logs Standard', '45 days (current)');

    // Move off the legacy value.
    await selectRetention('Logs Standard', '90 days');
    expectSelectValue('Logs Standard', '90 days');

    // The legacy value must still be offered, otherwise an admin who changes
    // their mind can no longer restore what the subscription started with.
    await selectEvent.openMenu(getSelect('Logs Standard'));

    const options = screen
      .getAllByRole('menuitemradio')
      .map(option => option.textContent);

    expect(options[0]).toBe('45 days (current)');

    // Selecting it back round-trips the original value to the API.
    await selectRetention('Logs Standard', '45 days (current)');
    expectSelectValue('Logs Standard', '45 days (current)');

    await userEvent.click(screen.getByRole('button', {name: 'Update Settings'}));

    await waitFor(() => {
      expect(updateMock).toHaveBeenCalledWith(
        `/_admin/customers/${organization.slug}/retention-settings/`,
        expect.objectContaining({
          method: 'POST',
          data: expect.objectContaining({
            retentions: expect.objectContaining({
              logBytes: {
                standard: 45,
                downsampled: null,
              },
            }),
          }),
        })
      );
    });
  });

  it('prefills the form with existing AM2 retention values', async () => {
    const subscription = SubscriptionFixture({
      organization,
      categories: {
        transactions: MetricHistoryFixture({
          retention: {
            standard: 90,
            downsampled: 30,
          },
        }),
        logBytes: MetricHistoryFixture({
          retention: {
            standard: 60,
            downsampled: 30,
          },
        }),
      },
      planDetails: PlanDetailsLookupFixture('am2_f'),
    });

    openUpdateRetentionSettingsModal({
      subscription,
      organization,
      onSuccess,
    });

    await loadModal();

    expectSelectValue('Transactions Standard', '90 days (current)');
    expectSelectValue('Transactions Downsampled', '30 days (current)');
    expectSelectValue('Logs Standard', '60 days (current)');
    expectSelectValue('Logs Downsampled', '30 days (current)');

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
      planDetails: PlanDetailsLookupFixture('am3_f'),
      orgRetention: {standard: null, downsampled: null},
    });

    openUpdateRetentionSettingsModal({
      subscription,
      organization,
      onSuccess,
    });

    await loadModal();

    expectSelectValue('Org Retention', null);
    expectSelectValue('Spans Standard', '90 days (current)');
    expectSelectValue('Spans Downsampled', null);
    expectSelectValue('Logs Standard', '30 days (current)');
    expectSelectValue('Logs Downsampled', null);
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
            downsampled: 30,
          },
        }),
      },
      planDetails: PlanDetailsLookupFixture('am3_f'),
      orgRetention: {standard: 120, downsampled: null},
    });

    const updateMock = MockApiClient.addMockResponse({
      url: `/_admin/customers/${organization.slug}/retention-settings/`,
      method: 'POST',
      body: {},
    });

    openUpdateRetentionSettingsModal({
      subscription,
      organization,
      onSuccess,
    });

    await loadModal();

    await selectRetention('Org Retention', '390 days');
    await selectRetention('Spans Standard', '120 days');
    await selectRetention('Spans Downsampled', '60 days');
    await selectRetention('Logs Standard', '60 days');
    await selectRetention('Logs Downsampled', '30 days (current)');

    await userEvent.click(screen.getByRole('button', {name: 'Update Settings'}));

    await waitFor(() => {
      expect(updateMock).toHaveBeenCalledWith(
        `/_admin/customers/${organization.slug}/retention-settings/`,
        expect.objectContaining({
          method: 'POST',
          data: {
            orgRetention: {
              standard: 390,
              downsampled: null,
            },
            retentions: {
              spans: {
                standard: 120,
                downsampled: 60,
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

    expect(onSuccess).toHaveBeenCalled();
  });

  it('calls api with correct data when updating all AM2 fields', async () => {
    const subscription = SubscriptionFixture({
      organization,
      categories: {
        transactions: MetricHistoryFixture({
          retention: {
            standard: 90,
            downsampled: 30,
          },
        }),
        logBytes: MetricHistoryFixture({
          retention: {
            standard: 30,
            downsampled: 30,
          },
        }),
      },
      planDetails: PlanDetailsLookupFixture('am2_f'),
      orgRetention: {standard: null, downsampled: null},
    });

    const updateMock = MockApiClient.addMockResponse({
      url: `/_admin/customers/${organization.slug}/retention-settings/`,
      method: 'POST',
      body: {},
    });

    openUpdateRetentionSettingsModal({
      subscription,
      organization,
      onSuccess,
    });

    await loadModal();

    await selectRetention('Transactions Standard', '120 days');
    await selectRetention('Transactions Downsampled', '60 days');
    await selectRetention('Logs Standard', '60 days');
    await selectRetention('Logs Downsampled', '30 days (current)');

    await userEvent.click(screen.getByRole('button', {name: 'Update Settings'}));

    await waitFor(() => {
      expect(updateMock).toHaveBeenCalledWith(
        `/_admin/customers/${organization.slug}/retention-settings/`,
        expect.objectContaining({
          method: 'POST',
          data: {
            orgRetention: {
              standard: null,
              downsampled: null,
            },
            retentions: {
              transactions: {
                standard: 120,
                downsampled: 60,
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

    expect(onSuccess).toHaveBeenCalled();
  });

  it('calls api with null values when fields are cleared', async () => {
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
            downsampled: 30,
          },
        }),
      },
      planDetails: PlanDetailsLookupFixture('am3_f'),
      orgRetention: {standard: 120, downsampled: null},
    });

    const updateMock = MockApiClient.addMockResponse({
      url: `/_admin/customers/${organization.slug}/retention-settings/`,
      method: 'POST',
      body: {},
    });

    openUpdateRetentionSettingsModal({
      subscription,
      organization,
      onSuccess,
    });

    await loadModal();

    await clearRetention('Org Retention');
    await clearRetention('Spans Standard');
    await clearRetention('Spans Downsampled');
    await clearRetention('Logs Downsampled');

    await userEvent.click(screen.getByRole('button', {name: 'Update Settings'}));

    await waitFor(() => {
      expect(updateMock).toHaveBeenCalledWith(
        `/_admin/customers/${organization.slug}/retention-settings/`,
        expect.objectContaining({
          method: 'POST',
          data: {
            orgRetention: {
              standard: null,
              downsampled: null,
            },
            retentions: {
              spans: {
                standard: null,
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

  it('sends null for fields left at the plan default', async () => {
    const subscription = SubscriptionFixture({
      organization,
      categories: {
        spans: MetricHistoryFixture({
          retention: {
            standard: null,
            downsampled: null,
          },
        }),
        logBytes: MetricHistoryFixture({
          retention: {
            standard: null,
            downsampled: null,
          },
        }),
      },
      planDetails: PlanDetailsLookupFixture('am3_f'),
      orgRetention: {standard: null, downsampled: null},
    });

    const updateMock = MockApiClient.addMockResponse({
      url: `/_admin/customers/${organization.slug}/retention-settings/`,
      method: 'POST',
      body: {},
    });

    openUpdateRetentionSettingsModal({
      subscription,
      organization,
      onSuccess,
    });

    await loadModal();

    // Nothing is configured, so every field sits at the plan default.
    expectSelectValue('Org Retention', null);
    expectSelectValue('Spans Standard', null);
    expectSelectValue('Spans Downsampled', null);
    expectSelectValue('Logs Standard', null);
    expectSelectValue('Logs Downsampled', null);

    // Submit without touching a single field.
    await userEvent.click(screen.getByRole('button', {name: 'Update Settings'}));

    await waitFor(() => {
      expect(updateMock).toHaveBeenCalledWith(
        `/_admin/customers/${organization.slug}/retention-settings/`,
        expect.objectContaining({
          method: 'POST',
          data: {
            orgRetention: {
              standard: null,
              downsampled: null,
            },
            retentions: {
              spans: {
                standard: null,
                downsampled: null,
              },
              logBytes: {
                standard: null,
                downsampled: null,
              },
            },
          },
        })
      );
    });

    expect(onSuccess).toHaveBeenCalled();
  });

  it('keeps other fields null when only one field is set', async () => {
    const subscription = SubscriptionFixture({
      organization,
      categories: {
        spans: MetricHistoryFixture({
          retention: {
            standard: null,
            downsampled: null,
          },
        }),
        logBytes: MetricHistoryFixture({
          retention: {
            standard: null,
            downsampled: null,
          },
        }),
      },
      planDetails: PlanDetailsLookupFixture('am3_f'),
      orgRetention: {standard: null, downsampled: null},
    });

    const updateMock = MockApiClient.addMockResponse({
      url: `/_admin/customers/${organization.slug}/retention-settings/`,
      method: 'POST',
      body: {},
    });

    openUpdateRetentionSettingsModal({
      subscription,
      organization,
      onSuccess,
    });

    await loadModal();

    await selectRetention('Spans Standard', '90 days');

    await userEvent.click(screen.getByRole('button', {name: 'Update Settings'}));

    // Selecting one value must not backfill the rest with plan values; the
    // untouched fields stay null so the API keeps applying its own defaults.
    await waitFor(() => {
      expect(updateMock).toHaveBeenCalledWith(
        `/_admin/customers/${organization.slug}/retention-settings/`,
        expect.objectContaining({
          method: 'POST',
          data: {
            orgRetention: {
              standard: null,
              downsampled: null,
            },
            retentions: {
              spans: {
                standard: 90,
                downsampled: null,
              },
              logBytes: {
                standard: null,
                downsampled: null,
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
            downsampled: 30,
          },
        }),
      },
      planDetails: PlanDetailsLookupFixture('am3_f'),
      orgRetention: {standard: null, downsampled: null},
    });

    const updateMock = MockApiClient.addMockResponse({
      url: `/_admin/customers/${organization.slug}/retention-settings/`,
      method: 'POST',
      body: {},
    });

    openUpdateRetentionSettingsModal({
      subscription,
      organization,
      onSuccess,
    });

    await loadModal();

    await selectRetention('Spans Standard', '180 days');
    await selectRetention('Spans Downsampled', '90 days');

    await userEvent.click(screen.getByRole('button', {name: 'Update Settings'}));

    await waitFor(() => {
      expect(updateMock).toHaveBeenCalledWith(
        `/_admin/customers/${organization.slug}/retention-settings/`,
        expect.objectContaining({
          method: 'POST',
          data: {
            orgRetention: {
              standard: null,
              downsampled: null,
            },
            retentions: {
              spans: {
                standard: 180,
                downsampled: 90,
              },
              logBytes: {
                standard: 30,
                downsampled: 30,
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
            downsampled: 30,
          },
        }),
      },
      planDetails: PlanDetailsLookupFixture('am3_f'),
      orgRetention: {standard: null, downsampled: null},
    });

    const updateMock = MockApiClient.addMockResponse({
      url: `/_admin/customers/${organization.slug}/retention-settings/`,
      method: 'POST',
      body: {},
    });

    openUpdateRetentionSettingsModal({
      subscription,
      organization,
      onSuccess,
    });

    await loadModal();

    await selectRetention('Logs Standard', '60 days');
    await selectRetention('Logs Downsampled', '30 days (current)');

    await userEvent.click(screen.getByRole('button', {name: 'Update Settings'}));

    await waitFor(() => {
      expect(updateMock).toHaveBeenCalledWith(
        `/_admin/customers/${organization.slug}/retention-settings/`,
        expect.objectContaining({
          method: 'POST',
          data: {
            orgRetention: {
              standard: null,
              downsampled: null,
            },
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
