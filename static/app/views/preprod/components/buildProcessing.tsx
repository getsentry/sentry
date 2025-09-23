import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {Flex} from 'sentry/components/core/layout';
import {Heading, Text} from 'sentry/components/core/text';
import {IconSettings} from 'sentry/icons';

interface BuildProcessingProps {
  message: string;
  title: string;
  children?: React.ReactNode;
}

export function BuildProcessing({title, message, children}: BuildProcessingProps) {
  const theme = useTheme();
  return (
    <Flex
      direction="column"
      align="center"
      justify="center"
      gap="3xl"
      style={{minHeight: '60vh', padding: theme.space.md}}
      padding="md"
      maxWidth="500px"
    >
      <Flex direction="column" align="center" gap="xl">
        <Heading as="h2" align="center">
          {title}
        </Heading>
        <Text align="center">{message}</Text>
        <Flex gap="sm">
          <RotatingIcon>
            <IconSettings size="2xl" />
          </RotatingIcon>
          <RotatingIconReverse>
            <IconSettings size="2xl" />
          </RotatingIconReverse>
        </Flex>
      </Flex>
      {children}
    </Flex>
  );
}

const RotatingIcon = styled('span')`
  display: inline-block;
  animation: spin 2s linear infinite;

  @keyframes spin {
    0% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(360deg);
    }
  }
`;

const RotatingIconReverse = styled('span')`
  display: inline-block;
  animation: spin-reverse 2s linear infinite;

  @keyframes spin-reverse {
    0% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(-360deg);
    }
  }
`;
