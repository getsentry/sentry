import {Container, Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';
import {lightTheme, type BorderWidthToken} from '@sentry/scraps/theme';

const BORDER_WIDTHS = Object.keys(lightTheme.border) as BorderWidthToken[];

describe('Container', () => {
  it.snapshot(
    'border widths',
    () => (
      <Flex gap="md" padding="md" wrap="wrap" width="560px" background="primary">
        {BORDER_WIDTHS.map(width => (
          <Container
            key={width}
            padding="md"
            radius="md"
            minWidth="96px"
            border="accent.vibrant"
            borderWidth={width}
          >
            <Text size="sm">{width}</Text>
          </Container>
        ))}
        <Container
          padding="md"
          radius="md"
          minWidth="96px"
          borderBottom="accent.vibrant"
          borderWidth="2xl"
        >
          <Text size="sm">bottom 2xl</Text>
        </Container>
      </Flex>
    ),
    {tags: {area: 'core'}}
  );
});
