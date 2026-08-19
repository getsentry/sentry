import {Alert} from '@sentry/scraps/alert';
import {Link} from '@sentry/scraps/link';

import {t, tct, tn} from 'sentry/locale';
import {oxfordizeArray} from 'sentry/utils/oxfordizeArray';

import type {ProjectConfig} from './types';

const MAX_NAMES = 3;

interface Props {
  orgSlug: string;
  unconfiguredProjects: ProjectConfig[];
}

function formatProjectNames(slugs: string[]) {
  const visible = slugs.slice(0, MAX_NAMES);
  const remaining = slugs.length - visible.length;

  if (remaining > 0) {
    return `${visible.join(', ')}, ${tn('and %s other', 'and %s others', remaining)}`;
  }

  return oxfordizeArray(visible);
}

export function ProjectSetupWarning({unconfiguredProjects, orgSlug}: Props) {
  const names = formatProjectNames(unconfiguredProjects.map(project => project.slug));

  return (
    <Alert variant="warning" showIcon>
      {tct("Seer isn't set up for [names]. Set it up [link].", {
        names,
        link: <Link to={`/settings/${orgSlug}/seer/`}>{t('here')}</Link>,
      })}
    </Alert>
  );
}
