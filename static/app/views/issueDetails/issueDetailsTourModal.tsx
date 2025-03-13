import {css} from '@emotion/react';
import styled from '@emotion/styled';

import issueDetailsPreviewImage from 'sentry-images/spot/issue-details-preview.svg';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {Button} from 'sentry/components/core/button';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

interface IssueDetailsTourModalProps extends ModalRenderProps {
  handleDismissTour: () => void;
  handleStartTour: () => void;
}

export function IssueDetailsTourModal({
  handleDismissTour,
  handleStartTour,
}: IssueDetailsTourModalProps) {
  return (
    <TourContainer>
      <ImageContainer />
      <TextContainer>
        <Header>{t('Welcome to the new Issue Details')}</Header>
        <Description>{t('Make the most out of the redesigned experience.')}</Description>
        <Footer>
          <InvertedButton size="sm" onClick={handleDismissTour} borderless>
            {t('Got it')}
          </InvertedButton>
          <InvertedButtonPrimary size="sm" onClick={handleStartTour} borderless autoFocus>
            {t('Take a tour')}
          </InvertedButtonPrimary>
        </Footer>
      </TextContainer>
    </TourContainer>
  );
}

const ImageContainer = styled('div')`
  width: 100%;
  height: 260px;
  background-image: url(${issueDetailsPreviewImage});
  background-size: cover;
  background-position: center;
`;

// XXX: The negative margin is to undo the global modal styling
const TourContainer = styled('div')`
  margin: -${space(4)} -${space(3)};
  @media (min-width: ${p => p.theme.breakpoints.medium}) {
    margin: -${space(4)};
  }
  border-radius: ${p => p.theme.borderRadius};
  background: ${p => p.theme.inverted.backgroundElevated};
  overflow: hidden;
`;

const TextContainer = styled('div')`
  padding: ${space(1.5)} ${space(2)};
`;

const Header = styled('div')`
  color: ${p => p.theme.inverted.headingColor};
  font-size: ${p => p.theme.headerFontSize};
  font-weight: ${p => p.theme.fontWeightBold};
`;

const Description = styled('div')`
  font-size: ${p => p.theme.fontSizeMedium};
  color: ${p => p.theme.inverted.subText};
`;

const Footer = styled('div')`
  display: flex;
  justify-content: flex-end;
  margin-top: ${space(2)};
  gap: ${space(1)};
`;

const InvertedButton = styled(Button)`
  color: ${p => p.theme.inverted.textColor};
  &:hover,
  &:active,
  &:focus {
    color: ${p => p.theme.inverted.textColor};
  }
`;

const InvertedButtonPrimary = styled(Button)`
  background: ${p => p.theme.backgroundElevated};
  color: ${p => p.theme.textColor};
  &:hover,
  &:active,
  &:focus {
    color: ${p => p.theme.textColor};
  }
`;

export const IssueDetailsTourModalCss = css`
  width: 436px;
`;
