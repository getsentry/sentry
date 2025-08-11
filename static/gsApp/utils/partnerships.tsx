import type {Subscription} from 'getsentry/types';

export function isDisabledByPartner(subscription: Subscription): boolean {
  if (subscription.partner === null) {
    return false;
  }
  return (
    subscription.partner.isActive &&
    Boolean(subscription.partner?.partnership.supportNote)
  );
}
