import React from 'react';
import styled from '@emotion/styled';

import CheckboxFancy from 'app/components/checkboxFancy/checkboxFancy';
import DropdownControl from 'app/components/dropdownControl';
import List from 'app/components/list';
import ListItem from 'app/components/list/listItem';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {ImageStatus} from 'app/types/debugImage';

import DropDownButton from './dropDownButton';

type Option = {
  id: ImageStatus;
  symbol: React.ReactElement;
  isChecked: boolean;
};

type Props = {
  options: Array<Option>;
  onFilter: (options: Array<Option>) => void;
};

function Filter({options, onFilter}: Props) {
  function handleClick(option: Option) {
    return function () {
      const updatedOptions = options.map(opt => {
        if (option.id === opt.id) {
          return {
            ...opt,
            isChecked: !opt.isChecked,
          };
        }
        return opt;
      });

      onFilter(updatedOptions);
    };
  }

  const checkedQuantity = options.filter(option => option.isChecked).length;

  return (
    <Wrapper>
      <DropdownControl
        menuWidth="240px"
        blendWithActor
        button={({isOpen, getActorProps}) => (
          <DropDownButton
            isOpen={isOpen}
            getActorProps={getActorProps}
            checkedQuantity={checkedQuantity}
          />
        )}
      >
        <Header>{t('Status')}</Header>
        <List>
          {options.map(option => {
            const {symbol, isChecked, id} = option;
            return (
              <StyledListItem
                key={id}
                onClick={handleClick(option)}
                isChecked={isChecked}
              >
                {symbol}
                <CheckboxFancy isChecked={isChecked} />
              </StyledListItem>
            );
          })}
        </List>
      </DropdownControl>
    </Wrapper>
  );
}

export default Filter;

const Wrapper = styled('div')`
  position: relative;
  display: flex;
`;

const Header = styled('div')`
  display: flex;
  align-items: center;
  margin: 0;
  background-color: ${p => p.theme.backgroundSecondary};
  color: ${p => p.theme.gray300};
  font-weight: normal;
  font-size: ${p => p.theme.fontSizeMedium};
  padding: ${space(1)} ${space(2)};
  border-bottom: 1px solid ${p => p.theme.border};
`;

const StyledListItem = styled(ListItem)<{isChecked: boolean}>`
  display: grid;
  grid-template-columns: 1fr max-content;
  grid-column-gap: ${space(1)};
  padding: ${space(1)} ${space(2)};
  align-items: center;
  cursor: pointer;
  :not(:last-child) {
    border-bottom: 1px solid ${p => p.theme.border};
  }

  ${CheckboxFancy} {
    opacity: ${p => (p.isChecked ? 1 : 0.3)};
  }

  :hover {
    background-color: ${p => p.theme.backgroundSecondary};
    ${CheckboxFancy} {
      opacity: 1;
    }
    span {
      color: ${p => p.theme.blue300};
      text-decoration: underline;
    }
  }
`;
