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
  replayAccordion?: boolean;
}

export default function Accordion({
  expandedIndex,
  setExpandedIndex,
  items,
  replayAccordion,
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
          replayAccordion={replayAccordion}
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
  replayAccordion,
}: {
  children: ReactNode;
  content: ReactNode;
  currentIndex: number;
  isExpanded: boolean;
  setExpandedIndex: (index: number) => void;
  replayAccordion?: boolean;
}) {
  return replayAccordion ? (
    <StyledLineItem>
      <ListItemContainer>
        <StyledButton
          icon={<IconChevron size="xs" direction={isExpanded ? 'up' : 'down'} />}
          aria-label={t('Expand')}
          aria-expanded={isExpanded}
          size="zero"
          borderless
          onClick={() => setExpandedIndex(index)}
        />
        {children}
      </ListItemContainer>
      <ReplayContentContainer>{isExpanded && content}</ReplayContentContainer>
    </StyledLineItem>
  ) : (
    <StyledLineItem>
      <ListItemContainer>
        {children}
        <Button
          icon={<IconChevron size="xs" direction={isExpanded ? 'up' : 'down'} />}
          aria-label={t('Expand')}
          aria-expanded={isExpanded}
          size="zero"
          borderless
          onClick={() => setExpandedIndex(index)}
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

const ListItemContainer = styled('div')`
  display: flex;
  border-top: 1px solid ${p => p.theme.border};
  padding: ${space(1)} ${space(2)};
  font-size: ${p => p.theme.fontSizeMedium};
`;

const StyledContentContainer = styled('div')`
  padding: ${space(0)} ${space(2)};
`;

const ReplayContentContainer = styled('div')`
  padding: ${space(0)} ${space(0.25)};
`;

const StyledButton = styled(Button)`
  margin-right: ${space(1.5)};
`;
