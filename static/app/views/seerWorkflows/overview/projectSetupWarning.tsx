import {Flex} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import {Tooltip} from '@sentry/scraps/tooltip';

import {IconWarning} from 'sentry/icons';
import {t, tct, tn} from 'sentry/locale';
import {useBreakpoints} from 'sentry/utils/useBreakpoints';

import type {ProjectConfig} from './types';

interface Props {
  orgSlug: string;
  unconfiguredProjects: ProjectConfig[];
}

export function ProjectSetupWarning({unconfiguredProjects, orgSlug}: Props) {
  const breakpoints = useBreakpoints();
  const count = tn('%s project', '%s projects', unconfiguredProjects.length);

  if (!breakpoints.sm) {
    return null;
  }

  return (
    <Flex align="center" flex="0 0 auto">
      <Tooltip
        isHoverable
        title={tct(
          "Seer automation isn't set up for [count] in the current filter. [link]",
          {
            count,
            link: <Link to={`/settings/${orgSlug}/seer/`}>{t('Enable automation')}</Link>,
          }
        )}
      >
        <IconWarning variant="warning" aria-label={t('Seer setup warning')} />
      </Tooltip>
    </Flex>
  );
}
