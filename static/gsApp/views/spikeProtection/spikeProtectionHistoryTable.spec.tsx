import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';
import {initializeOrg} from 'sentry-test/initializeOrg';
import {cleanup, render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {DATA_CATEGORY_INFO} from 'sentry/constants';
import {DataCategoryExact} from 'sentry/types/core';

import SubscriptionStore from 'getsentry/stores/subscriptionStore';
import SpikeProtectionHistoryTable from 'getsentry/views/spikeProtection/spikeProtectionHistoryTable';
import type {SpikeDetails} from 'getsentry/views/spikeProtection/types';

import {SPIKE_PROTECTION_OPTION_DISABLED} from './constants';

describe('SpikeProtectionHistoryTable', () => {
  const {router, organization} = initializeOrg({
    organization: OrganizationFixture({
      features: ['discover-basic'],
    }),
  });
  const subscription = SubscriptionFixture({organization});

  const project = ProjectFixture();

  const dataCategoryInfo = DATA_CATEGORY_INFO[DataCategoryExact.ERROR];
  let mockPost: any;

  beforeEach(() => {
    project.options = {[SPIKE_PROTECTION_OPTION_DISABLED]: false};
    SubscriptionStore.set(organization.slug, subscription);

    mockPost = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/spike-protections/`,
      method: 'POST',
      body: [],
      statusCode: 200,
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('renders an empty state when no spikes are provided', async () => {
    render(
      <SpikeProtectionHistoryTable
        spikes={[]}
        dataCategoryInfo={dataCategoryInfo}
        project={project}
        onEnableSpikeProtection={() => {}}
      />,
      {router, organization}
    );

    const emptyState = await screen.findByTestId('spike-history-empty');
    expect(emptyState).toBeInTheDocument();
    const emptyMessage = screen.getByText(/No Significant Spikes/);
    expect(emptyMessage).toBeInTheDocument();
  });

  it("renders a disabled state for projects that aren't enabled", async () => {
    project.options![SPIKE_PROTECTION_OPTION_DISABLED] = true;
    const onEnableFunction = jest.fn();

    render(
      <SpikeProtectionHistoryTable
        spikes={[]}
        dataCategoryInfo={dataCategoryInfo}
        project={project}
        onEnableSpikeProtection={onEnableFunction}
      />,
      {router, organization}
    );

    const disabledState = screen.getByTestId('spike-history-disabled');
    expect(disabledState).toBeInTheDocument();
    const disabledMessage = screen.getByText(/Spike Protection Disabled/);
    expect(disabledMessage).toBeInTheDocument();

    expect(onEnableFunction).not.toHaveBeenCalled();
    const enableButton = screen.getByTestId('enable-sp-button');
    await userEvent.click(enableButton);
    expect(mockPost).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({data: {projects: [project.slug]}})
    );
    expect(onEnableFunction).toHaveBeenCalled();
  });

  it('renders when spikes are provided', async () => {
    const spikes: SpikeDetails[] = [
      {
        start: new Date(2022, 0, 1, 0, 0, 0, 0).toISOString(),
        end: new Date(2022, 0, 15, 0, 0, 0, 0).toISOString(),
        threshold: 1250000,
        dropped: 500000,
        dataCategory: dataCategoryInfo.name,
      },
    ];
    render(
      <SpikeProtectionHistoryTable
        spikes={spikes}
        dataCategoryInfo={dataCategoryInfo}
        project={project}
        onEnableSpikeProtection={() => {}}
      />,
      {router, organization}
    );
    await screen.findByTestId('spike-protection-history-table');
    screen.getByText('2wk');
    screen.getByText('1.3M');
    screen.getByText('500K');

    const headers = screen.getAllByTestId('table-header');
    expect(headers).toHaveLength(5);

    const discoverLink = screen.getByTestId('spike-protection-discover-button');
    expect(discoverLink).toHaveTextContent(/Discover/);
    await userEvent.click(discoverLink);

    expect(router.push).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: expect.stringContaining('discover/homepage'),
        query: expect.objectContaining({
          project: project.id,
          start: expect.stringContaining('2022-01-01'),
          end: expect.stringContaining('2022-01-15'),
        }),
      })
    );
  });

  it('renders ongoing stored spike', async () => {
    const storedSpikes: SpikeDetails[] = [
      {
        start: new Date(2022, 0, 2, 6, 0, 0, 0).toISOString(),
        end: undefined,
        threshold: 200000,
        dropped: undefined,
        dataCategory: dataCategoryInfo.name,
      },
    ];
    render(
      <SpikeProtectionHistoryTable
        spikes={storedSpikes}
        dataCategoryInfo={dataCategoryInfo}
        project={project}
        onEnableSpikeProtection={() => {}}
      />,
      {router, organization}
    );

    await screen.findByTestId('spike-protection-history-table');
    screen.getByText('Ongoing');
    screen.getByText('200K');
    screen.getByText('Jan 2nd 2022 - present');
  });
});
