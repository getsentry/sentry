import {Checkbox} from '@sentry/scraps/checkbox';
import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {t} from 'sentry/locale';
import {useWidgetBuilderContext} from 'sentry/views/dashboards/widgetBuilder/contexts/widgetBuilderContext';
import {BuilderStateAction} from 'sentry/views/dashboards/widgetBuilder/hooks/useWidgetBuilderState';

export function LegendTypeSelector() {
  const {state, dispatch} = useWidgetBuilderContext();

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
