import styled from '@emotion/styled';

import stackedNavTourSvg from 'sentry-images/spot/stacked-nav-tour.svg';

import {TextTourAction, TourAction} from 'sentry/components/tours/components';
import {t} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import {space} from 'sentry/styles/space';
import {darkTheme} from 'sentry/utils/theme';

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
  const config = useLegacyStore(ConfigStore);
  const prefersDarkMode = config.theme === 'dark';

  return (
    <TourContainer prefersDarkMode={prefersDarkMode}>
      <ModalImage src={stackedNavTourSvg} />
      <TextContainer>
        <Header prefersDarkMode={prefersDarkMode}>
          {t('Welcome to a simpler Sentry')}
        </Header>
        <Description>
          {t('We redesigned our navigation to streamline how you triage.')}
        </Description>
        <Footer>
          <TextTourAction
            size="sm"
            onClick={() => {
              handleDismissTour();
              closeModal();
            }}
            borderless
          >
            {t('Maybe later')}
          </TextTourAction>
          <TourAction
            size="sm"
            onClick={() => {
              handleStartTour();
              closeModal();
            }}
            borderless
            autoFocus
          >
            {t('Take a tour')}
          </TourAction>
        </Footer>
      </TextContainer>
    </TourContainer>
  );
}

const ModalImage = styled('img')`
  width: calc(100% - ${space(1.5)} - ${space(1.5)});
  margin: ${space(1.5)} 0 0 ${space(1.5)};
  height: 272px;
  background-size: cover;
  background-position: center;
  border-radius: ${p => p.theme.borderRadius};
  overflow: hidden;
`;

// XXX: The negative margin is to undo the global modal styling
const TourContainer = styled('div')<{prefersDarkMode: boolean}>`
  margin: -${space(4)} -${space(3)};
  @media (min-width: ${p => p.theme.breakpoints.medium}) {
    margin: -${space(4)};
  }
  border-radius: ${p => p.theme.borderRadius};
  background: ${p => (p.prefersDarkMode ? darkTheme.purple300 : darkTheme.surface400)};
  overflow: hidden;
`;

const TextContainer = styled('div')`
  padding: ${space(1.5)} ${space(2)};
`;

const Header = styled('div')<{prefersDarkMode: boolean}>`
  color: ${p => (p.prefersDarkMode ? p.theme.white : darkTheme.headingColor)};
  font-size: ${p => p.theme.headerFontSize};
  font-weight: ${p => p.theme.fontWeightBold};
`;

const Description = styled('div')`
  font-size: ${p => p.theme.fontSizeMedium};
  color: ${p => p.theme.white};
  opacity: 0.8;
`;

const Footer = styled('div')`
  display: flex;
  justify-content: flex-end;
  margin-top: ${space(2)};
  gap: ${space(1)};
`;
