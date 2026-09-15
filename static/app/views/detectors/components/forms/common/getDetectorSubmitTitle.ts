import {t} from 'sentry/locale';

export function getDetectorSubmitTitle(
  {isIncomplete, isValid}: {isIncomplete: boolean; isValid: boolean},
  disabledReason?: string
) {
  if (disabledReason) {
    return disabledReason;
  }
  if (isIncomplete) {
    return t('Required fields must be filled out');
  }
  return isValid ? undefined : t('Fields must contain valid inputs');
}
