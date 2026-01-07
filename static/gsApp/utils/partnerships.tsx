import type {Subscription} from 'getsentry/types';

export function isDisabledByPartner(subscription: Subscription): boolean {
  if (!subscription.partner) {
    return false;
  }
  return (
    subscription.partner.isActive &&
    Boolean(subscription.partner?.partnership.supportNote)
  );
}
