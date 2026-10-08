import {
  fireEvent,
  render,
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

import type {PromoCode as PromoCodeType} from 'admin/types';
import {PromoCodeDetails} from 'admin/views/promoCodeDetails';
import {PromoCodes} from 'admin/views/promoCodes';

function PromoCodeFixture(params: Partial<PromoCodeType>): PromoCodeType {
  return {
    amount: '29.00',
    campaign: '',
    code: 'cool_code',
    dateCreated: '2018-07-11T19:23:19.128Z',
    dateExpires: '2019-07-11T19:23:19.128Z',
    duration: 'once',
    maxClaims: 1,
    newOnly: false,
    numClaims: 0,
    status: 'active',
    userEmail: 'hellboy@cutecats.io',
    userId: 1,
    trialDays: 3,
    ...params,
  };
}

describe('PromoCodes', () => {
  it('renders', async () => {
    MockApiClient.addMockResponse({
      url: '/promocodes/',
      method: 'GET',
      body: [],
    });
    render(<PromoCodes />);
    expect(await screen.findByRole('heading', {name: 'Promo Codes'})).toBeInTheDocument();
  });

  it('shows a promo code created by someone with an email', async () => {
    MockApiClient.addMockResponse({
      url: '/promocodes/',
      method: 'GET',
      body: [PromoCodeFixture({})],
    });
    render(<PromoCodes />);
    expect(
      await screen.findByRole('link', {name: 'hellboy@cutecats.io'})
    ).toBeInTheDocument();
  });

  it('shows a promo code created by someone without an email', async () => {
    MockApiClient.addMockResponse({
      url: '/promocodes/',
      method: 'GET',
      body: [PromoCodeFixture({userEmail: null})],
    });
    render(<PromoCodes />);
    expect(await screen.findByRole('link', {name: 'Created By'})).toBeEmptyDOMElement();
  });

  it('selects the saved duration when editing a promo code', async () => {
    MockApiClient.addMockResponse({
      url: '/promocodes/cool_code/',
      method: 'GET',
      body: PromoCodeFixture({duration: 'once'}),
    });
    MockApiClient.addMockResponse({
      url: '/promocodes/cool_code/claimants/',
      method: 'GET',
      body: [],
    });
    render(<PromoCodeDetails />, {
      initialRouterConfig: {
        location: {pathname: '/_admin/promocodes/cool_code/'},
        route: '/_admin/promocodes/:codeId/',
      },
    });
    renderGlobalModal();

    await userEvent.click(
      await screen.findByRole('button', {name: 'Promo Codes Actions'})
    );
    await userEvent.click(screen.getByRole('option', {name: 'Edit'}));

    expect(screen.getByRole('heading', {name: 'Edit cool_code'})).toBeInTheDocument();
    expect(screen.getByText('Once')).toBeInTheDocument();
  });

  it('creates a promo code from the modal footer', async () => {
    MockApiClient.addMockResponse({url: '/promocodes/', method: 'GET', body: []});
    const create = MockApiClient.addMockResponse({
      url: '/promocodes/',
      method: 'POST',
      body: PromoCodeFixture({code: 'test-code'}),
    });
    render(<PromoCodes />);

    await userEvent.click(screen.getByRole('button', {name: 'Create Promo Code'}));
    renderGlobalModal();
    expect(screen.getByRole('heading', {name: 'Add New Promo Code'})).toBeInTheDocument();
    await userEvent.type(screen.getByRole('textbox', {name: /Code \(ID\)/}), 'test-code');
    await userEvent.type(screen.getByRole('spinbutton', {name: 'Max claims'}), '10');
    await userEvent.click(screen.getByRole('button', {name: 'Create'}));

    await waitFor(() => expect(create).toHaveBeenCalled());
    expect(create).toHaveBeenCalledWith(
      '/promocodes/',
      expect.objectContaining({
        data: expect.objectContaining({
          code: 'test-code',
          maxClaims: '10',
          dateExpires: null,
        }),
      })
    );
  });

  it('submits the selected expiration date', async () => {
    MockApiClient.addMockResponse({url: '/promocodes/', method: 'GET', body: []});
    const create = MockApiClient.addMockResponse({
      url: '/promocodes/',
      method: 'POST',
      body: PromoCodeFixture({code: 'test-code'}),
    });
    render(<PromoCodes />);

    await userEvent.click(screen.getByRole('button', {name: 'Create Promo Code'}));
    renderGlobalModal();
    await userEvent.type(screen.getByRole('textbox', {name: /Code \(ID\)/}), 'test-code');
    await userEvent.type(screen.getByRole('spinbutton', {name: 'Max claims'}), '10');
    await userEvent.click(
      screen.getByLabelText('Set an expiration date for the promo code?')
    );
    fireEvent.change(screen.getByLabelText('Date Expires'), {
      target: {value: '2026-12-01T14:30'},
    });
    await userEvent.click(screen.getByRole('button', {name: 'Create'}));

    await waitFor(() => expect(create).toHaveBeenCalled());
    expect(create).toHaveBeenCalledWith(
      '/promocodes/',
      expect.objectContaining({
        data: expect.objectContaining({dateExpires: '2026-12-01T14:30'}),
      })
    );
  });

  it('submits null when expiration is enabled without a date', async () => {
    MockApiClient.addMockResponse({url: '/promocodes/', method: 'GET', body: []});
    const create = MockApiClient.addMockResponse({
      url: '/promocodes/',
      method: 'POST',
      body: PromoCodeFixture({code: 'test-code'}),
    });
    render(<PromoCodes />);

    await userEvent.click(screen.getByRole('button', {name: 'Create Promo Code'}));
    renderGlobalModal();
    await userEvent.type(screen.getByRole('textbox', {name: /Code \(ID\)/}), 'test-code');
    await userEvent.type(screen.getByRole('spinbutton', {name: 'Max claims'}), '10');
    await userEvent.click(
      screen.getByLabelText('Set an expiration date for the promo code?')
    );
    await userEvent.click(screen.getByRole('button', {name: 'Create'}));

    await waitFor(() => expect(create).toHaveBeenCalled());
    expect(create).toHaveBeenCalledWith(
      '/promocodes/',
      expect.objectContaining({data: expect.objectContaining({dateExpires: null})})
    );
  });

  it('requires max claims to be a positive whole number', async () => {
    MockApiClient.addMockResponse({url: '/promocodes/', method: 'GET', body: []});
    const create = MockApiClient.addMockResponse({
      url: '/promocodes/',
      method: 'POST',
      body: PromoCodeFixture({code: 'test-code'}),
    });
    render(<PromoCodes />);

    await userEvent.click(screen.getByRole('button', {name: 'Create Promo Code'}));
    renderGlobalModal();
    await userEvent.type(screen.getByRole('textbox', {name: /Code \(ID\)/}), 'test-code');
    const maxClaims = screen.getByRole('spinbutton', {name: 'Max claims'});
    await userEvent.click(screen.getByRole('button', {name: 'Create'}));

    expect(await screen.findByText('Max claims is required')).toBeInTheDocument();
    expect(create).not.toHaveBeenCalled();

    await userEvent.type(maxClaims, '1.5');
    await userEvent.click(screen.getByRole('button', {name: 'Create'}));

    expect(
      await screen.findByText('Max claims must be a whole number')
    ).toBeInTheDocument();
    expect(create).not.toHaveBeenCalled();

    await userEvent.clear(maxClaims);
    await userEvent.type(maxClaims, '10');
    await userEvent.click(screen.getByRole('button', {name: 'Create'}));

    await waitFor(() => expect(create).toHaveBeenCalled());
    expect(create).toHaveBeenCalledWith(
      '/promocodes/',
      expect.objectContaining({data: expect.objectContaining({maxClaims: '10'})})
    );
  });

  it('accepts a decimal amount and rejects negative amounts', async () => {
    MockApiClient.addMockResponse({url: '/promocodes/', method: 'GET', body: []});
    const create = MockApiClient.addMockResponse({
      url: '/promocodes/',
      method: 'POST',
      body: PromoCodeFixture({amount: '24.30'}),
    });
    render(<PromoCodes />);

    await userEvent.click(screen.getByRole('button', {name: 'Create Promo Code'}));
    renderGlobalModal();
    await userEvent.type(screen.getByRole('textbox', {name: /Code \(ID\)/}), 'test-code');
    await userEvent.type(screen.getByRole('spinbutton', {name: 'Max claims'}), '10');
    const amount = screen.getByRole('spinbutton', {name: 'Amount'});
    await userEvent.type(amount, '-1');
    await userEvent.click(screen.getByRole('button', {name: 'Create'}));

    expect(await screen.findByText('Amount must be zero or greater')).toBeInTheDocument();
    expect(create).not.toHaveBeenCalled();

    await userEvent.clear(amount);
    await userEvent.type(amount, '24.30');
    await userEvent.click(screen.getByRole('button', {name: 'Create'}));

    await waitFor(() => expect(create).toHaveBeenCalled());
    expect(create).toHaveBeenCalledWith(
      '/promocodes/',
      expect.objectContaining({data: expect.objectContaining({amount: '24.3'})})
    );
  });
});
