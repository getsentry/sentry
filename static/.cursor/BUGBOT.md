## Frontend guidelines

### Layout and Typography Review Rules

CRITICAL:

- Only warn about newly added calls to styled() and do not warn on PRs that modify existing styled() calls
- If you are suggesting to use a Layout or Typography component, read it's implementation to make sure suggestions conform to the actual implementation - this is super important!

#### Layout

- Use <Grid> from `sentry/components/core/layout` for elements that require grid layout as opposed to styled components with `display: grid`

```tsx
// ❌ No need to use styled and create a new styled component
const Component = styled('div')`
  display: flex;
  flex-directon: column;
`;
// ✅ Use the Grid layout primitive
import {Grid} from 'sentry/components/core/layout';
<Grid direction="column"></Grid>;
```

- Use <Flex> from `sentry/components/core/layout` for elements that require flex layout as opposed to styled components with `display: flex`.

```tsx
// ❌ No need to use styled and create a new styled component
const Component = styled('div')`
  display: flex;
  flex-directon: column;
`;
// ✅ Use the Flex layout primitive
import {Flex} from 'sentry/components/core/layout';
<Flex direction="column"></Flex>;
```

- Use using <Container> from `sentry/components/core/layout` over simple elements that require a border or border radius.

```tsx
// ❌ No need to use styled and create a new styled component
const Component = styled('div')`
  padding: space(2);
  border: 1px solid ${p => p.theme.tokens.border.primary};
`;

// ✅ Use the Container primitive
import {Container} from 'sentry/components/core/layout';
<Container padding="md" border="primary"></Container>;
```

- Use responsive props instead of styled media queries for Flex, Grid and Container.

```tsx
// ❌ No need to use styled and create a new styled component
const Component = styled('div')`
  display: flex;
  flex-directon: column;

  @media screen and (min-width: ${p => p.theme.breakpoints.md}){
    flex-direction: row;
  }
`;
// ✅ Use the responsive prop signature
import {Flex} from 'sentry/components/core/layout';
<Flex direction={{xs: 'column' md: 'row'}}></Flex>;
```

- Prefer the use of gap or padding over margin.

#### Typography

- Use <Heading> from `sentry/components/core/text` for headings instead of styled components that style heading typography.

```tsx
// ❌ No need to use styled and create a new styled component
const Title = styled('h2')`
  font-size: ${p => p.theme.fontSize.md};
  font-weight: bold;
`;

// ✅ Use the Heading typography primitive
import {Heading} from 'sentry/components/core/text';
<Heading as="h2">Heading</Heading>;
```

- Use <Text> from `sentry/components/core/text` for text styling instead of styled components that handle typography features like color, overflow, font-size, font-weight.

```tsx
// ❌ No need to use styled and create a new styled component
const Label = styled('span')`
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSizes.small};
`;

// ✅ Use the Text typography primitive
import {Text} from 'sentry/components/core/text';
<Text variant="muted" size="sm">
  Text
</Text>;
```
