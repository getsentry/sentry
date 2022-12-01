import {Fragment} from 'react';
import styled from '@emotion/styled';

import DropdownButton from 'sentry/components/dropdownButton';
import space from 'sentry/styles/space';

type Props = {
  content: React.ReactNode;
  items: (() => React.ReactNode)[];
  selectedIndex: number;
  setSelectedIndex: (index: number) => void;
  radioColor?: string;
};

export default function Accordion(props: Props) {
  return (
    <AccordionContainer>
      {props.items.map((item, index) => (
        <AccordionItem
          {...props}
          isSelected={index === props.selectedIndex}
          currentIndex={index}
          key={index}
          content={props.content}
        >
          {item()}
        </AccordionItem>
      ))}
    </AccordionContainer>
  );
}

function AccordionItem({
  isSelected,
  currentIndex: index,
  children,
  setSelectedIndex,
  content,
}: {
  children: React.ReactNode;
  content: React.ReactNode;
  currentIndex: number;
  isSelected: boolean;
} & Props) {
  return (
    <Fragment>
      <ListItemContainer>
        {children}
        <StyledDropdownButton
          size="zero"
          borderless
          onClick={() => setSelectedIndex(index)}
          isOpen={isSelected}
        />
      </ListItemContainer>
      <StyledContentContainer>{isSelected && content}</StyledContentContainer>
    </Fragment>
  );
}

const AccordionContainer = styled('div')`
  padding-top: ${space(1)};
`;

const StyledDropdownButton = styled(DropdownButton)`
  svg {
    margin-left: 0;
  }
`;

const ListItemContainer = styled('div')`
  display: flex;
  border-top: 1px solid ${p => p.theme.border};
  padding: ${space(1)} ${space(2)};
  font-size: ${p => p.theme.fontSizeMedium};
`;

const StyledContentContainer = styled('div')`
  padding: ${space(0)} ${space(2)};
`;
