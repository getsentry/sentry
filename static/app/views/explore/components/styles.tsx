import {useRef} from 'react';
import styled from '@emotion/styled';

import {
  Container,
  Flex,
  type FlexProps,
  Grid,
  type GridProps,
  Stack,
  type ContainerProps,
} from '@sentry/scraps/layout';

import * as Layout from 'sentry/components/layouts/thirds';
import {useIsStuck} from 'sentry/utils/useIsStuck';
import {TOP_BAR_HEIGHT_CSS_VAR} from 'sentry/views/navigation/constants';
import {useTopOffset} from 'sentry/views/navigation/useTopOffset';

type ExploreControlSectionProps = ContainerProps<'aside'> & {expanded: boolean};

export function ExploreControlSection({expanded, ...props}: ExploreControlSectionProps) {
  return (
    <Container
      as="aside"
      padding={expanded ? 'md xl' : '0'}
      borderBottom={expanded ? {zero: 'primary', xl: 'none'} : 'none'}
      borderRight={{zero: 'none', xl: expanded ? 'primary' : 'none'}}
      overflow={expanded ? 'visible' : 'hidden'}
      width={{zero: 'auto', xl: expanded ? '343px' : '0px'}}
      {...props}
    />
  );
}

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

export function ExploreFilterSection(props: GridProps) {
  return (
    <Grid gap="md" columns={{zero: '1fr', xl: 'minmax(300px, auto) 1fr'}} {...props} />
  );
}

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

  &[data-stuck] {
    /* Content dropdowns should scroll underneath the sticky search controls. */
    z-index: ${p => p.theme.zIndex.stickyHeader};
  }
`;

export function ExploreBodyContent(props: FlexProps) {
  return (
    <Flex
      background="primary"
      flexGrow={1}
      direction={{zero: 'column', xl: 'row'}}
      padding="0"
      gap="0"
      {...props}
    />
  );
}
