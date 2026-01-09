import {Fragment, useState} from 'react';
import documentation from '!!type-loader!sentry/components/core/input/numberDragInput';
import styled from '@emotion/styled';

import {NumberDragInput} from 'sentry/components/core/input/numberDragInput';
import * as Storybook from 'sentry/stories';

export default Storybook.story('NumberDragInput', (story, APIReference) => {
  APIReference(documentation.props?.NumberDragInput);

  story('Default', () => {
    const [horizontalValue, setHorizontalValue] = useState(10);
    const [verticalValue, setVerticalValue] = useState(10);

    return (
      <Fragment>
        <p>
          The <Storybook.JSXNode name="NumberDragInput" /> component allows users to enter
          numeric values either by typing or by clicking and dragging. Click and hold the
          arrows on the right side of the input to drag and adjust the value. Holding
          shift while dragging will increase the step size by a factor of 10 (can be
          modified by passing a `shiftKeyMultiplier` prop).
        </p>
        <Storybook.SideBySide>
          <Label>
            Horizontal
            <NumberDragInput
              onChange={e => setHorizontalValue(Number(e.target.value))}
              min={0}
              max={100}
              value={horizontalValue}
              placeholder="None"
              axis="x"
            />
          </Label>
          <Label>
            Vertical
            <NumberDragInput
              onChange={e => setVerticalValue(Number(e.target.value))}
              min={0}
              max={100}
              value={verticalValue}
              placeholder="None"
              axis="y"
            />
          </Label>
        </Storybook.SideBySide>
        <Storybook.SideBySide>
          <Label>
            Horizontal uncontrolled
            <NumberDragInput
              min={0}
              max={100}
              defaultValue={horizontalValue}
              placeholder="None"
              axis="x"
            />
          </Label>
          <Label>
            Vertical uncontrolled
            <NumberDragInput
              min={0}
              max={100}
              defaultValue={verticalValue}
              placeholder="None"
              axis="y"
            />
          </Label>
        </Storybook.SideBySide>
      </Fragment>
    );
  });
});

const Label = styled('div')`
  font-size: ${p => p.theme.font.size.sm};
  color: ${p => p.theme.tokens.content.secondary};
`;
