import {ConfigStore} from 'sentry/stores/configStore';
import {HookStore} from 'sentry/stores/hookStore';
import {isActiveSuperuser} from 'sentry/utils/isActiveSuperuser';
import {useOrganization} from 'sentry/utils/useOrganization';
import {SUPERUSER_MARQUEE_HEIGHT} from 'sentry/views/navigation/constants';
import {useHasPageFrameFeature} from 'sentry/views/navigation/useHasPageFrameFeature';

export function useTopOffset() {
  const hasPageFrame = useHasPageFrameFeature();
  const organization = useOrganization({allowNull: true});
  const showSuperuserWarning =
    hasPageFrame &&
    isActiveSuperuser() &&
    !ConfigStore.get('isSelfHosted') &&
    !HookStore.get('component:superuser-warning-excluded')[0]?.(organization);

  if (!hasPageFrame) {
    return '0px';
  }

  if (showSuperuserWarning) {
    return `${SUPERUSER_MARQUEE_HEIGHT}px`;
  }

  return '0px';
}
