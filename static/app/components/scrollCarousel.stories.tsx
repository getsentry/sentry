import {Fragment} from 'react';
import {css, useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import * as Storybook from 'sentry/stories';

import {ScrollCarousel} from './scrollCarousel';

export default Storybook.story('ScrollCarousel', story => {
  const theme = useTheme();
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
            gap: ${theme.space.md};
          `}
        >
          {['one', 'two', 'three', 'four', 'five', 'six'].map(item => (
            <ExampleItem key={item}>{item}</ExampleItem>
          ))}
        </ScrollCarousel>
      </div>
    </Fragment>
  ));

  story('Vertical', () => (
    <Fragment>
      <p>
        Vertical lists are also supported with{' '}
        <Storybook.JSXProperty name="orientation" value="vertical" />.
      </p>
      <div style={{width: '240px', height: '160px', display: 'block'}}>
        <ScrollCarousel
          aria-label="vertical-example"
          orientation="vertical"
          css={css`
            gap: ${theme.space.md};
          `}
        >
          {['alpha', 'beta', 'gamma', 'delta', 'epsilon', 'zeta', 'eta'].map(item => (
            <ExampleItem key={item}>{item}</ExampleItem>
          ))}
        </ScrollCarousel>
      </div>
    </Fragment>
  ));
});

const ExampleItem = styled('div')`
  min-width: 100px;
  min-height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid ${p => p.theme.tokens.border.primary};
  border-radius: ${p => p.theme.radius.md};
  background-color: ${p => p.theme.tokens.background.secondary};

  &:hover {
    background-color: ${p => p.theme.tokens.background.tertiary};
  }
`;
