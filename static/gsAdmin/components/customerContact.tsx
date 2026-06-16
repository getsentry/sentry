import {Link} from '@sentry/scraps/link';

import type {Subscription} from 'getsentry/types';

type Props = {
  owner?: Subscription['owner'];
};

export function CustomerContact({owner}: Props) {
  return owner ? (
    <Link to={`/_admin/users/?query=${encodeURIComponent(owner.email)}`}>
      {owner.email}
    </Link>
  ) : null;
}
