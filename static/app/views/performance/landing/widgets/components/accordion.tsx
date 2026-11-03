import styled from '@emotion/styled';
import {IconChevron} from '@sentry/icons/chevron';

import {Button} from '@sentry/scraps/button';
import {Container} from '@sentry/scraps/layout';

import {t} from 'sentry/locale';

interface AccordionItemContent {
  content: React.ReactNode;
  header: React.ReactNode;
}

interface Props {
  expandedIndex: number;
  items: AccordionItemContent[];
  setExpandedIndex: (index: number) => void;
}

/**
 * Accordion used in performance widgets
 */
function Accordion({expandedIndex, setExpandedIndex, items}: Props) {
  return (
    <AccordionContainer>
      {items.map((item, index) => (
        <AccordionItem key={index}>
          <AccordionHeader>
            {item.header}
            <Button
              icon={
                <IconChevron
                  size="xs"
                  direction={index === expandedIndex ? 'up' : 'down'}
                />
              }
              aria-label={t('Expand')}
              aria-expanded={index === expandedIndex}
              disabled={index === expandedIndex}
              size="zero"
              variant="transparent"
              onClick={() => setExpandedIndex(index)}
            />
          </AccordionHeader>
          <Container padding="0 xl">{index === expandedIndex && item.content}</Container>
        </AccordionItem>
      ))}
    </AccordionContainer>
  );
}

const AccordionItem = styled('li')`
  line-height: ${p => p.theme.font.lineHeight.comfortable};
`;

const AccordionContainer = styled('ul')`
  padding: ${p => p.theme.space.md} 0 0 0;
  margin: 0;
  list-style-type: none;
`;

const AccordionHeader = styled('div')`
  display: flex;
  border-top: 1px solid ${p => p.theme.tokens.border.primary};
  padding: ${p => p.theme.space.md} ${p => p.theme.space.xl};
  font-size: ${p => p.theme.font.size.md};
`;

export {Accordion};
