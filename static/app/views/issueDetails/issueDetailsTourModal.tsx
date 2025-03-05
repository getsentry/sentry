import {css} from '@emotion/react';
import styled from '@emotion/styled';

import issueDetailsPreviewImage from 'sentry-images/spot/issue-details-preview.svg';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {Button} from 'sentry/components/button';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

interface IssueDetailsTourModalProps extends ModalRenderProps {
  handleStartTour: () => void;
}

export function IssueDetailsTourModal({
  closeModal,
  handleStartTour,
}: IssueDetailsTourModalProps) {
  return (
    <TourContainer>
      <Image src={issueDetailsPreviewImage} alt={t('Issue details preview')} />
      <TextContainer>
        <Header>{t('Welcome to the new issue details')}</Header>
        <Description>
          {t('We redesigned this page to streamline triage workflows.')}
        </Description>
        <Footer>
          <Button size="sm" onClick={closeModal}>
            {t('I got it')}
          </Button>
          <Button priority="primary" size="sm" onClick={handleStartTour}>
            {t('Take a tour')}
          </Button>
        </Footer>
      </TextContainer>
    </TourContainer>
  );
}

const Image = styled('img')`
  width: 100%;
  height: 100%;
  border-radius: ${p => p.theme.borderRadius} ${p => p.theme.borderRadius} 0 0;
`;

// XXX: The negative margin is to undo the global modal styling
const TourContainer = styled('div')`
  margin: -${space(4)} -${space(3)};
  @media (min-width: ${p => p.theme.breakpoints.medium}) {
    margin: -${space(4)};
  }
`;

const TextContainer = styled('div')`
  padding: ${space(1.5)} ${space(2)};
`;

const Header = styled('div')`
  font-size: ${p => p.theme.headerFontSize};
  font-weight: ${p => p.theme.fontWeightBold};
`;

const Description = styled('div')`
  font-size: ${p => p.theme.fontSizeMedium};
  color: ${p => p.theme.subText};
`;

const Footer = styled('div')`
  display: flex;
  justify-content: flex-end;
  margin-top: ${space(2)};
  gap: ${space(1)};
`;

export const IssueDetailsTourModalCss = css`
  width: 436px;
`;
