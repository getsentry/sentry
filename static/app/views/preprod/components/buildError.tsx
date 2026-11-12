import styled from '@emotion/styled';

import Missing from 'sentry-images/missing.png';

import {Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

interface BuildErrorProps {
  message: string;
  title: string;
  children?: React.ReactNode;
}

export function BuildError({title, message, children}: BuildErrorProps) {
  return (
    <Stack align="center" justify="center" gap="xl" padding="md" minHeight="60vh">
      <Stack maxWidth="500px" align="center" gap="md" padding="md">
        <AlertImage src={Missing} alt="Error image" />
        <Heading as="h2" align="center">
          {title}
        </Heading>
        <Text align="center">{message}</Text>
      </Stack>
      {children}
    </Stack>
  );
}

const AlertImage = styled('img')`
  height: 200px;
`;
