import styled from '@emotion/styled';

import Input from 'sentry/components/input';
import {space} from 'sentry/styles/space';
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
        <TitleInput
          value={state.title}
          onChange={e =>
            dispatch({type: BuilderStateAction.SET_TITLE, payload: e.target.value})
          }
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
  justify-content: space-between;
  border: 1px solid ${p => p.theme.border};
  align-items: center;
`;

const TitleInput = styled(Input)`
  width: 100%;
  flex: 1;
`;

export default DevBuilder;
