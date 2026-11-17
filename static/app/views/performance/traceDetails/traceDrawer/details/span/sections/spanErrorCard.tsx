import styled from '@emotion/styled';

import {Flex, Stack} from '@sentry/scraps/layout';

import {Panel} from 'sentry/components/panels/panel';
import {PanelItem} from 'sentry/components/panels/panelItem';

interface SpanErrorCardProps {
  icon: React.ReactNode;
  message: React.ReactNode;
  title: React.ReactNode;
  className?: string;
}

/**
 * Card for a span that ended in an error without an associated issue. Sits in
 * the same slot as the span's issue list.
 */
export function SpanErrorCard({icon, title, message, className}: SpanErrorCardProps) {
  return (
    <Wrapper className={className}>
      <StyledPanel>
        <StyledPanelItem>
          <Flex align="center" justify="center">
            {icon}
          </Flex>
          <Stack gap="2xs" minWidth="0">
            {title}
            {message}
          </Stack>
        </StyledPanelItem>
      </StyledPanel>
    </Wrapper>
  );
}

const Wrapper = styled('div')`
  margin: ${p => p.theme.space.md} 0;
`;

const StyledPanel = styled(Panel)`
  margin-bottom: 0;
`;

const StyledPanelItem = styled(PanelItem)`
  align-items: center;
  gap: ${p => p.theme.space.md};
  padding: ${p => p.theme.space.md} ${p => p.theme.space.xl} ${p => p.theme.space.lg}
    ${p => p.theme.space.md};
`;
