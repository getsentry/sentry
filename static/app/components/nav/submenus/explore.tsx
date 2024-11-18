import Submenu, {SubmenuBody, SubmenuItem} from 'sentry/components/nav/submenu';
import {t} from 'sentry/locale';
import {getDiscoverLandingUrl} from 'sentry/utils/discover/urls';
import useOrganization from 'sentry/utils/useOrganization';

export type PerformanceSubmenuKey =
  | 'traces'
  | 'metrics'
  | 'profiling'
  | 'discover'
  | 'releases'
  | 'crons'
  | 'feedback';

export default function PerformanceSubmenu() {
  const organization = useOrganization();
  const prefix = `organizations/${organization.slug}`;

  return (
    <Submenu>
      <SubmenuBody>
        <SubmenuItem id="traces" to={`/${prefix}/traces/`}>
          {t('Traces')}
        </SubmenuItem>
        <SubmenuItem id="metrics" to={`/${prefix}/metrics/`}>
          {t('Metrics')}
        </SubmenuItem>
        <SubmenuItem id="profiling" to={`/${prefix}/profiling/`}>
          {t('Profiles')}
        </SubmenuItem>
        <SubmenuItem id="replays" to={`/${prefix}/replays/`}>
          {t('Replays')}
        </SubmenuItem>
        <SubmenuItem id="discover" to={getDiscoverLandingUrl(organization)}>
          {t('Discover')}
        </SubmenuItem>
        <SubmenuItem id="releases" to={`/${prefix}/releases/`}>
          {t('Releases')}
        </SubmenuItem>
        <SubmenuItem id="crons" to={`/${prefix}/crons/`}>
          {t('Crons')}
        </SubmenuItem>
      </SubmenuBody>
    </Submenu>
  );
}
