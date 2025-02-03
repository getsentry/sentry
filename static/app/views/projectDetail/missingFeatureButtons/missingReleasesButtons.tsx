import {LinkButton} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import {releaseHealth} from 'sentry/data/platformCategories';
import {t} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import type {Organization} from 'sentry/types/organization';
import type {PlatformKey} from 'sentry/types/project';

const DOCS_URL = 'https://docs.sentry.io/product/releases/';
const DOCS_HEALTH_URL = 'https://docs.sentry.io/product/releases/health/';

type Props = {
  organization: Organization;
  health?: boolean;
  platform?: PlatformKey;
  projectId?: string;
};

function MissingReleasesButtons({health, platform}: Props) {
  const isSelfHostedErrorsOnly = ConfigStore.get('isSelfHostedErrorsOnly');
  const setupDisabled =
    (health && platform && !releaseHealth.includes(platform)) || isSelfHostedErrorsOnly;
  const setupDisabledTooltip = isSelfHostedErrorsOnly
    ? t('Release health is not available for errors only self-hosted.')
    : t('Release Health is not yet supported on this platform.');

  return (
    <ButtonBar gap={1}>
      <LinkButton
        size="sm"
        priority="primary"
        external
        href={health ? DOCS_HEALTH_URL : DOCS_URL}
        disabled={setupDisabled}
        title={setupDisabled ? setupDisabledTooltip : undefined}
      >
        {t('Start Setup')}
      </LinkButton>
    </ButtonBar>
  );
}

export default MissingReleasesButtons;
