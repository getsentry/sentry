import {useEffect, useMemo} from 'react';
import styled from '@emotion/styled';

import {Flex} from 'sentry/components/core/layout';
import {Text} from 'sentry/components/core/text';
import {IconSeer} from 'sentry/icons/iconSeer';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {CardRendererProps} from 'sentry/types/missionControl';
import useOrganization from 'sentry/utils/useOrganization';

interface WelcomeCardData {
  totalItems: number;
  userName: string;
}

const FUNNY_GREETINGS = [
  'Howdy',
  'Good day to debug',
  'Fires are normal',
  'Hello',
  'Hi there',
];

function WelcomeCardRenderer({
  card,
  onSetPrimaryAction,
}: CardRendererProps<WelcomeCardData>) {
  const organization = useOrganization();
  const {userName, totalItems} = card.data;

  // Pick a random greeting that stays consistent for this card
  const greeting = useMemo(() => {
    return FUNNY_GREETINGS[Math.floor(Math.random() * FUNNY_GREETINGS.length)];
  }, []);

  useEffect(() => {
    // Set up the primary action to start reviewing items
    onSetPrimaryAction({
      label: t('Get it over with'),
      handler: async () => {
        // No actual action needed - Mission Control will move to next card
      },
      loadingLabel: t('Starting...'),
    });

    return () => onSetPrimaryAction(null);
  }, [onSetPrimaryAction]);

  let shortenUserName = userName.split(' ')[0];
  shortenUserName = shortenUserName ? shortenUserName.split('@')[0] : userName;

  return (
    <WelcomeContainer>
      <Content>
        <Flex direction="row" align="center" gap={'2xl'}>
          <div>
            <Text size="2xl" bold align="right">
              {greeting}, {shortenUserName}.<br />
              <br />
            </Text>
            <Text size="2xl" align="right">
              Seer has {totalItems} recommended
              <br />
              item{totalItems === 1 ? '' : 's'} for you right now.
            </Text>
          </div>
          <ColoredIconSeer variant="waiting" size="2xl" />
        </Flex>

        <InstructionsContainer>
          <Text size="sm">
            Visit{' '}
            <a
              href={`/organizations/${organization.slug}/issues/`}
              rel="noopener noreferrer"
            >
              Feed
            </a>{' '}
            to see all your issues.
          </Text>

          <KeyboardHints>
            <HintRow>
              <KeyBadge>←</KeyBadge>
              <Text size="xs" variant="muted">
                Dismiss
              </Text>
            </HintRow>
            <HintRow>
              <KeyBadge>↑</KeyBadge>
              <Text size="xs" variant="muted">
                Move to back
              </Text>
            </HintRow>
            <HintRow>
              <KeyBadge>↓</KeyBadge>
              <Text size="xs" variant="muted">
                Navigate
              </Text>
            </HintRow>
            <HintRow>
              <KeyBadge>→</KeyBadge>
              <Text size="xs" variant="muted">
                Take action
              </Text>
            </HintRow>
          </KeyboardHints>
        </InstructionsContainer>
      </Content>
    </WelcomeContainer>
  );
}

const WelcomeContainer = styled('div')`
  border-radius: ${p => p.theme.borderRadius};
  color: white;
  height: 100%;
  display: flex;
  flex-direction: column;
`;

const Content = styled('div')`
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: ${space(4)};
  text-align: center;
  gap: ${space(2)};
`;

const InstructionsContainer = styled('div')`
  margin-top: ${space(3)};
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${space(2)};
`;

const KeyboardHints = styled('div')`
  display: flex;
  gap: ${space(3)};
  margin-top: ${space(1)};
  flex-wrap: wrap;
  justify-content: center;

  @media (max-width: 768px) {
    gap: ${space(2)};
  }
`;

const HintRow = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(1)};
`;

const KeyBadge = styled('kbd')`
  background: ${p => p.theme.backgroundSecondary};
  color: ${p => p.theme.textColor};
  padding: ${space(0.5)} ${space(1)};
  border-radius: ${p => p.theme.borderRadius};
  font-size: ${p => p.theme.fontSize.sm};
  font-family: ${p => p.theme.text.family};
  border: 1px solid ${p => p.theme.border};
`;

const ColoredIconSeer = styled(IconSeer)`
  color: ${p => p.theme.textColor};
`;

export default WelcomeCardRenderer;
