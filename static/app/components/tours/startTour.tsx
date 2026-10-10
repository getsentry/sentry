import {css as emotionCss, ThemeProvider} from '@emotion/react';
import styled from '@emotion/styled';
import {css} from '@linaria/core';

import {Flex, Container} from '@sentry/scraps/layout';
import {theme as linariaTheme} from '@sentry/scraps/theme';

import {TextTourAction, TourAction} from 'sentry/components/tours/components';
import {t} from 'sentry/locale';
import {useInvertedTheme} from 'sentry/utils/theme/useInvertedTheme';

interface StartTourModalProps {
  closeModal: () => void;
  description: React.ReactNode;
  header: React.ReactNode;
  img: {
    alt: string;
    src: string;
  };
  onDismissTour: () => void;
  onStartTour: () => void;
}

export function StartTourModal({
  closeModal,
  onDismissTour,
  onStartTour,
  img,
  header,
  description,
}: StartTourModalProps) {
  const invertedTheme = useInvertedTheme();
  return (
    <ThemeProvider theme={invertedTheme}>
      <Container
        radius="md"
        background="primary"
        overflow="hidden"
        customCss={css`
          margin: -${linariaTheme.space['3xl']} -${linariaTheme.space['2xl']};

          @container (min-width: ${linariaTheme.container['3xl']}) {
            margin-inline: -${linariaTheme.space['3xl']};
          }
        `}
      >
        <ModalImage {...img} />
        <Container padding="lg xl">
          <Header>{header}</Header>
          <Description>{description}</Description>
          <Flex justify="end" marginTop="xl" gap="md">
            <TextTourAction
              onClick={() => {
                onDismissTour();
                closeModal();
              }}
            >
              {t('Maybe later')}
            </TextTourAction>
            <TourAction
              onClick={() => {
                onStartTour();
                closeModal();
              }}
              autoFocus
            >
              {t('Take a tour')}
            </TourAction>
          </Flex>
        </Container>
      </Container>
    </ThemeProvider>
  );
}

const ModalImage = styled('img')`
  width: calc(100% - ${p => p.theme.space.lg} - ${p => p.theme.space.lg});
  margin: ${p => p.theme.space.lg} 0 0 ${p => p.theme.space.lg};
  background-size: cover;
  background-position: center;
  border-radius: ${p => p.theme.radius.md};
  overflow: hidden;
`;

const Header = styled('div')`
  color: ${p => p.theme.tokens.content.primary};
  font-size: ${p => p.theme.font.size.xl};
  font-weight: ${p => p.theme.font.weight.sans.medium};
`;

const Description = styled('div')`
  font-size: ${p => p.theme.font.size.md};
  color: ${p => p.theme.tokens.content.primary};
  white-space: pre-line;
`;

export const startTourModalCss = emotionCss`
  width: 545px;
  [role='document'] {
    box-shadow: none;
    border: none;
  }
`;
