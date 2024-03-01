import {Fragment, useState} from 'react';
import styled from '@emotion/styled';

import controlCenter from 'sentry-images/spot/controlCenter.jpg';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {Button} from 'sentry/components/button';
import {IconLock} from 'sentry/icons';
import {IconGraphBar} from 'sentry/icons/iconGraphBar';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

export default function DataConsentModal({closeModal}: ModalRenderProps) {
  const [step, setStep] = useState(0);

  return (
    <Fragment>
      <ImageHeader />
      {step === 0 && (
        <div>
          <Subheader>{t('Less noise, more action')}</Subheader>
          <Title>{t('Help Sentry be more opinionated')}</Title>
          <Body>
            {t(
              "We're working on making issue alerts more actionable, improving prioritization, grouping, and more, but we need your help."
            )}
          </Body>
          <InfoHeader>
            <ConsentHeader>{t('Data Consent')}</ConsentHeader>
            <LearnMore onClick={() => setStep(1)}>{t('Learn More')}</LearnMore>
          </InfoHeader>

          <ConsentInfo>
            <ConsentRow>
              <StyledIconWrapper>
                <IconGraphBar size="xl" />
              </StyledIconWrapper>
              <ConsentLabel>
                <ConsentLabelHeader>{t('What we collect')}</ConsentLabelHeader>
                <ConsentLabelBody>
                  {t('Error message, stack traces, spans, and DOM interactions')}
                </ConsentLabelBody>
              </ConsentLabel>
            </ConsentRow>
            <Divider />
            <ConsentRow>
              <StyledIconWrapper>
                <IconLock isSolid size="xl" />
              </StyledIconWrapper>
              <ConsentLabel>
                <ConsentLabelHeader>{t('How we store and use it')}</ConsentLabelHeader>
                <ConsentLabelBody>{t('Only within Sentry')}</ConsentLabelBody>
              </ConsentLabel>
            </ConsentRow>
          </ConsentInfo>
        </div>
      )}

      {step === 1 && (
        <div>
          <Subheader learnMore>{t('Data Consent')}</Subheader>
          <LearnMoreHeader>{t('What we collect')}</LearnMoreHeader>
          <LearnMoreBody>
            {t(
              'Sentry will collect error messages, stack traces, spans, and DOM interactions to train and validate models. These models will be used to improve alert accuracy and relevance, issue prioritization, suggested fixes, and more.'
            )}
          </LearnMoreBody>
          <LearnMoreHeader>{t('How we store and use it')}</LearnMoreHeader>
          <LearnMoreBody>
            {t(
              'Sentry stores data within Sentry only. We will not share it with any sub-processor or third party without additional consent from you.'
            )}
          </LearnMoreBody>
        </div>
      )}
      <Footer>
        {step === 0 && <Button onClick={closeModal}>{t('Maybe later')}</Button>}
        {step === 0 && <Button priority="primary">{t("I'll help")}</Button>}
        {step === 1 && <Button onClick={() => setStep(0)}>{t('Back')}</Button>}
      </Footer>
    </Fragment>
  );
}

const Title = styled('h3')`
  margin-bottom: ${space(1)};
`;

const Subheader = styled('p')<{learnMore?: boolean}>`
  text-transform: uppercase;
  color: ${p => (p.learnMore ? p.theme.gray300 : p.theme.pink300)};
  font-size: ${p => p.theme.fontSizeMedium};
  font-weight: bold;
  margin-bottom: ${space(1)};
`;

const Body = styled('div')`
  font-size: ${p => p.theme.fontSizeLarge};
  margin-bottom: ${space(2)};
`;

const InfoHeader = styled('div')`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
`;

const ConsentHeader = styled('p')`
  font-weight: bold;
  color: ${p => p.theme.gray300};
  text-transform: uppercase;
  margin-bottom: ${space(1)};
`;

const ConsentInfo = styled('div')`
  background-color: ${p => p.theme.backgroundSecondary};
  border-radius: ${p => p.theme.panelBorderRadius};
  padding-top: ${space(3)};
  padding-bottom: ${space(3)};
`;

const ConsentRow = styled('div')`
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: ${space(3)};
`;

const ConsentLabel = styled('div')`
  display: flex;
  flex-direction: column;
`;

const ConsentLabelHeader = styled('h5')`
  margin-bottom: ${space(0.5)};
`;
const ConsentLabelBody = styled('p')`
  margin-bottom: ${space(0.5)};
  color: ${p => p.theme.gray300};
`;

const LearnMoreHeader = styled('h4')`
  margin-bottom: ${space(1)};
`;

const LearnMoreBody = styled('div')`
  font-size: ${p => p.theme.fontSizeLarge};
  margin-bottom: ${space(3)};
`;
const StyledIconWrapper = styled('span')`
  margin-left: ${space(3)};
  color: ${p => p.theme.gray300};
`;

const Footer = styled('div')`
  display: flex;
  flex-direction: row;
  justify-content: right;
  gap: ${space(1)};
  margin-top: ${space(2)};
`;

const LearnMore = styled('a')`
  font-weight: bold;
  text-transform: uppercase;
`;

const ImageHeader = styled('div')`
  margin: -${space(4)} -${space(4)} 0 -${space(4)};
  border-radius: ${p => p.theme.modalBorderRadius} ${p => p.theme.modalBorderRadius} 0 0;
  background-image: url(${controlCenter});
  background-size: 620px;
  background-repeat: no-repeat;
  overflow: hidden;
  background-position: center;
  height: 200px;
  clip-path: polygon(100% 0%, 0% 0%, 0% 85%, 15% 75%, 80% 95%, 90% 85%, 100% 85%);
`;

const Divider = styled('hr')`
  width: 95%;
  height: 1px;
  background: ${p => p.theme.border};
  border: none;
  margin-top: ${space(2)};
  margin-bottom: ${space(2)};
`;
