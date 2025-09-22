import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import Missing from 'sentry-images/missing.png';

import {Flex} from 'sentry/components/core/layout';
import {Heading, Text} from 'sentry/components/core/text';

interface BuildErrorProps {
  message: string;
  title: string;
  children?: React.ReactNode;
}

export function BuildError({title, message, children}: BuildErrorProps) {
  const theme = useTheme();
  return (
    <Flex
      direction="column"
      align="center"
      justify="center"
      gap="3xl"
      style={{minHeight: '60vh', padding: theme.space.md}}
    >
      <Flex
        direction="column"
        align="center"
        gap="lg"
        style={{maxWidth: '500px', textAlign: 'center'}}
      >
        <AlertImage src={Missing} alt="Error image" />
        <Heading as="h2">{title}</Heading>
        <Text>{message}</Text>
      </Flex>
      {children}
    </Flex>
  );
}

const AlertImage = styled('img')`
  height: 200px;
`;
