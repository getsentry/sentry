import {ReactNode} from 'react';
import styled from '@emotion/styled';

import DropdownButton from 'sentry/components/dropdownButton';
import space from 'sentry/styles/space';

type Props = {
  content: ReactNode;
  expandedIndex: number;
  headers: (() => ReactNode)[];
  setExpandedIndex: (index: number) => void;
};

export default function Accordion({
  content,
  headers,
  expandedIndex,
  setExpandedIndex,
}: Props) {
  return (
    <AccordionContainer>
      {headers.map((header, index) => (
        <AccordionItem
          isExpanded={index === expandedIndex}
          currentIndex={index}
          key={index}
          content={content}
          setExpandedIndex={setExpandedIndex}
        >
          {header()}
        </AccordionItem>
      ))}
    </AccordionContainer>
  );
}

function AccordionItem({
  isExpanded,
  currentIndex: index,
  children,
  setExpandedIndex,
  content,
}: {
  children: ReactNode;
  content: ReactNode;
  currentIndex: number;
  isExpanded: boolean;
  setExpandedIndex: (index: number) => void;
}) {
  return (
    <StyledLineItem>
      <ListItemContainer>
        {children}
        <StyledDropdownButton
          size="zero"
          borderless
          onClick={() => setExpandedIndex(index)}
          isOpen={isExpanded}
        />
      </ListItemContainer>
      <StyledContentContainer>{isExpanded && content}</StyledContentContainer>
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
