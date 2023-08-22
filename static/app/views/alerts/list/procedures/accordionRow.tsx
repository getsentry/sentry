import React, {useEffect, useState} from 'react';
import styled from '@emotion/styled';
import {motion} from 'framer-motion';

import {IconChevron} from 'sentry/icons';

type AccordionRowProps = {
  /**
   * The body of the accordion that is shown & hidden
   */
  body: React.ReactNode;
  /**
   * The header of the accordion that is always shown
   */
  title: React.ReactNode;
  /**
   * Whether to render the body
   */
  disableBody?: boolean;
  /**
   * Whether the accordion is disabled (cannot be opened)
   */
  disabled?: boolean;
};

function AccordionRow({disabled = false, disableBody, body, title}: AccordionRowProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const duration = 0.2; // how long it takes the accordion to open/close
  const animationState = isExpanded ? 'open' : 'collapsed';

  useEffect(() => {
    if (disabled) {
      setIsExpanded(false);
    }
  }, [disabled]);

  const toggleDetails = () => {
    setIsExpanded(!isExpanded);
  };

  return (
    <AccordionContent>
      <Title onClick={toggleDetails} disabled={disabled}>
        <TitlePropWrapper>{title}</TitlePropWrapper>
        <IconWrapper>
          {!disabled && <IconChevron direction={isExpanded ? 'up' : 'down'} size="sm" />}
        </IconWrapper>
      </Title>

      <motion.div
        initial="collapsed"
        animate={disabled || disableBody ? undefined : animationState}
        variants={{
          open: {
            height: 'auto',
            overflow: 'visible',
            transition: {duration, overflow: {delay: duration}},
          },
          collapsed: {height: 0, overflow: 'hidden', transition: {duration}},
        }}
      >
        {body}
      </motion.div>
    </AccordionContent>
  );
}

const AccordionContent = styled('div')`
  display: flex;
  flex-direction: column;
  width: 100%;
`;

const Title = styled('div')<{disabled: boolean}>`
  width: 100%;
  display: grid;
  grid-template-columns: 1fr 20px;
  gap: 1.5rem;
  margin: 0.75rem 0;
  align-items: center;
  cursor: ${props => (props.disabled ? 'auto' : 'pointer')};
`;

const IconWrapper = styled('div')`
  grid-column: 1 2;
  line-height: 0;
`;

const TitlePropWrapper = styled('div')`
  grid-column: 2 3;
`;

export default AccordionRow;
