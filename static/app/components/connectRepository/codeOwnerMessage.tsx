import {Link} from '@sentry/scraps/link';

import {tct} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';

export function CodeOwnerMessage({projectSlug}: {projectSlug?: string}) {
  const organization = useOrganization();
  const ownershipUrl = `/settings/${organization.slug}/projects/${projectSlug}/ownership/`;

  return tct(
    "Linked to a [link:Code Owners] file, so its paths can't be edited or deleted.",
    {link: <Link to={ownershipUrl} />}
  );
}
