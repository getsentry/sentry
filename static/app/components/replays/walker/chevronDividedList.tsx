import {ReactElement} from 'react';
import styled from '@emotion/styled';

import {IconChevron} from 'sentry/icons';
import space from 'sentry/styles/space';

type Props = {
  items: ReactElement[];
};

function ChevronDividedList({items}: Props) {
  return (
    <List cols={items.length}>
      {items.flatMap((item, i) => {
        const li = <Item key={`${i}-item`}>{item}</Item>;

        return i === 0
          ? li
          : [
              <Item key={`${i}-chev`}>
                <Chevron>
                  <IconChevron color="gray300" size="sm" direction="right" />
                </Chevron>
              </Item>,
              li,
            ];
      })}
    </List>
  );
}

const List = styled('ul')<{cols: number}>`
  padding: 0;
  margin: 0;
  list-style: none;
  display: grid;
  gap: ${space(1)};
  grid-template-columns: ${p =>
    `minmax(auto, max-content) repeat(${
      (p.cols - 2) * 2 + 1
    }, max-content) minmax(auto, max-content)`};
  flex-wrap: nowrap;
  align-items: center;
  overflow: hidden;
`;

const Item = styled('li')`
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;

const Chevron = styled('span')`
  color: ${p => p.theme.gray300};
  font-size: ${p => p.theme.fontSizeSmall};
  line-height: 1;
`;

export default ChevronDividedList;
