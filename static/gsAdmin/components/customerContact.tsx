import {ExternalLink} from '@sentry/scraps/link';

import type {Subscription} from 'getsentry/types';

type Props = {
  owner?: Subscription['owner'];
};

export function CustomerContact({owner}: Props) {
  return owner ? (
    <ExternalLink
      href={`mailto:${encodeURIComponent(`"${owner.name}" <${owner.email}>`)}`}
    >
      {owner.email}
    </ExternalLink>
  ) : null;
}
