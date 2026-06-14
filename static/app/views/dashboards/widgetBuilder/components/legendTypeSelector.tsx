import {Checkbox} from '@sentry/scraps/checkbox';
import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {t} from 'sentry/locale';
import {
  useWidgetBuilderDispatch,
  useWidgetBuilderStateSlice,
} from 'sentry/views/dashboards/widgetBuilder/contexts/widgetBuilderContext';
import {BuilderStateAction} from 'sentry/views/dashboards/widgetBuilder/hooks/useWidgetBuilderState';

export function LegendTypeSelector() {
  const state = useWidgetBuilderStateSlice('legendType');
  const dispatch = useWidgetBuilderDispatch();

  return (
    <Flex as="label" align="center" gap="sm" cursor="pointer">
      <Checkbox
        checked={state.legendType === 'breakdown'}
        onChange={e => {
          dispatch({
            type: BuilderStateAction.SET_LEGEND_TYPE,
            payload: e.target.checked ? 'breakdown' : undefined,
          });
        }}
      />
      <Text>{t('Show legend breakdown')}</Text>
    </Flex>
  );
}
