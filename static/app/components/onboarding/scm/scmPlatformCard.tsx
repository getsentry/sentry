import styled from '@emotion/styled';
import {PlatformIcon} from 'platformicons';

import {InfoText} from '@sentry/scraps/info';
import {Container, Flex} from '@sentry/scraps/layout';
import {Radio} from '@sentry/scraps/radio';

import type {PlatformKey} from 'sentry/types/platform';

import {ScmCardButton} from './scmCardButton';

interface ScmPlatformRowProps {
  isSelected: boolean;
  name: string;
  onClick: () => void;
  platform: PlatformKey;
  // The first row skips its top divider; the parent list draws the frame.
  isFirst?: boolean;
}

/**
 * A single-line list entry for a detected platform: icon, name, and a radio
 * indicator. Meant to be stacked inside one framed list rather than laid out
 * as standalone cards. Selection lives on the row button; the radio only
 * mirrors it.
 */
export function ScmPlatformRow({
  platform,
  name,
  isSelected,
  isFirst,
  onClick,
}: ScmPlatformRowProps) {
  return (
    <RowButton onClick={onClick} role="radio" aria-checked={isSelected}>
      <Container borderTop={isFirst ? undefined : 'primary'} padding="xl">
        <Flex gap="lg" align="center">
          <Flex flexShrink={0}>
            <PlatformIcon platform={platform} size={20} format="lg" alt="" />
          </Flex>
          <Flex flexGrow={1} minWidth={0}>
            <InfoText title={name} mode="overflowOnly" bold size="md" textWrap="nowrap">
              {name}
            </InfoText>
          </Flex>
          {/* Presentational only: let the row own hover and cursor. */}
          <Flex pointerEvents="none">
            <Radio
              checked={isSelected}
              size="sm"
              role="presentation"
              tabIndex={-1}
              readOnly
            />
          </Flex>
        </Flex>
      </Container>
    </RowButton>
  );
}

const RowButton = styled(ScmCardButton)`
  display: block;
  width: 100%;

  &:hover {
    background: ${p => p.theme.tokens.background.secondary};
  }
`;
