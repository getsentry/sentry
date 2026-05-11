import styled from '@emotion/styled';

import {Tooltip} from '@sentry/scraps/tooltip';

import {ContextIcon, NAMES} from 'sentry/components/events/contexts/contextIcon';
import * as Storybook from 'sentry/stories';

export default Storybook.story('ContextIcon', story => {
  story('All', () => (
    <Grid
      style={{
        gridAutoFlow: 'column',
        gridTemplateRows: `repeat(${Math.ceil(NAMES.length / 4)}, 1fr)`,
      }}
    >
      {NAMES.map(name => {
        const props = {name, size: 'xl' as const};
        return (
          <Tooltip
            key={name}
            isHoverable
            overlayStyle={{maxWidth: 440}}
            title={<Storybook.JSXNode name="ContextIcon" props={props} />}
          >
            <Cell>
              <ContextIcon {...props} />
              {name}
            </Cell>
          </Tooltip>
        );
      })}
    </Grid>
  ));
});

const Grid = styled('div')`
  display: grid;
  gap: ${p => p.theme.space.md};
  align-items: center;
`;

const Cell = styled('div')`
  display: flex;
  gap: ${p => p.theme.space.md};
  align-items: center;
  border: 1px solid transparent;
  border-radius: ${p => p.theme.radius.md};
  padding: ${p => p.theme.space.md};
  cursor: pointer;

  &:hover {
    border-color: ${p => p.theme.tokens.border.primary};
  }
`;
