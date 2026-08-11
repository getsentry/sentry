import {useRef} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {Stack, type FlexProps} from '@sentry/scraps/layout';

import * as Layout from 'sentry/components/layouts/thirds';
import {useIsStuck} from 'sentry/utils/useIsStuck';
import {TOP_BAR_HEIGHT_CSS_VAR} from 'sentry/views/navigation/constants';
import {useTopOffset} from 'sentry/views/navigation/useTopOffset';

export const ExploreControlSection = styled('aside')<{expanded: boolean}>`
  padding: ${p => p.theme.space.md} ${p => p.theme.space.xl};
  border-bottom: 1px solid ${p => p.theme.tokens.border.primary};

  @media (min-width: ${p => p.theme.breakpoints.md}) {
    border-bottom: none;
    ${p =>
      p.expanded
        ? css`
            width: 343px; /* 300px for the toolbar + padding */
            padding: ${p.theme.space.md} ${p.theme.space.xl};
            border-right: 1px solid ${p.theme.tokens.border.primary};
          `
        : css`
            overflow: hidden;
            width: 0px;
            padding: 0px;
            border-right: none;
          `}
  }
`;

export function ExploreContentSection(props: FlexProps) {
  return (
    <Stack
      {...props}
      background="primary"
      flex="1 1 auto"
      minHeight="0"
      minWidth="0"
      padding="xl"
    />
  );
}

export const ExploreFilterSection = styled('div')`
  display: grid;
  gap: ${p => p.theme.space.md};

  @media (min-width: ${p => p.theme.breakpoints.md}) {
    grid-template-columns: minmax(300px, auto) 1fr;
  }
`;

function StuckAwareExploreBodySearch(props: React.ComponentProps<typeof Layout.Body>) {
  const elementRef = useRef<HTMLDivElement>(null);
  const {pageContentTop} = useTopOffset();
  const isStuck = useIsStuck(elementRef, {
    offset: Number.parseInt(pageContentTop, 10) ?? 0,
  });

  return (
    <Layout.Body ref={elementRef} data-stuck={isStuck ? '' : undefined} {...props} />
  );
}

export const ExploreBodySearch = styled(StuckAwareExploreBodySearch)`
  flex-grow: 0;

  position: sticky;
  top: var(${TOP_BAR_HEIGHT_CSS_VAR}, 0px);
  z-index: ${p => p.theme.zIndex.header};
  background-color: ${p => p.theme.tokens.background.primary};

  border-bottom: 1px solid ${p => p.theme.tokens.border.primary};
  padding-bottom: ${p => p.theme.space.xl};

  @media (min-width: ${p => p.theme.breakpoints.md}) {
    padding-bottom: ${p => p.theme.space.xl};
  }

  &[data-stuck] {
    /* Content dropdowns should scroll underneath the sticky search controls. */
    z-index: ${p => p.theme.zIndex.stickyHeader};
  }
`;

export const ExploreBodyContent = styled('div')`
  background-color: ${p => p.theme.tokens.background.primary};
  flex-grow: 1;

  display: flex;
  flex-direction: column;
  padding: 0px;

  @media (min-width: ${p => p.theme.breakpoints.md}) {
    display: flex;
    flex-direction: row;
    padding: 0px;
    gap: 0px;
  }
`;
