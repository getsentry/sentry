import React from 'react';
import styled from '@emotion/styled';

import space from 'app/styles/space';
import CheckboxFancy from 'app/components/checkboxFancy/checkboxFancy';

import {FilterType, FilterGroupType, FilterGroup} from './types';

type Props = {
  groupHeaderTitle: string;
  data: Array<FilterGroup>;
  onClick: (type: FilterType, groupType: FilterGroupType) => void;
};

const Group = ({groupHeaderTitle, data, onClick}: Props) => {
  const handleClick = (type: FilterType, groupType: FilterGroupType) => (
    event: React.MouseEvent<HTMLLIElement>
  ) => {
    event.stopPropagation();
    onClick(type, groupType);
  };

  return (
    <div>
      <Header>{groupHeaderTitle}</Header>
      <List>
        {data.map(({type, groupType, description, isChecked, symbol}) => (
          <ListItem
            key={type}
            isChecked={isChecked}
            onClick={handleClick(type, groupType)}
          >
            {symbol}
            <ListItemDescription>{description}</ListItemDescription>
            <CheckboxFancy isChecked={isChecked} />
          </ListItem>
        ))}
      </List>
    </div>
  );
};

export {Group};

const Header = styled('div')`
  display: flex;
  align-items: center;
  margin: 0;
  background-color: ${p => p.theme.gray100};
  color: ${p => p.theme.gray2};
  font-weight: normal;
  font-size: ${p => p.theme.fontSizeMedium};
  padding: ${space(1)} ${space(2)};
  border-bottom: 1px solid ${p => p.theme.borderDark};
`;

const List = styled('ul')`
  list-style: none;
  margin: 0;
  padding: 0;
`;

const ListItem = styled('li')<{isChecked?: boolean}>`
  display: grid;
  grid-template-columns: max-content 1fr max-content;
  grid-column-gap: ${space(1)};
  align-items: center;
  padding: ${space(1)} ${space(2)};
  border-bottom: 1px solid ${p => p.theme.borderDark};
  cursor: pointer;
  :hover {
    background-color: ${p => p.theme.gray100};
  }
  ${CheckboxFancy} {
    opacity: ${p => (p.isChecked ? 1 : 0.3)};
  }

  &:hover ${CheckboxFancy} {
    opacity: 1;
  }

  &:hover span {
    color: ${p => p.theme.blue};
    text-decoration: underline;
  }
`;

const ListItemDescription = styled('div')`
  font-size: ${p => p.theme.fontSizeMedium};
`;
