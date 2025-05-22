import {Fragment} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import * as Storybook from 'sentry/stories';
import {space} from 'sentry/styles/space';

import {ScrollCarousel} from './scrollCarousel';

export default Storybook.story('ScrollCarousel', story => {
  story('Default', () => (
    <Fragment>
      <p>
        <Storybook.JSXNode name="ScrollCarousel" /> will detect if the content overflows
        and show arrows to scroll left and right. Native scrollbars are hidden.
      </p>
      <div style={{width: '375px', display: 'block'}}>
        <ScrollCarousel
          aria-label="example"
          css={css`
            gap: ${space(1)};
          `}
        >
          {['one', 'two', 'three', 'four', 'five', 'six'].map(item => (
            <ExampleItem key={item}>{item}</ExampleItem>
          ))}
        </ScrollCarousel>
      </div>
    </Fragment>
  ));
});

const ExampleItem = styled('div')`
  min-width: 100px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  background-color: ${p => p.theme.backgroundSecondary};

  &:hover {
    background-color: ${p => p.theme.backgroundTertiary};
  }
`;
