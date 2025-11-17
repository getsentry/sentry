import styled from '@emotion/styled';

import {Flex} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {IconSettings} from 'sentry/icons';

interface BuildProcessingProps {
  message: string;
  title: string;
  children?: React.ReactNode;
}

export function BuildProcessing({title, message, children}: BuildProcessingProps) {
  return (
    <Flex
      direction="column"
      align="center"
      justify="center"
      gap="xl"
      padding="md"
      minHeight="60vh"
      maxWidth="500px"
    >
      <Flex direction="column" align="center" gap="md">
        <Heading as="h2" align="center">
          {title}
        </Heading>
        <Text align="center">{message}</Text>
      </Flex>
      <Flex align="center" justify="center">
        <RotatingIcon>
          <IconSettings size="2xl" />
        </RotatingIcon>
        <RotatingIconReverse>
          <IconSettings size="2xl" />
        </RotatingIconReverse>
      </Flex>
      {children}
    </Flex>
  );
}

// 22.5deg to offset icon by one tooth.
const RotatingIcon = styled('span')`
  display: inline-block;
  animation: spin 3s linear infinite;
  line-height: 0;

  @keyframes spin {
    0% {
      transform: rotate(22.5deg);
    }
    100% {
      transform: rotate(382.5deg);
    }
  }
`;

const RotatingIconReverse = styled('span')`
  display: inline-block;
  animation: spin-reverse 3s linear infinite;
  line-height: 0;

  @keyframes spin-reverse {
    0% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(-360deg);
    }
  }
`;
