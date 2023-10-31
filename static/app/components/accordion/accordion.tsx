import {ReactNode} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import {IconChevron} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

interface AccordionItemContent {
  content: () => ReactNode;
  header: () => ReactNode;
}

interface Props {
  expandedIndex: number;
  items: AccordionItemContent[];
  setExpandedIndex: (index: number) => void;
  buttonOnLeft?: boolean;
  collapsible?: boolean;
}

export default function Accordion({
  expandedIndex,
  setExpandedIndex,
  items,
  buttonOnLeft,
  collapsible = true,
}: Props) {
  return (
    <AccordionContainer>
      {items.map((item, index) => (
        <AccordionItem
          isExpanded={index === expandedIndex}
          currentIndex={index}
          key={index}
          content={item.content()}
          setExpandedIndex={setExpandedIndex}
          buttonOnLeft={buttonOnLeft}
          collapsible={collapsible}
        >
          {item.header()}
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
  buttonOnLeft,
  collapsible,
}: {
  children: ReactNode;
  content: ReactNode;
  currentIndex: number;
  isExpanded: boolean;
  setExpandedIndex: (index: number) => void;
  buttonOnLeft?: boolean;
  collapsible?: boolean;
}) {
  const button = collapsible ? (
    <Button
      icon={<IconChevron size="xs" direction={isExpanded ? 'up' : 'down'} />}
      aria-label={isExpanded ? t('Collapse') : t('Expand')}
      aria-expanded={isExpanded}
      size="zero"
      borderless
      onClick={() => {
        isExpanded ? setExpandedIndex(-1) : setExpandedIndex(index);
      }}
    />
  ) : (
    <Button
      icon={<IconChevron size="xs" direction={isExpanded ? 'up' : 'down'} />}
      aria-label={t('Expand')}
      aria-expanded={isExpanded}
      disabled={isExpanded}
      size="zero"
      borderless
      onClick={() => setExpandedIndex(index)}
    />
  );

  return buttonOnLeft ? (
    <StyledLineItem>
      <ButtonLeftListItemContainer>
        {button}
        <StyledPanel onClick={() => setExpandedIndex(index)}>{children}</StyledPanel>
      </ButtonLeftListItemContainer>
      <LeftContentContainer>{isExpanded && content}</LeftContentContainer>
    </StyledLineItem>
  ) : (
    <StyledLineItem>
      <ListItemContainer>
        {children}
        {button}
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

const ButtonLeftListItemContainer = styled('div')`
  display: flex;
  border-top: 1px solid ${p => p.theme.border};
  padding: ${space(1)} ${space(2)};
  font-size: ${p => p.theme.fontSizeMedium};
  column-gap: ${space(1.5)};
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

const LeftContentContainer = styled('div')`
  padding: ${space(0)} ${space(0.25)};
`;

const StyledPanel = styled('div')`
  display: grid;
  grid-template-columns: 1fr max-content;
  flex: 1;
`;
