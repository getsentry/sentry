// import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import type {PromoCode as PromoCodeType} from 'admin/types';
import PromoCodes from 'admin/views/promoCodes';

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
    // Router props no longer needed

    MockApiClient.addMockResponse({
      url: '/promocodes/',
      method: 'GET',
      body: [],
    });
    render(<PromoCodes />);
    expect(await screen.findByRole('heading', {name: 'Promo Codes'})).toBeInTheDocument();
  });

  it('shows a promo code created by someone with an email', async () => {
    // Router props no longer needed

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
    // Router props no longer needed

    MockApiClient.addMockResponse({
      url: '/promocodes/',
      method: 'GET',
      body: [PromoCodeFixture({userEmail: null})],
    });
    render(<PromoCodes />);
    expect(await screen.findByRole('link', {name: 'Created By'})).toBeEmptyDOMElement();
  });
});
