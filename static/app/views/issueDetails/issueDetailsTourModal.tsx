import {css} from '@emotion/react';
import styled from '@emotion/styled';

import issueDetailsPreviewDark from 'sentry-images/issue_details/issue-details-preview-dark.png';
import issueDetailsPreviewLight from 'sentry-images/issue_details/issue-details-preview-light.png';

import {TextTourAction, TourAction} from 'sentry/components/tours/components';
import {t} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import {space} from 'sentry/styles/space';

interface IssueDetailsTourModalProps {
  handleDismissTour: () => void;
  handleStartTour: () => void;
}

export function IssueDetailsTourModal({
  handleDismissTour,
  handleStartTour,
}: IssueDetailsTourModalProps) {
  const config = useLegacyStore(ConfigStore);
  const prefersDarkMode = config.theme === 'dark';

  return (
    <TourContainer>
      <ImageContainer
        alt={t('Preview of the issue details experience')}
        src={prefersDarkMode ? issueDetailsPreviewLight : issueDetailsPreviewDark}
      />
      <TextContainer>
        <Header>{t('Welcome to Issue Details')}</Header>
        <Description>
          {t(
            "New around here? Tour the issue experience - we promise you'll be less confused."
          )}
        </Description>
        <Footer>
          <TextTourAction size="sm" onClick={handleDismissTour} borderless>
            {t('Maybe later')}
          </TextTourAction>
          <TourAction size="sm" onClick={handleStartTour} borderless autoFocus>
            {t('Take tour')}
          </TourAction>
        </Footer>
      </TextContainer>
    </TourContainer>
  );
}

const ImageContainer = styled('img')`
  display: block;
  height: 272px;
  width: calc(100% - ${space(1.5)} - ${space(1.5)});
  margin: ${space(1.5)} auto 0;
  background-size: cover;
  background-position: center;
  border: 1px solid ${p => p.theme.inverted.translucentBorder};
  border-radius: ${p => p.theme.borderRadius};
  overflow: hidden;
`;

// XXX: The negative margin is to undo the global modal styling
const TourContainer = styled('div')`
  margin: -${space(4)} -${space(3)};
  @media (min-width: ${p => p.theme.breakpoints.medium}) {
    margin: -${space(4)};
  }
  border-radius: ${p => p.theme.borderRadius};
  background: ${p => p.theme.tour.background};
  overflow: hidden;
`;

const TextContainer = styled('div')`
  padding: ${space(1.5)} ${space(2)};
`;

const Header = styled('div')`
  color: ${p => p.theme.tour.header};
  font-size: ${p => p.theme.headerFontSize};
  font-weight: ${p => p.theme.fontWeightBold};
`;

const Description = styled('div')`
  font-size: ${p => p.theme.fontSize.md};
  color: ${p => p.theme.tour.text};
  opacity: 0.8;
`;

const Footer = styled('div')`
  display: flex;
  justify-content: flex-end;
  margin-top: ${space(2)};
  gap: ${space(1)};
`;

export const IssueDetailsTourModalCss = css`
  width: 545px;
`;
