import {PlatformIcon} from 'platformicons';

import {InfoText} from '@sentry/scraps/info';
import {Container, Flex} from '@sentry/scraps/layout';
import {Radio} from '@sentry/scraps/radio';

import type {PlatformKey} from 'sentry/types/platform';
import {ONBOARDING_ENTER} from 'sentry/views/onboarding/animations';

import {ScmSelectableCardButton} from './scmCardButton';

interface ScmPlatformCardProps {
  isSelected: boolean;
  name: string;
  onClick: () => void;
  platform: PlatformKey;
  autoFocus?: boolean;
}

/**
 * A detected platform as its own card: icon, name, and a radio indicator.
 * Meant to be laid out in a grid alongside its siblings. Selection lives on the
 * card button; the radio only mirrors it.
 */
export function ScmPlatformCard({
  platform,
  name,
  isSelected,
  onClick,
  autoFocus,
}: ScmPlatformCardProps) {
  return (
    <ScmSelectableCardButton
      onClick={onClick}
      role="radio"
      aria-checked={isSelected}
      autoFocus={autoFocus}
      {...ONBOARDING_ENTER}
    >
      <Container height="100%" radius="lg" padding="xl">
        <Flex gap="lg" align="center">
          <Flex flexShrink={0}>
            <PlatformIcon platform={platform} size={20} format="lg" alt="" />
          </Flex>
          <Flex flexGrow={1} minWidth={0}>
            <InfoText title={name} mode="overflowOnly" bold size="md" textWrap="nowrap">
              {name}
            </InfoText>
          </Flex>
          {/* Visual only: the card button carries the radio role and state, so
            the radio is hidden from the accessibility tree. */}
          <Flex pointerEvents="none">
            <Radio checked={isSelected} size="sm" aria-hidden tabIndex={-1} readOnly />
          </Flex>
        </Flex>
      </Container>
    </ScmSelectableCardButton>
  );
}
