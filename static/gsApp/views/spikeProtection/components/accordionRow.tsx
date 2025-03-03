import type React from 'react';
import {useEffect, useState} from 'react';
import styled from '@emotion/styled';
import {motion} from 'framer-motion';

import {IconChevron} from 'sentry/icons';
import {space} from 'sentry/styles/space';

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
  /**
   * Action to execute upon opening accordion
   */
  onOpen?: () => Promise<void>;
};

function AccordionRow({
  disabled = false,
  disableBody,
  body,
  title,
  onOpen = async () => {},
}: AccordionRowProps) {
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
      <Title
        onClick={async () => {
          if (!isExpanded) {
            await onOpen();
          }
          toggleDetails();
        }}
        disabled={disabled}
        data-test-id="accordion-title"
      >
        {title}
        {!disabled && <IconChevron direction={isExpanded ? 'up' : 'down'} size="sm" />}
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
  padding-left: ${space(2)};
  padding-right: ${space(2)};
  width: 100%;
`;

const Title = styled('div')<{disabled: boolean}>`
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: ${props => (props.disabled ? 'auto' : 'pointer')};
`;

export default AccordionRow;
