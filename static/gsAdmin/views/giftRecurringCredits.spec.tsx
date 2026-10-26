import {UserFixture} from 'sentry-fixture/user';

import {
  fireEvent,
  render,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {ConfigStore} from 'sentry/stores/configStore';

import {GiftRecurringCredits} from 'admin/views/giftRecurringCredits';

jest.mock('sentry/actionCreators/indicator');

describe('GiftRecurringCredits', () => {
  beforeEach(() => {
    ConfigStore.set(
      'user',
      UserFixture({isSuperuser: true, permissions: new Set(['billing.admin'])})
    );
    ConfigStore.set('cells', [
      {name: 'us', locality_url: 'https://us.test/api/0/'},
      {name: 'eu', locality_url: 'https://eu.test/api/0/'},
    ]);
    MockApiClient.addMockResponse({
      url: '/billing-config/',
      body: {
        category_info: {
          '1': {
            api_name: 'errors',
            billed_category: 1,
            display_name: 'Errors',
            name: 'errors',
            name_singular: 'error',
            order: 1,
            product_name: 'Error Tracking',
            singular: 'error',
            tally_type: 1,
          },
          '7': {
            api_name: 'replays',
            billed_category: 7,
            display_name: 'Replays',
            name: 'replays',
            name_singular: 'replay',
            order: 7,
            product_name: 'Session Replay',
            singular: 'replay',
            tally_type: 1,
          },
          '24': {
            api_name: 'logBytes',
            billed_category: 24,
            display_name: 'Logs',
            name: 'log_bytes',
            name_singular: 'log_byte',
            order: 24,
            product_name: 'Logs',
            singular: 'log byte',
            tally_type: 1,
          },
          '13': {
            api_name: 'monitorSeats',
            billed_category: 13,
            display_name: 'Cron Monitors',
            name: 'monitor_seats',
            name_singular: 'monitor_seat',
            order: 13,
            product_name: 'Cron Monitoring',
            singular: 'monitor seat',
            tally_type: 1,
          },
        },
        outcomes: {},
        reason_codes: {},
      },
    });
  });

  afterEach(() => {
    MockApiClient.clearMockResponses();
  });

  async function fillRequiredFields() {
    await userEvent.type(screen.getByLabelText(/Amount per billing period/), '5000');
  }

  it('submits the raw textarea tokens as multipart, without parsing them', async () => {
    const postMock = MockApiClient.addMockResponse({
      url: '/_admin/cells/us/gift-recurring-credits/',
      method: 'POST',
      body: {
        results: [
          {
            id: 12345,
            slug: 'acme',
            status: 'created',
            code: null,
            plan: 'am3_team',
            periodStart: '2025-07-01',
            periodEnd: '2025-10-01',
            creditId: null,
          },
          {
            id: null,
            slug: 'beta-org',
            status: 'error',
            code: 'unknown-org',
            plan: null,
            periodStart: null,
            periodEnd: null,
            creditId: null,
          },
        ],
      },
    });

    render(<GiftRecurringCredits />);
    await fillRequiredFields();
    await userEvent.type(
      screen.getByLabelText(/Target organizations/),
      '12345, beta-org'
    );

    await userEvent.click(screen.getByTestId('gift-submit'));

    await waitFor(() => expect(postMock).toHaveBeenCalled());
    expect(postMock).toHaveBeenCalledWith(
      '/_admin/cells/us/gift-recurring-credits/',
      expect.objectContaining({
        method: 'POST',
        host: 'https://us.test/api/0/',
        data: expect.any(FormData),
      })
    );

    // The manual tokens ride along verbatim; nothing is parsed client-side.
    const formData = postMock.mock.calls[0][1].data as FormData;
    expect(formData.get('orgsTokens')).toBe('12345, beta-org');
    expect(formData.get('file')).toBeNull();
    expect(formData.get('dataCategory')).toBe('replay');
    expect(formData.get('amount')).toBe('5000');
    expect(formData.get('billingPeriods')).toBe('3');

    // The per-org results render, including the typed error code.
    const results = await screen.findByTestId('results');
    expect(results).toHaveTextContent('created');
    expect(results).toHaveTextContent('unknown-org');
    expect(results).toHaveTextContent('beta-org');

    // The gift just created is summarized per org.
    expect(results).toHaveTextContent('5,000/mo ×3');

    // The org's plan shows, and its slug links to the admin customer page.
    expect(results).toHaveTextContent('am3_team');
    expect(screen.getByRole('link', {name: 'acme'})).toHaveAttribute(
      'href',
      '/_admin/customers/acme/'
    );

    // Orgs not found in the queried region are collected into a callout that
    // names the region and lists them, so the operator can re-run elsewhere.
    expect(screen.getByTestId('not-in-region-warning')).toHaveTextContent(
      '1 of 2 orgs were not found in the us region'
    );
    expect(screen.getByTestId('not-in-region-warning')).toHaveTextContent('beta-org');
  });

  it('uploads a CSV file as multipart to the selected region', async () => {
    const postMock = MockApiClient.addMockResponse({
      url: '/_admin/cells/us/gift-recurring-credits/',
      method: 'POST',
      body: {
        results: [
          {
            id: 1,
            slug: 'acme',
            status: 'created',
            code: null,
            plan: 'am3_business',
            periodStart: '2025-07-01',
            periodEnd: '2025-10-01',
            creditId: 42,
          },
        ],
      },
    });

    render(<GiftRecurringCredits />);
    await fillRequiredFields();

    const file = new File(['org_id\n987\n555'], 'ids.csv', {type: 'text/csv'});
    await userEvent.upload(screen.getByLabelText('csv-upload'), file);

    // The raw file is held; there is no client-side parse or org count.
    expect(await screen.findByText(/ids\.csv/)).toBeInTheDocument();
    expect(addErrorMessage).not.toHaveBeenCalled();

    await userEvent.click(screen.getByTestId('gift-submit'));

    await waitFor(() => expect(postMock).toHaveBeenCalled());
    expect(postMock).toHaveBeenCalledWith(
      '/_admin/cells/us/gift-recurring-credits/',
      expect.objectContaining({
        method: 'POST',
        host: 'https://us.test/api/0/',
        data: expect.any(FormData),
      })
    );

    const formData = postMock.mock.calls[0][1].data as FormData;
    expect(formData.get('file')).toBe(file);
    expect(formData.get('orgsTokens')).toBeNull();

    expect(await screen.findByTestId('results')).toHaveTextContent('created');
  });

  it('surfaces the backend error message when the request is rejected', async () => {
    // The org cap now lives only on the backend; its rejection is shown verbatim.
    MockApiClient.addMockResponse({
      url: '/_admin/cells/us/gift-recurring-credits/',
      method: 'POST',
      statusCode: 400,
      body: {orgs: ['Ensure this field has no more than 10000 elements.']},
    });

    render(<GiftRecurringCredits />);
    await fillRequiredFields();
    await userEvent.type(screen.getByLabelText(/Target organizations/), 'acme');
    await userEvent.click(screen.getByTestId('gift-submit'));

    await waitFor(() =>
      expect(addErrorMessage).toHaveBeenCalledWith(
        'Ensure this field has no more than 10000 elements.'
      )
    );
  });

  it('converts byte-category amounts from GB to bytes', async () => {
    const postMock = MockApiClient.addMockResponse({
      url: '/_admin/cells/us/gift-recurring-credits/',
      method: 'POST',
      body: {results: []},
    });

    render(<GiftRecurringCredits />);
    await userEvent.click(screen.getByRole('button', {name: /Data Category/}));
    await userEvent.click(screen.getByRole('option', {name: 'Logs'}));

    expect(screen.getByText('Amount per billing period (GB):')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText(/Amount per billing period/), '5');
    await userEvent.type(screen.getByLabelText(/Target organizations/), 'acme');

    await userEvent.click(screen.getByTestId('gift-submit'));

    await waitFor(() => expect(postMock).toHaveBeenCalled());
    const formData = postMock.mock.calls[0][1].data as FormData;
    expect(formData.get('dataCategory')).toBe('log_byte');
    expect(formData.get('amount')).toBe('5000000000');
  });

  it('rejects a non-CSV file without attaching it', async () => {
    render(<GiftRecurringCredits />);

    const file = new File(['nope'], 'orgs.txt', {type: 'text/plain'});
    await userEvent.upload(screen.getByLabelText('csv-upload'), file, {
      applyAccept: false,
    });

    await waitFor(() =>
      expect(addErrorMessage).toHaveBeenCalledWith('Please upload a .csv file.')
    );
    expect(screen.queryByText(/orgs\.txt/)).not.toBeInTheDocument();
  });

  it('keeps submission disabled until a file or tokens are provided', async () => {
    render(<GiftRecurringCredits />);
    await fillRequiredFields();

    // Amount and periods are valid, but with no target the gift can't be sent.
    expect(screen.getByTestId('gift-submit')).toBeDisabled();

    await userEvent.type(screen.getByLabelText(/Target organizations/), 'acme');
    expect(screen.getByTestId('gift-submit')).toBeEnabled();
  });

  it('disables submission without billing.admin', async () => {
    ConfigStore.set('user', UserFixture({isSuperuser: true, permissions: new Set()}));

    render(<GiftRecurringCredits />);
    await fillRequiredFields();
    await userEvent.type(screen.getByLabelText(/Target organizations/), 'acme');

    expect(screen.getByText('Requires billing admin permissions.')).toBeInTheDocument();
    expect(screen.getByTestId('gift-submit')).toBeDisabled();
  });

  it('previews the billing period schedule, counting the current period', async () => {
    render(<GiftRecurringCredits />);

    // Default of 3 periods: the current period plus the next two, then a stop.
    const preview = await screen.findByTestId('schedule-preview');
    expect(preview).toHaveTextContent('This billing period');
    expect(preview).toHaveTextContent('starts now, applied immediately');
    expect(preview).toHaveTextContent('Next billing period');
    expect(preview).toHaveTextContent('About 2 months from now');
    expect(preview).toHaveTextContent('Every billing period after these 3 gets nothing');
    // The current period is one of the three, not an extra on top.
    expect(preview).not.toHaveTextContent('About 3 months from now');
    // Use-it-or-lose-it is called out so it isn't read as a bankable pool.
    expect(screen.getByTestId('no-rollover-note')).toHaveTextContent(
      "Unused credits don't roll over"
    );
  });

  it('lets the billing period field be cleared without inserting a leading zero', async () => {
    render(<GiftRecurringCredits />);

    const periodsInput = screen.getByLabelText<HTMLInputElement>(
      'How many monthly billing periods?'
    );
    await userEvent.clear(periodsInput);

    // Empty stays empty (not coerced to 0), and the preview hides until a value.
    expect(periodsInput).toHaveValue(null);
    expect(screen.queryByTestId('schedule-preview')).not.toBeInTheDocument();

    await userEvent.type(periodsInput, '5');
    expect(periodsInput).toHaveValue(5);
    expect(screen.getByTestId('schedule-preview')).toHaveTextContent(
      'for 5 monthly periods.'
    );
  });

  it('blocks submission of a fractional billing period', async () => {
    render(<GiftRecurringCredits />);
    await fillRequiredFields();
    await userEvent.type(screen.getByLabelText(/Target organizations/), 'acme');

    const periodsInput = screen.getByLabelText('How many monthly billing periods?');
    await userEvent.clear(periodsInput);
    await userEvent.type(periodsInput, '3.5');

    // A non-integer count has no schedule and cannot be submitted; the backend
    // only accepts whole periods, so we never let it be POSTed.
    expect(screen.queryByTestId('schedule-preview')).not.toBeInTheDocument();
    expect(screen.getByTestId('gift-submit')).toBeDisabled();
  });

  it('shows a single-period gift as just the current period', async () => {
    render(<GiftRecurringCredits />);

    const periodsInput = screen.getByLabelText('How many monthly billing periods?');
    await userEvent.clear(periodsInput);
    await userEvent.type(periodsInput, '1');

    const preview = screen.getByTestId('schedule-preview');
    expect(preview).toHaveTextContent('This billing period');
    expect(preview).toHaveTextContent('for 1 monthly period.');
    // No future periods when only the current one is gifted.
    expect(preview).not.toHaveTextContent('Next billing period');
    expect(preview).toHaveTextContent('Every billing period after these 1 gets nothing');
  });

  it('drops a previously staged CSV when a later file is rejected', async () => {
    const postMock = MockApiClient.addMockResponse({
      url: '/_admin/cells/us/gift-recurring-credits/',
      method: 'POST',
      body: {results: []},
    });

    render(<GiftRecurringCredits />);
    await fillRequiredFields();
    await userEvent.type(screen.getByLabelText(/Target organizations/), 'acme');

    const goodFile = new File(['org_id\n1'], 'ids.csv', {type: 'text/csv'});
    await userEvent.upload(screen.getByLabelText('csv-upload'), goodFile);
    expect(await screen.findByText(/ids\.csv/)).toBeInTheDocument();

    const badFile = new File(['nope'], 'orgs.txt', {type: 'text/plain'});
    await userEvent.upload(screen.getByLabelText('csv-upload'), badFile, {
      applyAccept: false,
    });

    // The rejected reselection clears the earlier file rather than leaving it
    // staged for the request.
    await waitFor(() =>
      expect(addErrorMessage).toHaveBeenCalledWith('Please upload a .csv file.')
    );
    expect(screen.queryByText(/ids\.csv/)).not.toBeInTheDocument();

    await userEvent.click(screen.getByTestId('gift-submit'));
    await waitFor(() => expect(postMock).toHaveBeenCalled());
    const formData = postMock.mock.calls[0][1].data as FormData;
    expect(formData.get('file')).toBeNull();
    expect(formData.get('orgsTokens')).toBe('acme');
  });

  it('does not POST when a submit event fires on an invalid form', async () => {
    const postMock = MockApiClient.addMockResponse({
      url: '/_admin/cells/us/gift-recurring-credits/',
      method: 'POST',
      body: {results: []},
    });

    render(<GiftRecurringCredits />);

    // No amount and no target: the button is disabled, but a submit event that
    // slips past it (e.g. a double-click race) must still be refused.
    const form = screen.getByTestId('gift-submit').closest('form')!;
    fireEvent.submit(form);

    await waitFor(() => expect(addErrorMessage).not.toHaveBeenCalled());
    expect(postMock).not.toHaveBeenCalled();
  });

  it('blocks submission of a fractional count amount', async () => {
    render(<GiftRecurringCredits />);
    await userEvent.type(screen.getByLabelText(/Target organizations/), 'acme');

    const amountInput = screen.getByLabelText(/Amount per billing period/);
    await userEvent.type(amountInput, '5000.5');

    // The POST rounds the amount, so a fractional count would credit a value the
    // preview never showed; the form refuses it.
    expect(screen.getByTestId('gift-submit')).toBeDisabled();

    await userEvent.clear(amountInput);
    await userEvent.type(amountInput, '5000');
    expect(screen.getByTestId('gift-submit')).toBeEnabled();
  });

  it('links only slugged orgs and shows the id as plain text otherwise', async () => {
    MockApiClient.addMockResponse({
      url: '/_admin/cells/us/gift-recurring-credits/',
      method: 'POST',
      body: {
        results: [
          {
            id: 1,
            slug: 'acme',
            status: 'created',
            code: null,
            plan: 'am3_team',
            periodStart: '2025-07-01',
            periodEnd: '2025-10-01',
            creditId: null,
          },
          {
            id: 999,
            slug: null,
            status: 'created',
            code: null,
            plan: 'am3_team',
            periodStart: '2025-07-01',
            periodEnd: '2025-10-01',
            creditId: null,
          },
          {
            id: 888,
            slug: '',
            status: 'created',
            code: null,
            plan: 'am3_team',
            periodStart: '2025-07-01',
            periodEnd: '2025-10-01',
            creditId: null,
          },
        ],
      },
    });

    render(<GiftRecurringCredits />);
    await fillRequiredFields();
    await userEvent.type(screen.getByLabelText(/Target organizations/), 'acme');
    await userEvent.click(screen.getByTestId('gift-submit'));

    await screen.findByTestId('results');

    // Only the slugged org is a link; a null or empty slug never produces a
    // dash-link or a `/_admin/customers//` href.
    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute('href', '/_admin/customers/acme/');
    expect(screen.getByTestId('results')).toHaveTextContent('999');
    expect(screen.getByTestId('results')).toHaveTextContent('888');
  });

  it('clears a prior results table when a later submit fails', async () => {
    const successMock = MockApiClient.addMockResponse({
      url: '/_admin/cells/us/gift-recurring-credits/',
      method: 'POST',
      body: {
        results: [
          {
            id: 1,
            slug: 'acme',
            status: 'created',
            code: null,
            plan: 'am3_team',
            periodStart: '2025-07-01',
            periodEnd: '2025-10-01',
            creditId: 7,
          },
        ],
      },
    });

    render(<GiftRecurringCredits />);
    await fillRequiredFields();
    await userEvent.type(screen.getByLabelText(/Target organizations/), 'acme');
    await userEvent.click(screen.getByTestId('gift-submit'));

    expect(await screen.findByTestId('results')).toHaveTextContent('created');

    // A second run that fails must not leave the previous run's table on screen.
    successMock.mockClear();
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: '/_admin/cells/us/gift-recurring-credits/',
      method: 'POST',
      statusCode: 400,
      body: {detail: 'Something went wrong.'},
    });

    await userEvent.click(screen.getByTestId('gift-submit'));

    await waitFor(() =>
      expect(addErrorMessage).toHaveBeenCalledWith('Something went wrong.')
    );
    expect(screen.queryByTestId('results')).not.toBeInTheDocument();
  });
});
