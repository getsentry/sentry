import React from 'react';
import styled from '@emotion/styled';

import CheckboxFancy from 'app/components/checkboxFancy/checkboxFancy';
import DropdownControl from 'app/components/dropdownControl';
import List from 'app/components/list';
import ListItem from 'app/components/list/listItem';
import space from 'app/styles/space';

import DropDownButton from './dropDownButton';

type Option = {
  id: string;
  symbol: React.ReactElement;
  isChecked: boolean;
};

type Options = Record<string, Array<Option>>;

type Props = {
  options: Options;
  onFilter: (options: Options) => void;
  className?: string;
};

function Filter({options, onFilter, className}: Props) {
  const checkedQuantity = Object.values(options)
    .flatMap(option => option)
    .filter(option => option.isChecked).length;

  function handleClick(category: string, option: Option) {
    return function () {
      const updatedOptions = {
        ...options,
        [category]: options[category].map(groupedOption => {
          if (option.id === groupedOption.id) {
            return {
              ...groupedOption,
              isChecked: !groupedOption.isChecked,
            };
          }
          return groupedOption;
        }),
      };

      onFilter(updatedOptions);
    };
  }

  return (
    <Wrapper className={className}>
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
        <Content>
          {Object.keys(options).map(category => (
            <React.Fragment key={category}>
              <Header>{category}</Header>
              <List>
                {options[category].map(groupedOption => {
                  const {symbol, isChecked, id} = groupedOption;
                  return (
                    <StyledListItem
                      key={id}
                      onClick={handleClick(category, groupedOption)}
                      isChecked={isChecked}
                    >
                      {symbol}
                      <CheckboxFancy isChecked={isChecked} />
                    </StyledListItem>
                  );
                })}
              </List>
            </React.Fragment>
          ))}
        </Content>
      </DropdownControl>
    </Wrapper>
  );
}

export default Filter;

const Wrapper = styled('div')`
  position: relative;
  display: flex;
`;

const Content = styled('div')`
  > * :last-child {
    margin-bottom: -1px;
  }
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
  border-bottom: 1px solid ${p => p.theme.border};
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
