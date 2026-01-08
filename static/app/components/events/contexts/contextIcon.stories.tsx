import styled from '@emotion/styled';

import {Tooltip} from 'sentry/components/core/tooltip';
import {ContextIcon, NAMES} from 'sentry/components/events/contexts/contextIcon';
import * as Storybook from 'sentry/stories';
import {space} from 'sentry/styles/space';

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
  gap: ${space(1)};
  align-items: center;
`;

const Cell = styled('div')`
  display: flex;
  gap: ${space(1)};
  align-items: center;
  border: 1px solid transparent;
  border-radius: ${p => p.theme.radius.md};
  padding: ${space(1)};
  cursor: pointer;

  &:hover {
    border-color: ${p => p.theme.tokens.border.primary};
  }
`;
