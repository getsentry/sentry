import styled from '@emotion/styled';

import ContextIcon, {NAMES} from 'sentry/components/events/contexts/contextIcon';
import JSXNode from 'sentry/components/stories/jsxNode';
import {Tooltip} from 'sentry/components/tooltip';
import storyBook from 'sentry/stories/storyBook';
import {space} from 'sentry/styles/space';

export default storyBook('ContextIcon', story => {
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
            title={<JSXNode name="ContextIcon" props={props} />}
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
  border-radius: ${p => p.theme.borderRadius};
  padding: ${space(1)};
  cursor: pointer;

  &:hover {
    border-color: ${p => p.theme.border};
  }
`;
