import styled from '@emotion/styled';

import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {IconSeer} from 'sentry/icons';
import {useOrganization} from 'sentry/utils/useOrganization';

interface SeerSearchHeaderProps {
  title: string;
  loading?: boolean;
}

export function AskSeerSearchHeader({title, loading = false}: SeerSearchHeaderProps) {
  const hasAskSeerRework = useOrganization().features.includes(
    'gen-ai-ask-seer-ux-rework'
  );

  return (
    <Flex align="center" padding="lg xl" gap="md" width="100%">
      <StyledIconSeer animation={loading ? 'loading' : undefined} />
      <Text monospace={hasAskSeerRework}>{title}</Text>
    </Flex>
  );
}

const StyledIconSeer = styled(IconSeer)`
  color: ${p => p.theme.tokens.content.accent};
`;
