## Frontend guidelines

### Layout

- Use <Grid> from `sentry/components/core/layout` for elements that require grid layout as opposed to styled components with `display: grid`
- Use <Flex> from `sentry/components/core/layout` for elements that require flex layout as opposed to styled components with `display: flex`.
- Use using <Container> from `sentry/components/core/layout` over simple elements that require a border or border radius. Example: <Container border="primary" radius="md">
- Use responsive props instead of styled media queries for Flex, Grid and Container. Example: <Flex gap={{sm: "md", lg: "xl"}}>...</Flex>
- Prefer the use of gap or padding over margin.

### Typography

- Prefer using <Heading> over styled components that style heading typography. Example: <Heading as="h2">Heading<Heading>
- Prefer using <Text> over styled components that style typography features like color, overflow, font-size, font-weight etc... Example: <Text variant="muted" size="sm">Text</Text>
