import {
  createContext,
  useCallback,
  useContext,
  useId,
  useLayoutEffect,
  useMemo,
  useState,
} from 'react';

import {Container} from '@sentry/scraps/layout';

import {useMenuContext} from './context';
import {
  MenuSectionDivider,
  MenuSectionGroup,
  MenuSectionHeading,
  MenuSectionLayout,
} from './visual';

interface SectionContextValue {
  labelId: string;
  setItemVisibility: (id: string, visible: boolean | null) => void;
}

export const SectionContext = createContext<SectionContextValue | null>(null);

export interface MenuSectionProps {
  children: React.ReactNode;
  'aria-label'?: string;
}

export function MenuSection({children, 'aria-label': ariaLabel}: MenuSectionProps) {
  const labelId = useId();
  const [visibleItems, setVisibleItems] = useState<Record<string, boolean>>({});
  const setItemVisibility = useCallback((id: string, visible: boolean | null) => {
    setVisibleItems(previous => {
      if (visible === null) {
        const next = {...previous};
        delete next[id];
        return next;
      }
      return previous[id] === visible ? previous : {...previous, [id]: visible};
    });
  }, []);
  const sectionContext = useMemo(
    () => ({labelId, setItemVisibility}),
    [labelId, setItemVisibility]
  );
  const itemVisibility = Object.values(visibleItems);
  const isEmpty = itemVisibility.length > 0 && !itemVisibility.some(Boolean);

  return (
    <SectionContext value={sectionContext}>
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

export function useSectionItemVisibility(visible: boolean) {
  const section = useContext(SectionContext);
  const id = useId();

  useLayoutEffect(() => {
    section?.setItemVisibility(id, visible);
    return () => section?.setItemVisibility(id, null);
  }, [section, id, visible]);
}
