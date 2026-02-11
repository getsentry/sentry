import {Fragment} from 'react';

import {Button} from '@sentry/scraps/button';

import {IconPanel} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {TableOrientation} from 'sentry/views/explore/metrics/hooks/useOrientationControl';

export function PanelPositionSelector({
  orientation,
  setOrientation,
  disabled,
}: {
  orientation: TableOrientation;
  setOrientation: (orientation: TableOrientation) => void;
  disabled?: boolean;
}) {
  return (
    <Fragment>
      <Button
        size="zero"
        aria-label={t('Table bottom')}
        icon={<IconPanel direction="down" />}
        priority="transparent"
        onClick={() => setOrientation('bottom')}
        disabled={disabled || orientation === 'bottom'}
        title={t('Table bottom')}
      />
      <Button
        size="zero"
        aria-label={t('Table right')}
        icon={<IconPanel direction="right" />}
        priority="transparent"
        onClick={() => setOrientation('right')}
        disabled={disabled || orientation === 'right'}
        title={t('Table right')}
      />
    </Fragment>
  );
}
