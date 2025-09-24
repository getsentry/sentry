import '@testing-library/jest-dom';

import * as Sentry from '@sentry/react';

import {
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';

import BillingPlans, {type BillingPlansResponse} from './billingPlans';

// Mock Sentry for error handling
jest.mock('@sentry/react');

// Mock URL.createObjectURL and URL.revokeObjectURL
global.URL.createObjectURL = jest.fn(() => 'blob:http://localhost/fake-url');
global.URL.revokeObjectURL = jest.fn();

// We'll use this to hold a reference to the created <a> element
let downloadLink: HTMLAnchorElement | null = null;

// Store the original document.createElement function
const originalCreateElement = document.createElement;

beforeEach(() => {
  // Clear mocks before each test
  jest.clearAllMocks();

  // Spy on document.createElement
  jest.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
    // Use the originally stored createElement function
    const element = originalCreateElement.call(document, tagName);

    if (tagName.toLowerCase() === 'a') {
      downloadLink = element as HTMLAnchorElement;

      // Spy on the click method
      jest.spyOn(downloadLink, 'click').mockImplementation(() => {
        /* do nothing */
      });
    }

    return element;
  });
});

afterEach(() => {
  jest.restoreAllMocks();
  downloadLink = null;
});

const mockPlansResponse: BillingPlansResponse = {
  not_live: [],
  data: {
    am9000: {
      business: {
        data_categories_disabled: [],
        pricing: {
          Platform: {monthly: 8900, annual: 96000},
        },
        price_tiers: {
          errors: [
            {tier: 1, volume: 100000, monthly: 0, annual: 0, od_ppe: 0, reserved_ppe: 0},
            {
              tier: 2,
              volume: 1000000,
              monthly: 10000,
              annual: 100000,
              od_ppe: 200,
              reserved_ppe: 160,
            },
          ],
        },
      },
    },
  },
};

