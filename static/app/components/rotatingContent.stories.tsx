import {Text} from '@sentry/scraps/text';

import RotatingContent from 'sentry/components/rotatingContent';
import * as Storybook from 'sentry/stories';

import NegativeSpaceContainer from './container/negativeSpaceContainer';

export default Storybook.story('RotatingContent', story => {
  story('Default', () => (
    <div>
      <p>
        The <Storybook.JSXNode name="RotatingContent" /> component cycles through its
        children with a smooth fade animation. This is useful for displaying rotating
        messages during loading states or long-running operations.
      </p>
      <NegativeSpaceContainer>
        <RotatingContent>
          <Text>Loading your data...</Text>
          <Text>Almost there...</Text>
          <Text>Just a moment longer...</Text>
          <Text>Thanks for your patience!</Text>
        </RotatingContent>
      </NegativeSpaceContainer>
    </div>
  ));

  story('With different content types', () => (
    <div>
      <p>
        The component accepts any React children, not just text. You can use it with
        complex components, styled elements, or mixed content.
      </p>
      <NegativeSpaceContainer>
        <RotatingContent>
          <div>
            <Text bold>Step 1</Text>
            <Text size="sm" variant="muted">
              Processing your request
            </Text>
          </div>
          <div>
            <Text bold>Step 2</Text>
            <Text size="sm" variant="muted">
              Analyzing data
            </Text>
          </div>
          <div>
            <Text bold>Step 3</Text>
            <Text size="sm" variant="muted">
              Finalizing results
            </Text>
          </div>
        </RotatingContent>
      </NegativeSpaceContainer>
    </div>
  ));

  story('Single child', () => (
    <div>
      <p>When only one child is provided, it displays without rotation.</p>
      <NegativeSpaceContainer>
        <RotatingContent>
          <Text>Only one message</Text>
        </RotatingContent>
      </NegativeSpaceContainer>
    </div>
  ));
});
