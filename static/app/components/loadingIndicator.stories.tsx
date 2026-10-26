import {Spinner} from '@sentry/scraps/spinner';

import * as Storybook from 'sentry/stories';

import {NegativeSpaceContainer} from './container/negativeSpaceContainer';

export default Storybook.story('Spinner', story => {
  story('Default', () => (
    <div>
      <p>
        Setting custom size on <Storybook.JSXProperty name="size" value={24} /> will cause
        the border width to scale proportionally with the size of the loading indicator.
      </p>
      <NegativeSpaceContainer>
        <Storybook.SideBySide>
          <Spinner />
          <Spinner size={48} />
          <Spinner size={24} />
        </Storybook.SideBySide>
      </NegativeSpaceContainer>
    </div>
  ));

  story('Loading text', () => (
    <NegativeSpaceContainer>
      <Spinner>Loading...</Spinner>
    </NegativeSpaceContainer>
  ));
});
