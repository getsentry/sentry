import {createContext, useContext, useId, useLayoutEffect, useState} from 'react';

import {Container} from '@sentry/scraps/layout';

import {useMenuContext} from './context';
import {
  MenuSectionDivider,
  MenuSectionGroup,
  MenuSectionHeading,
  MenuSectionLayout,
} from './layout';

interface SectionContextValue {
  labelId: string;
  setVisibleItems: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
}

export const SectionContext = createContext<SectionContextValue | null>(null);

export interface MenuSectionProps {
  children: React.ReactNode;
  'aria-label'?: string;
}

/** Groups related items and hides the group when search hides every item. */
export function MenuSection({children, 'aria-label': ariaLabel}: MenuSectionProps) {
  const labelId = useId();
  const [visibleItems, setVisibleItems] = useState<Record<string, boolean>>({});
  const itemVisibility = Object.values(visibleItems);
  const isEmpty = itemVisibility.length > 0 && !itemVisibility.some(Boolean);

  return (
    <SectionContext value={{labelId, setVisibleItems}}>
      <MenuSectionLayout
        display={isEmpty ? 'none' : 'block'}
        role="presentation"
        hidden={isEmpty}
      >
        <MenuSectionGroup
          role="group"
          aria-label={ariaLabel}
          aria-labelledby={ariaLabel ? undefined : labelId}
        >
          {children}
        </MenuSectionGroup>
      </MenuSectionLayout>
    </SectionContext>
  );
}

export interface MenuSectionLabelProps {
  children: React.ReactNode;
}

/** Labels a group of related menu items. */
export function MenuSectionLabel({children}: MenuSectionLabelProps) {
  const section = useContext(SectionContext);
  return (
    <Container
      as="li"
      display="block"
      role="presentation"
      id={section?.labelId}
      padding="md lg"
    >
      <MenuSectionHeading>{children}</MenuSectionHeading>
    </Container>
  );
}

/** Separates menu sections when search is inactive. */
export function MenuSectionSeparator() {
  const {search} = useMenuContext();
  return (
    <Container
      as="li"
      display={search ? 'none' : 'block'}
      role="presentation"
      padding="xs md xs lg"
    >
      <MenuSectionDivider />
    </Container>
  );
}

/** Reports an item's search visibility to its containing section. */
export function useSectionItemVisibility(visible: boolean) {
  const section = useContext(SectionContext);
  const id = useId();
  const setVisibleItems = section?.setVisibleItems;

  useLayoutEffect(() => {
    setVisibleItems?.(previous =>
      previous[id] === visible ? previous : {...previous, [id]: visible}
    );
    return () =>
      setVisibleItems?.(previous => {
        const next = {...previous};
        delete next[id];
        return next;
      });
  }, [setVisibleItems, id, visible]);
}