describe('BillingPlans Component', () => {
  beforeEach(() => {
    MockApiClient.addMockResponse({
      url: '/billing-plans/',
      method: 'GET',
      statusCode: 200,
      body: mockPlansResponse,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders without crashing', async () => {
    render(<BillingPlans />);

    // Verify that the main heading is rendered
    expect(screen.getByText('Billing Plans')).toBeInTheDocument();

    // Wait for the plans data to be fetched and rendered
    await waitFor(() => {
      expect(screen.getAllByText('AM9000 Plans').length).toBeGreaterThan(0);
    });
  });

  it('handles API errors gracefully', async () => {
    MockApiClient.addMockResponse({
      url: '/billing-plans/',
      method: 'GET',
      statusCode: 500,
      body: {
        error: 'Internal Server Error',
      },
    });

    render(<BillingPlans />);

    // Wait for the component to handle the error
    await waitFor(() => {
      // Since there's no UI indication for the error, we check that Sentry captured it
      expect(Sentry.captureException).toHaveBeenCalled();
    });
  });

  it('renders the Table of Contents correctly', async () => {
    render(<BillingPlans />);

    // Wait for the Table of Contents to be rendered
    await waitFor(() => {
      expect(screen.getByText('Table of Contents')).toBeInTheDocument();
    });

    expect(await screen.findByRole('link', {name: /AM9000\s+Plans/})).toBeInTheDocument();
    expect(screen.getByRole('link', {name: /Business/})).toBeInTheDocument();
    expect(screen.getByRole('link', {name: /Pricing/})).toBeInTheDocument();
    expect(screen.getByRole('link', {name: /Errors/})).toBeInTheDocument();
  });

  it('renders pricing tables correctly', async () => {
    render(<BillingPlans />);

    // Wait for the pricing tables to be rendered
    await waitFor(() => {
      expect(screen.getByText('Pricing:')).toBeInTheDocument();
    });

    // Check that pricing information is displayed
    expect(
      await screen.findByRole('columnheader', {name: /Platform/})
    ).toBeInTheDocument();
    expect(screen.getByText('$89')).toBeInTheDocument(); // Monthly price
    expect(screen.getByText('$960')).toBeInTheDocument(); // Annual price
  });

  it('renders price tiers tables correctly', async () => {
    render(<BillingPlans />);

    // Wait for the price tiers tables to be rendered
    await waitFor(() => {
      expect(screen.getByText('Errors for AM9000 Business')).toBeInTheDocument();
    });

    // Check that price tier information is displayed
    expect(await screen.findByText('Tier')).toBeInTheDocument();
    expect(screen.getByText('Reserved PPE')).toBeInTheDocument();
    expect(screen.getByText('PAYG PPE')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('100,000')).toBeInTheDocument();
    expect(screen.getAllByText('$0.00')).toHaveLength(2); // Both reserved_ppe and od_ppe for tier 1

    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('1,000,000')).toBeInTheDocument();
    expect(screen.getByText('$1.60')).toBeInTheDocument(); // reserved_ppe
    expect(screen.getByText('$2.00')).toBeInTheDocument(); // od_ppe
  });

  it('downloads CSV when the download button is clicked', async () => {
    const TEST_BLOB_CONSTRUCTOR = jest.fn();

    jest
      .spyOn(global, 'Blob')
      .mockImplementationOnce((...args) => TEST_BLOB_CONSTRUCTOR(...args));

    render(<BillingPlans />);

    // Wait for the plans data to be fetched and rendered
    await waitFor(() => {
      expect(screen.getAllByText('AM9000 Plans').length).toBeGreaterThan(0);
    });

    // Find the download button and click it
    const downloadButton = screen.getByRole('button', {name: /download csv/i});
    await userEvent.click(downloadButton);

    // Check that URL.createObjectURL was called
    expect(URL.createObjectURL).toHaveBeenCalled();

    // Check that the <a> element was created
    expect(document.createElement).toHaveBeenCalledWith('a');
    expect(downloadLink).not.toBeNull();

    // Check that the link.click method was called to initiate download
    expect(downloadLink!.click).toHaveBeenCalled();

    // Assert on the filename
    // For example: Self-Serve_Price_List_2024-10-18T22-44-24-897Z.csv
    const expectedFilenamePattern =
      /^Self-Serve_Price_List_\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z\.csv$/;
    expect(downloadLink!.download).toMatch(expectedFilenamePattern);

    expect(TEST_BLOB_CONSTRUCTOR).toHaveBeenCalledWith(
      expect.arrayContaining([expect.stringContaining('AM9000')]),
      {type: 'text/csv;charset=utf-8;'}
    );

    const blobArgs = TEST_BLOB_CONSTRUCTOR.mock.calls[0][0];
    const blobText = blobArgs.join('');

    // Perform assertions on the CSV content
    expect(blobText).toContain('AM9000');
    expect(blobText).toContain('Am9000 Business, , , ,Errors,,,,,,');
    expect(blobText).toContain(
      'Monthly,Annual, , ,Tier,Volume (max),Monthly,Annual,Reserved PPE,PAYG PPE,'
    );
    expect(blobText).toContain('$89,$960, , ,1,100000,$0,$0,$0.00,$0.00,');
    expect(blobText).toContain(' , , , ,2,1000000,$100,"$1,000",$1.60,$2.00,');
  });

  it('displays "NOT LIVE" badge for plans that are not live', async () => {
    // Mock response with a plan in the 'not_live' array
    const mockNotLiveResponse = {
      not_live: ['am9000'],
      data: mockPlansResponse.data,
    };

    MockApiClient.addMockResponse({
      url: '/billing-plans/',
      method: 'GET',
      statusCode: 200,
      body: mockNotLiveResponse,
    });

    render(<BillingPlans />);

    // Wait for the plans data to be fetched and rendered
    await waitFor(() => {
      expect(screen.getAllByText('AM9000 Plans').length).toBeGreaterThan(0);
    });

    // Check that the 'NOT LIVE' badge is displayed next to the plan header
    const planHeader = screen.getByRole('heading', {
      level: 3,
      name: /AM9000\s+Business\s+Plan/i,
    });
    // eslint-disable-next-line testing-library/no-node-access
    const planNotLiveBadge = within(planHeader.parentElement!).getByText('NOT LIVE');
    expect(planNotLiveBadge).toBeInTheDocument();

    // Check that the 'NOT LIVE' badge is displayed next to the data category header
    const dataCategoryHeader = screen.getByRole('heading', {
      level: 5,
      name: /Errors\s+for\s+AM9000\s+Business/i,
    });
    // eslint-disable-next-line testing-library/no-node-access
    const dataCategoryNotLiveBadge = within(dataCategoryHeader.parentElement!).getByText(
      'NOT LIVE'
    );
    expect(dataCategoryNotLiveBadge).toBeInTheDocument();
  });

  it('displays "DISABLED" badge for data categories that are disabled', async () => {
    // Mock response with a disabled data category
    const mockDisabledDataCategoryResponse = {
      not_live: [],
      data: {
        am9000: {
          business: {
            data_categories_disabled: ['errors'],
            pricing: {
              Platform: {monthly: 8900, annual: 96000},
            },
            price_tiers: {
              errors: [
                {
                  tier: 1,
                  volume: 100000,
                  monthly: 0,
                  annual: 0,
                  od_ppe: 0,
                  reserved_ppe: 0,
                },
                {
                  tier: 2,
                  volume: 1000000,
                  monthly: 10000,
                  annual: 100000,
                  od_ppe: 200,
                  reserved_ppe: 160,
                },
              ],
            },
          },
        },
      },
    };

    MockApiClient.addMockResponse({
      url: '/billing-plans/',
      method: 'GET',
      statusCode: 200,
      body: mockDisabledDataCategoryResponse,
    });

    render(<BillingPlans />);

    // Wait for the plans data to be fetched and rendered
    await waitFor(() => {
      expect(screen.getAllByText('AM9000 Plans').length).toBeGreaterThan(0);
    });

    // Check that the 'DISABLED' badge is displayed next to the data category
    const dataCategoryHeader = screen.getByText('Errors for AM9000 Business');
    // eslint-disable-next-line testing-library/no-node-access
    const disabledBadge = within(dataCategoryHeader.parentElement!).getByText('DISABLED');
    expect(disabledBadge).toBeInTheDocument();
  });

  it('renders without crashing and displays LIVE badges', async () => {
    render(<BillingPlans />);

    // Verify that the main heading is rendered
    expect(screen.getByText('Billing Plans')).toBeInTheDocument();

    // Wait for the plans data to be fetched and rendered
    await waitFor(() => {
      expect(screen.getAllByText('AM9000 Plans').length).toBeGreaterThan(0);
    });

    // Check that the LIVE badge is displayed for the plan
    const planHeader = screen.getByRole('heading', {level: 2, name: /AM9000 Plans/i});
    // eslint-disable-next-line testing-library/no-node-access
    const headerLiveBadges = within(planHeader.parentElement!).getAllByText('LIVE');
    headerLiveBadges.forEach(badge => {
      expect(badge).toBeInTheDocument();
    });

    // Check that the LIVE badge is displayed for the data category
    const dataCategoryHeader = screen.getByText('Errors for AM9000 Business');
    // eslint-disable-next-line testing-library/no-node-access
    const liveBadge = within(dataCategoryHeader.parentElement!).getByText('LIVE');
    expect(liveBadge).toBeInTheDocument();
  });
});
