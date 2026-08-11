import styled from '@emotion/styled';

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
      <LeftPanel>
        <Stack gap="xs">
          <Text size="lg">{title}</Text>
          <Text variant="muted">{description}</Text>
        </Stack>
      </LeftPanel>
      <Container flexGrow={1}>{children}</Container>
    </Flex>
  );
}

const LeftPanel = styled('div')`
  padding: ${p => p.theme.space.xl} ${p => p.theme.space.xl};
  border-bottom: 1px solid ${p => p.theme.tokens.border.primary};

  @container (min-width: ${p => p.theme.container['3xl']}) {
    max-width: 250px;
    border-right: 1px solid ${p => p.theme.tokens.border.primary};
    border-bottom: 0;
  }
`;
