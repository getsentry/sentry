import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import {IconChevron} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

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
              borderless
              onClick={() => setExpandedIndex(index)}
            />
          </AccordionHeader>
          <AccordionContent>{index === expandedIndex && item.content}</AccordionContent>
        </AccordionItem>
      ))}
    </AccordionContainer>
  );
}

const AccordionItem = styled('li')`
  line-height: ${p => p.theme.text.lineHeightBody};
`;

const AccordionContainer = styled('ul')`
  padding: ${space(1)} 0 0 0;
  margin: 0;
  list-style-type: none;
`;

const AccordionHeader = styled('div')`
  display: flex;
  border-top: 1px solid ${p => p.theme.border};
  padding: ${space(1)} ${space(2)};
  font-size: ${p => p.theme.fontSizeMedium};
`;

const AccordionContent = styled('div')`
  padding: 0 ${space(2)};
`;

export {Accordion};
