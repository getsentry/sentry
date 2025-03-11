import {Fragment} from 'react';
import styled from '@emotion/styled';
import missionControl from 'getsentry-images/missionControl.jpg';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {updateOrganization} from 'sentry/actionCreators/organizations';
import {Button, LinkButton} from 'sentry/components/button';
import ExternalLink from 'sentry/components/links/externalLink';
import {IconClose, IconFix, IconLock} from 'sentry/icons';
import {IconGraphBar} from 'sentry/icons/iconGraphBar';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import {useMutation} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';

import trackGetsentryAnalytics from 'getsentry/utils/trackGetsentryAnalytics';

export default function DataConsentModal({closeModal}: ModalRenderProps) {
  const organization = useOrganization();
  const api = useApi();

  const {mutate: updateOrganizationOption, isPending} = useMutation<Organization>({
    mutationFn: () =>
      api.requestPromise(`/organizations/${organization.slug}/data-consent/`, {
        method: 'PUT',
        data: {aggregatedDataConsent: true},
      }),
    onSuccess: () => {
      closeModal();
      addSuccessMessage(t('Updated data consent settings.'));
      updateOrganization({id: organization.id, aggregatedDataConsent: true});
    },
    onError: () => {
      addErrorMessage(t('Failed to update data consent settings.'));
    },
  });

  return (
    <Fragment>
      <ImageHeader />
      <DismissButton
        analyticsEventKey="data_consent_banner.dismissed"
        analyticsEventName="Data Consent Banner: Dismissed"
        size="zero"
        borderless
        icon={<IconClose size="xs" />}
        aria-label={t('Dismiss')}
        onClick={() => closeModal()}
      />
      <div>
        <Subheader>{t('Less noise, more action')}</Subheader>
        <Title>{t('Help Sentry be more opinionated')}</Title>
        <Body>
          {t(
            "We're working to improve grouping, alert relevance, issue prioritization, and more, and we need your help."
          )}
        </Body>
        <InfoHeader>
          <ConsentHeader>{t('Data Consent')}</ConsentHeader>
          <LearnMore
            href="https://docs.sentry.io/product/security/ai-ml-policy/"
            onClick={() =>
              trackGetsentryAnalytics('data_consent_modal.learn_more', {organization})
            }
          >
            {t('Learn More')}
          </LearnMore>
        </InfoHeader>

        <ConsentInfo>
          <ConsentRow>
            <StyledIconWrapper>
              <IconGraphBar size="lg" />
            </StyledIconWrapper>
            <ConsentLabel>
              <ConsentLabelHeader>{t('What data do we access?')}</ConsentLabelHeader>
              <ConsentLabelBody>
                {t(
                  'Sentry will access error messages, stack traces, spans, and DOM interactions.'
                )}
              </ConsentLabelBody>
            </ConsentLabel>
          </ConsentRow>
          <Divider />
          <ConsentRow>
            <StyledIconWrapper>
              <IconFix size="lg" />
            </StyledIconWrapper>
            <ConsentLabel>
              <ConsentLabelHeader>{t('How do we use it?')}</ConsentLabelHeader>
              <ConsentLabelBody>
                {t(
                  'The data will be used to train and validate models to improve our product.'
                )}
              </ConsentLabelBody>
            </ConsentLabel>
          </ConsentRow>
          <Divider />
          <ConsentRow>
            <StyledIconWrapper>
              <IconLock locked size="lg" />
            </StyledIconWrapper>
            <ConsentLabel>
              <ConsentLabelHeader>{t('Where does it go?')}</ConsentLabelHeader>
              <ConsentLabelBody>
                {t(
                  "We store data within Sentry's standard infrastructure. We will not share it with other customers or AI sub-processors without additional consent."
                )}
              </ConsentLabelBody>
            </ConsentLabel>
          </ConsentRow>
        </ConsentInfo>
      </div>
      <Footer>
        <Button
          analyticsEventKey="data_consent_modal.maybe_later"
          analyticsEventName="Data Consent Modal: Maybe Later"
          busy={isPending}
          onClick={() => {
            closeModal();
          }}
        >
          {t('Maybe later')}
        </Button>
        <LinkButton
          analyticsEventKey="data_consent_modal.settings"
          analyticsEventName="Data Consent Modal: Settings"
          href="/settings/legal/#aggregatedDataConsent"
          busy={isPending}
        >
          {t('View Settings')}
        </LinkButton>
        <Button
          analyticsEventKey="data_consent_modal.accepted"
          analyticsEventName="Data Consent Modal: Accepted"
          onClick={() => {
            updateOrganizationOption();
          }}
          priority="primary"
          busy={isPending}
        >
          {t('I agree')}
        </Button>
      </Footer>
    </Fragment>
  );
}

const Title = styled('h3')`
  margin-bottom: ${space(1)};
`;

const Subheader = styled('p')`
  text-transform: uppercase;
  color: ${p => p.theme.pink300};
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
  border-radius: ${p => p.theme.borderRadius};
  padding-top: ${space(1.5)};
  padding-bottom: ${space(1.5)};
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

const ConsentLabelHeader = styled('div')`
  font-weight: 600;
  font-size: ${p => p.theme.fontSizeLarge};
`;
const ConsentLabelBody = styled('p')`
  margin-bottom: 0;
  color: ${p => p.theme.gray300};
  font-size: ${p => p.theme.fontSizeMedium};
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
  margin-top: ${space(3)};
`;

const LearnMore = styled(ExternalLink)`
  font-weight: bold;
  text-transform: uppercase;

  &:hover {
    text-decoration: underline;
    text-decoration-color: ${p => p.theme.blue200};
  }
`;

const ImageHeader = styled('div')`
  margin: -${space(4)} -${space(4)} 0 -${space(4)};
  border-radius: ${p => p.theme.borderRadius} ${p => p.theme.borderRadius} 0 0;
  background-image: url(${missionControl});
  background-size: cover;
  background-repeat: no-repeat;
  overflow: hidden;
  background-position: center;
  height: 200px;
  clip-path: polygon(100% 0%, 0% 0%, 0% 85%, 15% 75%, 80% 95%, 90% 85%, 100% 85%);

  @media (max-width: ${p => p.theme.breakpoints.medium}) {
    margin: -${space(4)} -${space(3)} 0 -${space(3)};
  }
`;

const Divider = styled('hr')`
  width: 95%;
  height: 1px;
  background: ${p => p.theme.gray100};
  border: none;
  margin-top: ${space(1.5)};
  margin-bottom: ${space(1.5)};
`;

const DismissButton = styled(Button)`
  position: absolute;
  top: ${space(1)};
  right: ${space(1)};
  color: ${p => p.theme.subText};
  z-index: 1;
  background-color: rgba(255, 255, 255, 0.8);
  border-radius: 50%;
`;
