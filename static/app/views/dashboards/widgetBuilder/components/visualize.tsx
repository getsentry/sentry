import styled from '@emotion/styled';
import {Fragment} from 'react';
import {CompactSelect} from 'sentry/components/compactSelect';
import {Button} from 'sentry/components/button';
import {IconDelete} from 'sentry/icons';
import {t} from 'sentry/locale';
import {SectionHeader} from 'sentry/views/dashboards/widgetBuilder/components/sectionHeader';
import Input from 'sentry/components/input';
import {useWidgetBuilderContext} from 'sentry/views/dashboards/widgetBuilder/contexts/widgetBuilderContext';
import {BuilderStateAction} from 'sentry/views/dashboards/widgetBuilder/hooks/useWidgetBuilderState';
import {space} from 'sentry/styles/space';
import {DisplayType} from 'sentry/views/dashboards/types';

function Visualize() {
  const {state, dispatch} = useWidgetBuilderContext();
  const fields = [DisplayType.TABLE, DisplayType.BIG_NUMBER].includes(
    state.displayType ?? DisplayType.TABLE
  )
    ? state.fields
    : state.yAxis;

  return (
    <Fragment>
      <SectionHeader
        title={t('Visualize')}
        tooltipText={t('Select the stuff to visualize')}
      />
      <Fields>
        {fields?.map((_, index) => (
          <FieldRow key={index}>
            <FieldBar>
              <ColumnCompactSelect
                searchable
                options={[]}
                value={''}
                onChange={newField => {}}
                className="dropdown"
              />
              <AggregateCompactSelect
                options={[]}
                value={''}
                onChange={newAggregate => {}}
                className="dropdown"
              />
            </FieldBar>
            <Blah>
              <LegendAliasInput
                type="text"
                name="name"
                placeholder={t('Add Alias')}
                onChange={() => {}}
              />
              <StyledDeleteButton
                borderless
                icon={<IconDelete />}
                size="zero"
                disabled={false} // TODO
                onClick={() =>
                  dispatch({
                    type: BuilderStateAction.SET_Y_AXIS,
                    payload: state.yAxis?.filter((_, i) => i !== index) ?? [],
                  })
                }
                aria-label={t('Remove Overlay')}
              />
            </Blah>
          </FieldRow>
        ))}
      </Fields>

      <AddButtons>
        <AddButton
          priority="link"
          aria-label={t('Add Series')}
          onClick={() =>
            dispatch({
              type: BuilderStateAction.SET_Y_AXIS,
              payload: [
                ...(state.yAxis ?? []),
                {
                  function: ['count', '', undefined, undefined],
                  kind: 'function',
                },
              ],
            })
          }
          data-test-id={'add-series'}
        >
          {t('+ Add Series')}
        </AddButton>
        <AddButton
          priority="link"
          aria-label={t('Add Equation')}
          onClick={() => {}}
          data-test-id={'add-equation'}
        >
          {t('+ Add Equation')}
        </AddButton>
      </AddButtons>
    </Fragment>
  );
}

export default Visualize;

const ColumnCompactSelect = styled(CompactSelect)`
  flex: 1 1 auto;
  min-width: 0;

  > button {
    width: 100%;
  }
`;

const AggregateCompactSelect = styled(CompactSelect)`
  width: 100px;

  > button {
    width: 100%;
  }
`;

const LegendAliasInput = styled(Input)``;

const FieldBar = styled('div')`
  display: flex;
  flex: 3;

  & > ${ColumnCompactSelect} > button {
    border-top-right-radius: 0;
    border-bottom-right-radius: 0;
  }

  & > ${AggregateCompactSelect} > button {
    border-top-left-radius: 0;
    border-bottom-left-radius: 0;
    margin-left: -1px;
  }
`;

const FieldRow = styled('div')`
  display: flex;
  flex-direction: row;
  gap: ${space(1)};
`;

const StyledDeleteButton = styled(Button)``;

const Blah = styled('div')`
  display: flex;
  flex-direction: row;
  gap: ${space(1)};
  flex: 1;
`;

const AddButton = styled(Button)`
  margin-top: ${space(1)};
`;

const AddButtons = styled('div')`
  display: inline-flex;
  gap: ${space(1.5)};
`;

const Fields = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(1)};
`;
