import {Fragment, useCallback} from 'react';

import {Button} from '@sentry/scraps/button';

import {IconPanel} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {TableOrientation} from 'sentry/views/explore/metrics/hooks/useOrientationControl';
import {
  useMetricVisualize,
  useSetMetricVisualize,
} from 'sentry/views/explore/metrics/metricsQueryParams';

export function PanelPositionSelector({
  orientation,
  disabled,
}: {
  orientation: TableOrientation;
  disabled?: boolean;
}) {
  const visualize = useMetricVisualize();
  const setVisualize = useSetMetricVisualize();

  const setOrientation = useCallback(
    (newOrientation: TableOrientation) => {
      setVisualize(
        visualize.replace({
          tableConfig: {
            ...visualize.tableConfig,
            orientation: newOrientation,
          },
        })
      );
    },
    [setVisualize, visualize]
  );

  return (
    <Fragment>
      <Button
        size="zero"
        aria-label={t('Table bottom')}
        icon={<IconPanel direction="down" />}
        borderless
        onClick={() => setOrientation('bottom')}
        disabled={disabled || orientation === 'bottom'}
        title={t('Table bottom')}
      />
      <Button
        size="zero"
        aria-label={t('Table right')}
        icon={<IconPanel direction="right" />}
        borderless
        onClick={() => setOrientation('right')}
        disabled={disabled || orientation === 'right'}
        title={t('Table right')}
      />
    </Fragment>
  );
}
