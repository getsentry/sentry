import {Fragment} from 'react';
import styled from '@emotion/styled';

import * as Storybook from 'sentry/stories';
import {space} from 'sentry/styles/space';

import InteractionStateLayer from './';

export default Storybook.story('InteractionStateLayer', story => {
  story('Getting Started', () => {
    return (
      <Fragment>
        <p>
          <Storybook.JSXNode name="InteractionStateLayer" /> is a visual component that
          adds a visible hover and active state.{' '}
          <Storybook.JSXNode name="InteractionStateLayer" />. It uses opacity to manage
          the visual state, which is more mindful of contrast requirements. Our own
          components (e.g., <code>Button</code>, <code>Checkbox</code>, etc.) use{' '}
          <Storybook.JSXNode name="InteractionStateLayer" /> under the hood. Here is an
          example of a <Storybook.JSXNode name="Panel" /> with an interaction state, and
          one without:
        </p>

        <Storybook.SideBySide>
          <StyledPanel tabIndex={1}>
            <InteractionStateLayer />
            <Activity />
          </StyledPanel>

          <StyledPanel tabIndex={1}>
            <Activity />
          </StyledPanel>
        </Storybook.SideBySide>
      </Fragment>
    );
  });

  story('Manual State', () => {
    return (
      <p>
        <Storybook.JSXNode name="InteractionStateLayer" /> uses normal CSS selectors for
        hover and focus to add the visual effect. If this is not suitable, you can
        manually set the <code>isHovered</code> and <code>isPressed</code> props.
      </p>
    );
  });
});

const StyledPanel = styled('div')`
  position: relative;
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.radius.md};
  padding: ${space(1)};
  max-width: 300px;
`;

function Activity() {
  return (
    <Fragment>
      <h3>Summary of Activity</h3>
      <p>
        In the last three days you drank 7 bottles of ketchup, ate 67 jars of mayo, and
        smelled 0.5 tablespoons of mustard. Relish stats are not available.
      </p>
    </Fragment>
  );
}
