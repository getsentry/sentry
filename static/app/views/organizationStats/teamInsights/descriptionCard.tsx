import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

type Props = {
  children: React.ReactNode;
  description: React.ReactNode;
  title: string;
};

export function DescriptionCard({title, description, children}: Props) {
  return (
    <Flex
      border="primary"
      direction={{zero: 'column', '3xl': 'row'}}
      marginBottom="2xl"
      radius="md"
    >
      <Container
        borderBottom={{zero: 'primary', '3xl': 'none'}}
        borderRight={{zero: 'none', '3xl': 'primary'}}
        maxWidth={{zero: 'none', '3xl': '250px'}}
        padding="xl"
      >
        <Stack gap="xs">
          <Text size="lg">{title}</Text>
          <Text variant="muted">{description}</Text>
        </Stack>
      </Container>
      <Container flexGrow={1}>{children}</Container>
    </Flex>
  );
}
