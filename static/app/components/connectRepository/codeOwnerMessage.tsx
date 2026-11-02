import {Link} from '@sentry/scraps/link';

import {tct} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';

export function CodeOwnerMessage({projectSlug}: {projectSlug?: string}) {
  const organization = useOrganization();
  const ownershipUrl = `/settings/${organization.slug}/projects/${projectSlug}/ownership/`;

  return tct(
    'This mapping is linked to a [link:Code Owners] file. Remove the Code Owners connection before editing these paths or deleting this mapping.',
    {link: <Link to={ownershipUrl} />}
  );
}
