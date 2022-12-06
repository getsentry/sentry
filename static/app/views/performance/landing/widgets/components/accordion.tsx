import {ReactNode} from 'react';
import styled from '@emotion/styled';

import DropdownButton from 'sentry/components/dropdownButton';
import space from 'sentry/styles/space';

type Props = {
  content: ReactNode;
  items: (() => ReactNode)[];
  selectedIndex: number;
  setSelectedIndex: (index: number) => void;
};

export default function Accordion({
  content,
  items,
  selectedIndex,
  setSelectedIndex,
}: Props) {
  return (
    <AccordionContainer>
      {items.map((item, index) => (
        <AccordionItem
          isSelected={index === selectedIndex}
          currentIndex={index}
          key={index}
          content={content}
          setSelectedIndex={setSelectedIndex}
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
  children: ReactNode;
  content: ReactNode;
  currentIndex: number;
  isSelected: boolean;
  setSelectedIndex: (index: number) => void;
}) {
  return (
    <StyledLineItem>
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
    </StyledLineItem>
  );
}

const StyledLineItem = styled('li')`
  line-height: ${p => p.theme.text.lineHeightBody};
`;

const AccordionContainer = styled('ul')`
  padding: ${space(1)} 0 0 0;
  margin: 0;
  list-style-type: none;
`;

const StyledDropdownButton = styled(DropdownButton)`
  svg {
    margin: 0;
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
