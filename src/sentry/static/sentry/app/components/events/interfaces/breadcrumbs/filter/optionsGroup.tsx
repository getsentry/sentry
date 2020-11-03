import React from 'react';
import styled from '@emotion/styled';

import {t} from 'app/locale';
import space from 'app/styles/space';
import CheckboxFancy from 'app/components/checkboxFancy/checkboxFancy';

import {Option} from './types';

type Type = 'type' | 'level';

type Props = {
  options: Array<Option>;
  type: Type;
  onClick: (type: Type, option: Option) => void;
};

const OptionsGroup = ({type, options, onClick}: Props) => {
  const handleClick = (option: Option) => (event: React.MouseEvent<HTMLLIElement>) => {
    event.stopPropagation();
    onClick(type, option);
  };

  return (
    <div>
      <Header>{type === 'type' ? t('Type') : t('Level')}</Header>
      <List>
        {options.map(option => (
          <ListItem
            key={option.type}
            isChecked={option.isChecked}
            onClick={handleClick(option)}
          >
            {option.symbol}
            <ListItemDescription>{option.description}</ListItemDescription>
            <CheckboxFancy isChecked={option.isChecked} />
          </ListItem>
        ))}
      </List>
    </div>
  );
};

export default OptionsGroup;

const Header = styled('div')`
  display: flex;
  align-items: center;
  margin: 0;
  background-color: ${p => p.theme.gray100};
  color: ${p => p.theme.gray500};
  font-weight: normal;
  font-size: ${p => p.theme.fontSizeMedium};
  padding: ${space(1)} ${space(2)};
  border-bottom: 1px solid ${p => p.theme.border};
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
  border-bottom: 1px solid ${p => p.theme.border};
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
    color: ${p => p.theme.blue400};
    text-decoration: underline;
  }
`;

const ListItemDescription = styled('div')`
  font-size: ${p => p.theme.fontSizeMedium};
`;
