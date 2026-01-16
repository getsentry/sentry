import styled from '@emotion/styled';

import {Flex} from '@sentry/scraps/layout';

import {Text} from 'sentry/components/core/text';
import {IconSeer} from 'sentry/icons';

interface SeerSearchHeaderProps {
  title: string;
  loading?: boolean;
}

export function AskSeerSearchHeader({title, loading = false}: SeerSearchHeaderProps) {
  return (
    <Flex align="center" padding="lg xl" gap="md" width="100%">
      <StyledIconSeer animation={loading ? 'loading' : undefined} />
      <Text>{title}</Text>
    </Flex>
  );
}

const StyledIconSeer = styled(IconSeer)`
  color: ${p => p.theme.tokens.content.accent};
`;
