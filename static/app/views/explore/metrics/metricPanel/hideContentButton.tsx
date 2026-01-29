import {Button} from '@sentry/scraps/button';

import {t} from 'sentry/locale';
import type {TableOrientation} from 'sentry/views/explore/metrics/hooks/useOrientationControl';
import {HIDE_BUTTONS_BY_ORIENTATION} from 'sentry/views/explore/metrics/metricPanel/utils';

interface HideContentButtonProps {
  infoContentHidden: boolean;
  onToggle: () => void;
  orientation: TableOrientation;
}

export function HideContentButton({
  orientation,
  infoContentHidden,
  onToggle,
}: HideContentButtonProps) {
  const {IconShow, IconHide} = HIDE_BUTTONS_BY_ORIENTATION[orientation];
  const Icon = infoContentHidden ? IconShow : IconHide;

  return (
    <Button
      size="zero"
      priority="transparent"
      aria-label={infoContentHidden ? t('Show Table') : t('Hide Table')}
      icon={<Icon />}
      onClick={onToggle}
      title={infoContentHidden ? t('Show Table') : t('Hide Table')}
    />
  );
}
