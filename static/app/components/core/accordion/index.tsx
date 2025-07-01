import {createContext, useContext, useId, useState} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button';
import InteractionStateLayer from 'sentry/components/core/interactionStateLayer';
import {IconChevron} from 'sentry/icons';
import {space} from 'sentry/styles/space';

interface AccordionContextValue {
  allowMultiple: boolean;
  openItems: Set<string>;
  toggleItem: (itemId: string) => void;
}

const AccordionContext = createContext<AccordionContextValue | null>(null);

function useAccordionContext() {
  const context = useContext(AccordionContext);
  if (!context) {
    throw new Error('Accordion components must be used within an Accordion');
  }
  return context;
}

interface AccordionProps {
  children: React.ReactNode;
  /**
   * Whether multiple items can be open at the same time
   */
  allowMultiple?: boolean;
  className?: string;
  /**
   * Default open items
   */
  defaultValue?: string[];
  /**
   * Callback when open items change
   */
  onChange?: (openItems: string[]) => void;
  /**
   * Open items
   */
  value?: string[];
}

interface AccordionItemContextValue {
  isOpen: boolean;
  itemId: string;
  labelId: string;
  panelId: string;
  toggle: () => void;
  triggerId: string;
}

const AccordionItemContext = createContext<AccordionItemContextValue | null>(null);

function useAccordionItemContext() {
  const context = useContext(AccordionItemContext);
  if (!context) {
    throw new Error('AccordionItem components must be used within an AccordionItem');
  }
  return context;
}

interface AccordionItemProps {
  children: React.ReactNode;
  /**
   * Unique identifier for this accordion item
   */
  value: string;
  className?: string;
  /**
   * Whether this item is disabled
   */
  disabled?: boolean;
}

interface AccordionHeaderProps {
  children: React.ReactNode;
  className?: string;
}

interface AccordionTriggerProps {
  children: React.ReactNode;
  className?: string;
}

interface AccordionPanelProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Root accordion component that manages state for all accordion items
 */
function AccordionRoot({
  children,
  allowMultiple = false,
  defaultValue = [],
  value,
  onChange,
  className,
}: AccordionProps) {
  const [internalOpenItems, setInternalOpenItems] = useState<Set<string>>(
    () => new Set(defaultValue)
  );

  // Controlled vs Uncontrolled:
  // - Controlled: Parent manages state via `value` + `onChange` props
  // - Uncontrolled: Component manages its own state via `defaultValue`
  const isControlled = value !== undefined;
  const openItems = isControlled ? new Set(value) : internalOpenItems;

  const toggleItem = (itemId: string) => {
    const newOpenItems = new Set(openItems);

    if (newOpenItems.has(itemId)) {
      newOpenItems.delete(itemId);
    } else {
      if (!allowMultiple) {
        newOpenItems.clear();
      }
      newOpenItems.add(itemId);
    }

    if (isControlled) {
      onChange?.(Array.from(newOpenItems));
    } else {
      setInternalOpenItems(newOpenItems);
    }
  };

  return (
    <AccordionContext.Provider value={{openItems, toggleItem, allowMultiple}}>
      <AccordionContainer className={className}>{children}</AccordionContainer>
    </AccordionContext.Provider>
  );
}

/**
 * Individual accordion item that contains header and panel
 */
function AccordionItem({
  children,
  value: itemId,
  disabled = false,
  className,
}: AccordionItemProps) {
  const {openItems, toggleItem} = useAccordionContext();
  const isOpen = openItems.has(itemId);
  const triggerId = useId();
  const panelId = useId();
  const labelId = useId();

  const toggle = () => {
    if (!disabled) {
      toggleItem(itemId);
    }
  };

  return (
    <AccordionItemContext.Provider
      value={{itemId, isOpen, toggle, triggerId, panelId, labelId}}
    >
      <AccordionItemContainer className={className} data-disabled={disabled}>
        {children}
      </AccordionItemContainer>
    </AccordionItemContext.Provider>
  );
}

/**
 * Header container for the accordion item
 */
function AccordionHeader({children, className}: AccordionHeaderProps) {
  const {isOpen} = useAccordionItemContext();

  return (
    <AccordionHeaderContainer className={className} data-open={isOpen}>
      {children}
    </AccordionHeaderContainer>
  );
}

/**
 * Clickable trigger that opens/closes the accordion item
 */
function AccordionTrigger({children, className}: AccordionTriggerProps) {
  const {isOpen, toggle, triggerId, panelId, labelId} = useAccordionItemContext();

  return (
    <AccordionTriggerContainer className={className}>
      <AccordionTriggerButton
        id={triggerId}
        aria-expanded={isOpen}
        aria-controls={panelId}
        aria-labelledby={labelId}
        onClick={toggle}
        size="zero"
        borderless
        icon={<IconChevron size="xs" direction={isOpen ? 'up' : 'down'} />}
      >
        <InteractionStateLayer />
      </AccordionTriggerButton>
      <AccordionTriggerContent id={labelId} onClick={toggle}>
        {children}
      </AccordionTriggerContent>
    </AccordionTriggerContainer>
  );
}

/**
 * Collapsible panel containing the accordion item content
 */
function AccordionPanel({children, className}: AccordionPanelProps) {
  const {isOpen, panelId} = useAccordionItemContext();

  return (
    <AccordionPanelContainer
      id={panelId}
      className={className}
      data-open={isOpen}
      hidden={!isOpen}
    >
      {isOpen && <AccordionPanelContent>{children}</AccordionPanelContent>}
    </AccordionPanelContainer>
  );
}

// Compound component pattern
export const Accordion = Object.assign(AccordionRoot, {
  Item: AccordionItem,
  Header: AccordionHeader,
  Trigger: AccordionTrigger,
  Panel: AccordionPanel,
});

// Styled components
const AccordionContainer = styled('div')`
  display: flex;
  flex-direction: column;
  width: 100%;
  min-width: 0;
`;

const AccordionItemContainer = styled('div')`
  border-top: 1px solid ${p => p.theme.border};
  width: 100%;
  min-width: 0;

  &[data-disabled='true'] {
    opacity: 0.6;
    pointer-events: none;
  }
`;

const AccordionHeaderContainer = styled('div')`
  position: relative;
`;

const AccordionTriggerContainer = styled('div')`
  display: flex;
  align-items: center;
  padding: ${space(1)} ${space(2)};
  column-gap: ${space(1.5)};
  font-size: ${p => p.theme.fontSize.md};
  line-height: ${p => p.theme.text.lineHeightBody};
  min-height: 40px; /* Ensure consistent height */
`;

const AccordionTriggerButton = styled(Button)`
  position: relative;
  flex-shrink: 0;
  align-self: center;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const AccordionTriggerContent = styled('div')`
  flex: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-width: 0; /* Allows content to shrink */
  overflow: hidden;
`;

const AccordionPanelContainer = styled('div')`
  overflow: hidden;
  width: 100%;
  transition:
    max-height 0.2s ease-out,
    opacity 0.15s ease-out;

  &[data-open='false'] {
    max-height: 0;
    opacity: 0;
  }

  &[data-open='true'] {
    max-height: 2000px; /* Large enough value for most content */
    opacity: 1;
  }
`;

const AccordionPanelContent = styled('div')`
  padding: 0 ${space(0.25)} ${space(1)} ${space(0.25)};
  width: 100%;
  min-width: 0; /* Allows content to shrink */
  box-sizing: border-box;
  overflow-wrap: break-word;
`;

export type {
  AccordionProps,
  AccordionItemProps,
  AccordionHeaderProps,
  AccordionTriggerProps,
  AccordionPanelProps,
};
