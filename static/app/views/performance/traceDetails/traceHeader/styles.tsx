import styled from '@emotion/styled';

import {
  Container,
  type ContainerProps,
  Grid,
  type GridProps,
  Stack,
  type StackProps,
} from '@sentry/scraps/layout';

import {Placeholder} from 'sentry/components/placeholder';

function HeaderLayout(props: ContainerProps) {
  return <Container padding="lg xl" borderBottom="primary" flexShrink={0} {...props} />;
}

// Shared responsive shell for the header body: two columns when wide, a single
// stacked column when narrow. The loaded header and the loading placeholder both
// render into the same `title`/`meta`/`highlights`/`projects` areas so they can't
// drift out of sync.
function HeaderGrid(props: GridProps) {
  return (
    <Grid
      columns={{zero: 'minmax(0, 1fr)', xl: 'minmax(0, 1fr) minmax(0, max-content)'}}
      gap="md xl"
      align="start"
      areas={{
        zero: `"title" "meta" "highlights" "projects"`,
        xl: `"title meta" "highlights projects"`,
      }}
      {...props}
    />
  );
}

function HeaderContent(props: StackProps) {
  return <Stack {...props} />;
}

const StyledPlaceholder = styled(Placeholder)<{_height: number; _width: number}>`
  border-radius: ${p => p.theme.radius.md};
  height: ${p => p._height}px;
  width: ${p => p._width}px;
`;

const TraceHeaderComponents = {
  HeaderLayout,
  HeaderGrid,
  HeaderContent,
  StyledPlaceholder,
};

export {TraceHeaderComponents};
