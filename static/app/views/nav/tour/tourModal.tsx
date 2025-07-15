import {css, ThemeProvider} from '@emotion/react';
import styled from '@emotion/styled';

import stackedNavTourSvg from 'sentry-images/spot/stacked-nav-tour.svg';

import {TextTourAction, TourAction} from 'sentry/components/tours/components';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {useInvertedTheme} from 'sentry/utils/theme/theme';

interface NavTourModalProps {
  closeModal: () => void;
  handleDismissTour: () => void;
  handleStartTour: () => void;
}

export function NavTourModal({
  closeModal,
  handleDismissTour,
  handleStartTour,
}: NavTourModalProps) {
  const invertedTheme = useInvertedTheme();
  return (
    <ThemeProvider theme={invertedTheme}>
      <TourContainer>
        <ModalImage src={stackedNavTourSvg} />
        <TextContainer>
          <Header>{t('Welcome to a simpler Sentry')}</Header>
          <Description>
            {t(
              'Find what you need, faster. Our new navigation puts your top workflows front and center.'
            )}
          </Description>
          <Footer>
            <TextTourAction
              onClick={() => {
                handleDismissTour();
                closeModal();
              }}
            >
              {t('Maybe later')}
            </TextTourAction>
            <TourAction
              onClick={() => {
                handleStartTour();
                closeModal();
              }}
              autoFocus
            >
              {t('Take a tour')}
            </TourAction>
          </Footer>
        </TextContainer>
      </TourContainer>
    </ThemeProvider>
  );
}

const ModalImage = styled('img')`
  height: 226px;
  width: calc(100% - ${space(1.5)} - ${space(1.5)});
  margin: ${space(1.5)} 0 0 ${space(1.5)};
  background-size: cover;
  background-position: center;
  border-radius: ${p => p.theme.borderRadius};
  overflow: hidden;
`;

// XXX: The negative margin is to undo the global modal styling
const TourContainer = styled('div')`
  margin: -${space(4)} -${space(3)};
  @media (min-width: ${p => p.theme.breakpoints.md}) {
    margin: -${space(4)};
  }
  border-radius: ${p => p.theme.borderRadius};
  background: ${p => p.theme.tokens.background.primary};
  overflow: hidden;
`;

const TextContainer = styled('div')`
  padding: ${space(1.5)} ${space(2)};
`;

const Header = styled('div')`
  color: ${p => p.theme.tokens.content.primary};
  font-size: ${p => p.theme.headerFontSize};
  font-weight: ${p => p.theme.fontWeight.bold};
`;

const Description = styled('div')`
  font-size: ${p => p.theme.fontSize.md};
  color: ${p => p.theme.tokens.content.primary};
`;

const Footer = styled('div')`
  display: flex;
  justify-content: flex-end;
  margin-top: ${space(2)};
  gap: ${space(1)};
`;

export const navTourModalCss = css`
  width: 545px;
  [role='document'] {
    box-shadow: none;
  }
`;
