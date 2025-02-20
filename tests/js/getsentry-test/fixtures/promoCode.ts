import type {PromoCode as PromoCodeType} from 'admin/types';

export function PromoCodeFixture(params: Partial<PromoCodeType>): PromoCodeType {
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
