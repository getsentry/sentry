import {ReactElement} from 'react';
import styled from '@emotion/styled';

import {IconChevron} from 'sentry/icons';
import {space} from 'sentry/styles/space';

type Props = {
  items: ReactElement[];
};

const ChevronDividedList = ({items}: Props) => {
  return (
    <List>
      {items.flatMap((item, i) => {
        const li = <Item key={`${i}-item`}>{item}</Item>;

        return i === 0
          ? li
          : [
              <Item key={`${i}-chev`} role="separator">
                <Chevron>
                  <IconChevron color="gray500" size="xs" direction="right" />
                </Chevron>
              </Item>,
              li,
            ];
      })}
    </List>
  );
};

const List = styled('ul')`
  padding: 0;
  margin: 0;
  list-style: none;
  display: flex;
  gap: ${space(0.75)};
  flex-wrap: nowrap;
  align-items: center;
  overflow: hidden;
`;

const Item = styled('li')`
  display: flex;
  flex-direction: column;
  overflow: hidden;
  flex-shrink: 0;

  &:first-child,
  &:last-child {
    flex-shrink: 1;
  }
`;

const Chevron = styled('span')`
  font-size: ${p => p.theme.fontSizeMedium};
  line-height: 1;
`;

export default ChevronDividedList;
