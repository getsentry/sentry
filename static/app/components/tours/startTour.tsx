import {css, ThemeProvider} from '@emotion/react';
import styled from '@emotion/styled';

import {Flex} from '@sentry/scraps/layout';

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
      <TourContainer>
        <ModalImage {...img} />
        <TextContainer>
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
        </TextContainer>
      </TourContainer>
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

// XXX: The negative margin is to undo the global modal styling
const TourContainer = styled('div')`
  margin: -${p => p.theme.space['3xl']} -${p => p.theme.space['2xl']};
  @media (min-width: ${p => p.theme.breakpoints.md}) {
    margin: -${p => p.theme.space['3xl']};
  }
  border-radius: ${p => p.theme.radius.md};
  background: ${p => p.theme.tokens.background.primary};
  overflow: hidden;
`;

const TextContainer = styled('div')`
  padding: ${p => p.theme.space.lg} ${p => p.theme.space.xl};
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

export const startTourModalCss = css`
  width: 545px;
  [role='document'] {
    box-shadow: none;
    border: none;
  }
`;
