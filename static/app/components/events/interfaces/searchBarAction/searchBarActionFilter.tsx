import {Fragment} from 'react';
import styled from '@emotion/styled';

import CheckboxFancy from 'sentry/components/checkboxFancy/checkboxFancy';
import DropdownControl, {Content} from 'sentry/components/dropdownControl';
import List from 'sentry/components/list';
import ListItem from 'sentry/components/list/listItem';
import space from 'sentry/styles/space';

import DropDownButton from './dropDownButton';

type Option = {
  id: string;
  isChecked: boolean;
  symbol: React.ReactElement;
  description?: string;
};

type Options = Record<string, Array<Option>>;

type Props = {
  onChange: (options: Options) => void;
  options: Options;
};

function SearchBarActionFilter({options, onChange}: Props) {
  const checkedQuantity = Object.values(options)
    .flatMap(option => option)
    .filter(option => option.isChecked).length;

  function handleClick(category: string, option: Option) {
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

    onChange(updatedOptions);
  }

  return (
    <Wrapper>
      <DropdownControl
        button={({isOpen, getActorProps}) => (
          <DropDownButton
            isOpen={isOpen}
            getActorProps={getActorProps}
            checkedQuantity={checkedQuantity}
          />
        )}
      >
        {({getMenuProps, isOpen}) => (
          <StyledContent
            {...getMenuProps()}
            data-test-id="filter-dropdown-menu"
            alignMenu="left"
            width="240px"
            isOpen={isOpen}
            blendWithActor
            blendCorner
          >
            {Object.keys(options).map(category => (
              <Fragment key={category}>
                <Header>{category}</Header>
                <StyledList>
                  {options[category].map(groupedOption => {
                    const {symbol, isChecked, id, description} = groupedOption;
                    return (
                      <StyledListItem
                        key={id}
                        onClick={event => {
                          event.stopPropagation();
                          handleClick(category, groupedOption);
                        }}
                        isChecked={isChecked}
                        hasDescription={!!description}
                      >
                        {symbol}
                        {description && <Description>{description}</Description>}
                        <CheckboxFancy isChecked={isChecked} />
                      </StyledListItem>
                    );
                  })}
                </StyledList>
              </Fragment>
            ))}
          </StyledContent>
        )}
      </DropdownControl>
    </Wrapper>
  );
}

export default SearchBarActionFilter;

const Wrapper = styled('div')`
  position: relative;
  display: flex;
`;

const StyledContent = styled(Content)`
  top: calc(100% + ${space(0.5)} - 1px);
  border-radius: ${p => p.theme.borderRadius};
  > ul:last-child {
    > li:last-child {
      border-bottom: none;
    }
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

const StyledList = styled(List)`
  gap: 0;
`;

const StyledListItem = styled(ListItem, {
  shouldForwardProp: prop =>
    typeof prop === 'string' && !['hasDescription', 'isChecked'].includes(prop),
})<{hasDescription: boolean; isChecked: boolean}>`
  display: grid;
  grid-template-columns: ${p =>
    p.hasDescription ? 'max-content 1fr max-content' : '1fr max-content'};
  grid-column-gap: ${space(1)};
  padding: ${space(1)} ${space(2)};
  border-bottom: 1px solid ${p => p.theme.border};
  align-items: center;
  cursor: pointer;
  ${CheckboxFancy} {
    opacity: ${p => (p.isChecked ? 1 : 0.3)};
  }

  :hover {
    background-color: ${p => p.theme.backgroundSecondary};
    ${CheckboxFancy} {
      opacity: 1;
    }
  }
`;

const Description = styled('div')`
  font-size: ${p => p.theme.fontSizeMedium};
`;
