import {useTheme} from '@emotion/react';

import {Checkbox} from '@sentry/scraps/checkbox';
import {Flex} from '@sentry/scraps/layout';
import {Tooltip} from '@sentry/scraps/tooltip';

import {t} from 'sentry/locale';
import {useWidgetBuilderContext} from 'sentry/views/dashboards/widgetBuilder/contexts/widgetBuilderContext';
import {BuilderStateAction} from 'sentry/views/dashboards/widgetBuilder/hooks/useWidgetBuilderState';
import {FieldValueKind} from 'sentry/views/discover/table/types';

export function LegendTypeSelector() {
  const theme = useTheme();
  const {state, dispatch} = useWidgetBuilderContext();

  const columns = state.fields?.filter(field => field.kind === FieldValueKind.FIELD);
  // Currently, the legned breakdown is only supported with one or fewer group-by columns
  // The logic to extract the right table data from the response is not yet implemented
  const disabled = (columns?.length ?? 0) > 1;

  return (
    <Tooltip
      title={t('Legend breakdown is only available with one or fewer group-by columns')}
      disabled={!disabled}
    >
      <Flex
        as="label"
        align="center"
        gap="sm"
        style={{
          marginTop: theme.space.md,
          cursor: disabled ? 'not-allowed' : 'pointer',
          color: disabled ? theme.tokens.content.disabled : undefined,
        }}
      >
        <Checkbox
          checked={state.legendType === 'breakdown'}
          disabled={disabled}
          onChange={e => {
            dispatch({
              type: BuilderStateAction.SET_LEGEND_TYPE,
              payload: e.target.checked ? 'breakdown' : undefined,
            });
          }}
        />
        {t('Show legend breakdown')}
      </Flex>
    </Tooltip>
  );
}
