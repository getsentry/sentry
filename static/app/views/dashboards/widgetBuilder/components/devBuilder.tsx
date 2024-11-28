import styled from '@emotion/styled';

import SelectField from 'sentry/components/forms/fields/selectField';
import Input from 'sentry/components/input';
import {space} from 'sentry/styles/space';
import {DisplayType} from 'sentry/views/dashboards/types';
import useWidgetBuilderState, {
  BuilderStateAction,
} from 'sentry/views/dashboards/widgetBuilder/hooks/useWidgetBuilderState';

function DevBuilder() {
  const {state, dispatch} = useWidgetBuilderState();

  return (
    <Body>
      <Section>
        <h1>Title:</h1>
        <div style={{flex: 1}}>{state.title}</div>
        <SimpleInput
          value={state.title}
          onChange={e =>
            dispatch({type: BuilderStateAction.SET_TITLE, payload: e.target.value})
          }
        />
      </Section>
      <Section>
        <h1>Description:</h1>
        <div style={{flex: 1}}>{state.description}</div>
        <SimpleInput
          value={state.description}
          onChange={e =>
            dispatch({
              type: BuilderStateAction.SET_DESCRIPTION,
              payload: e.target.value,
            })
          }
        />
      </Section>
      <Section>
        <h1>Display Type:</h1>
        <div style={{flex: 1}}>{state.displayType}</div>
        <SelectField
          name="displayType"
          value={state.displayType}
          options={Object.values(DisplayType).map(value => ({
            label: value,
            value,
          }))}
          onChange={newValue =>
            dispatch({
              type: BuilderStateAction.SET_DISPLAY_TYPE,
              payload: newValue,
            })
          }
          style={{width: '200px'}}
        />
      </Section>
    </Body>
  );
}

const Body = styled('div')`
  margin: ${space(2)};
  padding: ${space(2)};
`;

const Section = styled('section')`
  display: flex;
  flex-direction: row;
  justify-content: space-around;
  border: 1px solid ${p => p.theme.border};
  align-items: center;

  > * {
    flex: 1;
  }
`;

const SimpleInput = styled(Input)`
  width: 100%;
`;

export default DevBuilder;
