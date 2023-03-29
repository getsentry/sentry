import React, {useState} from 'react';
import styled from '@emotion/styled';
import {motion} from 'framer-motion';

import {AccordionSummaryProps} from 'sentry/components/accordion/accordionSummary';
import space from 'sentry/styles/space';

interface AccordionProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * The body of the accordion that is shown & hidden
   */
  accordionDetails: React.ReactNode;
  /**
   * The header of the accordion that is always shown
   */
  accordionSummary: (p: AccordionSummaryProps) => React.ReactNode;
  /**
   * Whether the accordion is disabled (cannot be opened)
   */
  disabled?: boolean;
}

function Accordion({
  disabled = false,
  accordionDetails,
  accordionSummary,
}: AccordionProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [allowOverflow, setAllowOverflow] = useState(false);
  const duration = 0.25; // how long it takes the accordion to open

  function showDetails() {
    if (disabled) {
      setIsExpanded(false);
      return;
    }

    setIsExpanded(!isExpanded);

    // When the accordion is fully expanded, we should allow overflow
    if (!allowOverflow) {
      setTimeout(() => {
        setAllowOverflow(!allowOverflow);
      }, duration * 1000);
    }
    // When the accordion is closing / closed, don't allow
    else {
      setAllowOverflow(!allowOverflow);
    }
  }

  function getOverflow() {
    return allowOverflow ? 'visible' : 'hidden';
  }

  return (
    <AccordionInfo>
      {accordionSummary({onClick: showDetails, disabled})}

      <motion.div
        initial="collapsed"
        animate={disabled ? 'collapsed' : isExpanded ? 'open' : 'collapsed'}
        variants={{
          open: {height: 'auto', overflow: getOverflow()},
          collapsed: {height: 0, overflow: getOverflow()},
        }}
        transition={{duration}}
      >
        {accordionDetails}
      </motion.div>
    </AccordionInfo>
  );
}

const AccordionInfo = styled('div')`
  display: flex;
  flex-direction: column;
  transition: all 0.5s;
  padding-left: ${space(2)};
  padding-right: ${space(2)};
  width: 100%;
`;

export default Accordion;
