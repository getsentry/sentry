import {Fragment} from 'react';
import {components} from 'react-select';
import styled from '@emotion/styled';

import SelectControl from 'sentry/components/forms/controls/selectControl';
import {Tooltip} from 'sentry/components/tooltip';
import {IconGraph, IconNumber, IconTable} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {DisplayType} from 'sentry/views/dashboards/types';
import {useWidgetBuilderContext} from 'sentry/views/dashboards/widgetBuilder/contexts/widgetBuilderContext';
import {BuilderStateAction} from 'sentry/views/dashboards/widgetBuilder/hooks/useWidgetBuilderState';

const typeIcons = {
  [DisplayType.AREA]: <IconGraph key="area" type="area" />,
  [DisplayType.BAR]: <IconGraph key="bar" type="bar" />,
  [DisplayType.LINE]: <IconGraph key="line" type="line" />,
  [DisplayType.TABLE]: <IconTable key="table" />,
  [DisplayType.BIG_NUMBER]: <IconNumber key="number" />,
};

const displayTypes = {
  [DisplayType.AREA]: t('Area'),
  [DisplayType.BAR]: t('Bar'),
  [DisplayType.LINE]: t('Line'),
  [DisplayType.TABLE]: t('Table'),
  [DisplayType.BIG_NUMBER]: t('Big Number'),
};

function WidgetBuilderTypeSelector() {
  const {state, dispatch} = useWidgetBuilderContext();

  return (
    <Fragment>
      <Tooltip
        title={t('This is the type of visualization (ex. line chart)')}
        position="right-end"
        delay={200}
        isHoverable
        showUnderline
      >
        <Header>{t('Type')}</Header>
      </Tooltip>
      <SelectControl
        name="displayType"
        value={state.displayType}
        options={Object.keys(displayTypes).map(value => ({
          leadingItems: typeIcons[value],
          label: displayTypes[value],
          value,
        }))}
        clearable={false}
        onChange={newValue => {
          dispatch({
            type: BuilderStateAction.SET_DISPLAY_TYPE,
            payload: newValue.value,
          });
          if (
            (newValue.value === DisplayType.TABLE ||
              newValue.value === DisplayType.BIG_NUMBER) &&
            state.query?.length
          ) {
            dispatch({
              type: BuilderStateAction.SET_QUERY,
              payload: [state.query[0]],
            });
          }
        }}
        components={{
          SingleValue: containerProps => {
            return (
              <components.SingleValue {...containerProps}>
                <SelectionWrapper>
                  {containerProps.data.leadingItems}
                  {containerProps.children}
                </SelectionWrapper>
              </components.SingleValue>
            );
          },
        }}
      />
    </Fragment>
  );
}

export default WidgetBuilderTypeSelector;

const SelectionWrapper = styled('div')`
  display: flex;
  gap: ${space(1)};
`;

const Header = styled('h6')`
  font-size: ${p => p.theme.fontSizeLarge};
  margin-bottom: ${space(1)};
`;
