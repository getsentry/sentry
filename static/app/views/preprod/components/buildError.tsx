import {useTheme} from '@emotion/react';

import {Flex} from 'sentry/components/core/layout';
import {Heading, Text} from 'sentry/components/core/text';

export function BuildError({title, message}: {message: string; title: string}) {
  const theme = useTheme();
  return (
    <Flex
      direction="column"
      align="center"
      justify="center"
      style={{minHeight: '60vh', padding: theme.space.md}}
    >
      <Flex
        direction="column"
        align="center"
        gap="lg"
        style={{maxWidth: '500px', textAlign: 'center'}}
      >
        <div style={{fontSize: '64px'}}>⚠️</div>
        <Heading as="h2">{title}</Heading>
        <Text>{message}</Text>
      </Flex>
    </Flex>
  );
}
