import ExternalLink from 'sentry/components/links/externalLink';

import type {Subscription} from 'getsentry/types';

type Props = {
  owner?: Subscription['owner'];
};

function CustomerContact({owner}: Props) {
  return owner ? (
    <ExternalLink
      href={`mailto:${encodeURIComponent(`"${owner.name}" <${owner.email}>`)}`}
    >
      {owner.email}
    </ExternalLink>
  ) : null;
}

export default CustomerContact;
