import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button';
import {IconChevron} from 'sentry/icons';
import {t} from 'sentry/locale';

interface AccordionItemContent {
  content: React.ReactNode;
  header: React.ReactNode;
}

interface Props {
  expandedIndex: number;
  items: AccordionItemContent[];
  setExpandedIndex: (index: number) => void;
  collapsible?: boolean;
}

export default function Accordion({
  expandedIndex,
  setExpandedIndex,
  items,
  collapsible = true,
}: Props) {
  return (
    <AccordionContainer>
      {items.map((item, index) => {
        const isExpanded = index === expandedIndex;

        return (
          <AccordionItem key={index}>
            <AccordionHeader>
              <Button
                icon={<IconChevron size="xs" direction={isExpanded ? 'up' : 'down'} />}
                aria-label={collapsible && isExpanded ? t('Collapse') : t('Expand')}
                aria-expanded={isExpanded}
                size="zero"
                borderless
                onClick={() => setExpandedIndex(collapsible && isExpanded ? -1 : index)}
              />
              <LineItemWrapper
                onClick={() => setExpandedIndex(isExpanded && collapsible ? -1 : index)}
              >
                {item.header}
              </LineItemWrapper>
            </AccordionHeader>
            <AccordionContent>{isExpanded && item.content}</AccordionContent>
          </AccordionItem>
        );
      })}
    </AccordionContainer>
  );
}

const AccordionItem = styled('li')`
  line-height: ${p => p.theme.text.lineHeightBody};
`;

const AccordionContainer = styled('ul')`
  padding: ${p => p.theme.space.md} 0 0 0;
  margin: 0;
  list-style-type: none;
`;

const AccordionHeader = styled('div')`
  display: flex;
  align-items: center;
  border-top: 1px solid ${p => p.theme.tokens.border.primary};
  padding: ${p => p.theme.space.md} ${p => p.theme.space.xl};
  /* Margin bottom to compensate for the border so it doesn't cut into previous item's padding */
  margin-bottom: ${p => p.theme.space.sm};
  font-size: ${p => p.theme.fontSize.md};
  column-gap: ${p => p.theme.space.md};
`;

const AccordionContent = styled('ul')`
  list-style-type: none;
  margin: -${p => p.theme.space.md} 0 0 0;
  padding: 0;
`;

const LineItemWrapper = styled('div')`
  display: grid;
  grid-template-columns: 1fr max-content;
  flex: 1;
`;
