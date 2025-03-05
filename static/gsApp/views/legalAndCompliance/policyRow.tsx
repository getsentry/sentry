import {Fragment} from 'react';
import type {Theme} from '@emotion/react';
import {css, useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import moment from 'moment-timezone';

import {openModal} from 'sentry/actionCreators/modal';
import {Button, LinkButton} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import {t, tct} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import {space} from 'sentry/styles/space';
import {isActiveSuperuser} from 'sentry/utils/isActiveSuperuser';
import {safeURL} from 'sentry/utils/url/safeURL';
import useOrganization from 'sentry/utils/useOrganization';

import type {Policy, Subscription} from 'getsentry/types';
import {PanelItemPolicy} from 'getsentry/views/legalAndCompliance/styles';

type PolicyRowProps = {
  onAccept: (policy: Policy) => void;
  policies: Record<string, Policy>;
  policy: Policy;
  subscription: Subscription;
  showConsentText?: boolean;
  showUpdated?: boolean;
};

// TODO(dcramer): we dont yet support multiple parent policies if a policy in the
// chain does not require signature (and instead would just have you page through it)
export function PolicyRow({
  policy,
  policies,
  showUpdated,
  showConsentText = true,
  onAccept,
  subscription,
}: PolicyRowProps) {
  const theme = useTheme();
  const organization = useOrganization();

  const parentPolicy = policy.parent ? policies[policy.parent] : null;
  const curPolicy = parentPolicy && !parentPolicy.consent ? parentPolicy : policy;

  const user = ConfigStore.get('user');
  const companyName = subscription?.companyName ?? organization.name;
  const activeSuperUser = isActiveSuperuser();
  const hasBillingAccess = organization.access.includes('org:billing');

  const policyUrl = policy.url ? safeURL(policy.url) : null;
  // userCurrentVersion filters version select dropdown to only the current version + latest version
  if (policyUrl && policy.consent) {
    policyUrl.searchParams.set('userCurrentVersion', policy.consent.acceptedVersion);
  }

  const showPolicy = (e: React.MouseEvent) => {
    let dialog: Window | null = null;
    e.preventDefault();

    const name = 'sentryPolicy';
    const width = 600;
    const height = 600;
    const url = policy.url;

    // this attempts to center the dialog
    const innerWidth = window.innerWidth
      ? window.innerWidth
      : document.documentElement.clientWidth
        ? document.documentElement.clientWidth
        : screen.width;
    const innerHeight = window.innerHeight
      ? window.innerHeight
      : document.documentElement.clientHeight
        ? document.documentElement.clientHeight
        : screen.height;
    const left = innerWidth / 2 - width / 2 + window.screenLeft;
    const top = innerHeight / 2 - height / 2 + window.screenTop;

    dialog = url
      ? window.open(
          url,
          name,
          `scrollbars=yes, width=${width}, height=${height}, top=${top}, left=${left}`
        )
      : null;
    // @ts-expect-error TS(2774): This condition will always return true since this ... Remove this comment to see the full error message
    if (window.focus) {
      dialog?.focus();
    }
  };

  const showModal = () => {
    openModal(
      ({Header, Footer, Body, closeModal}) => (
        <Fragment>
          <Header>
            {curPolicy.slug !== policy.slug ? (
              <div style={{textAlign: 'center'}}>
                {tct("You must first agree to Sentry's [policy]", {
                  policy: <a onClick={showPolicy}>{curPolicy.name}</a>,
                })}
              </div>
            ) : (
              <PolicyHeader>
                <h5>{curPolicy.name}</h5>
                <Button size="sm" onClick={showPolicy}>
                  {t('Download')}
                </Button>
              </PolicyHeader>
            )}
          </Header>
          <Body>
            <PolicyFrame
              src={policyUrl ? policyUrl.toString() : undefined}
              data-test-id="policy-iframe"
            />
            {curPolicy.hasSignature && (
              <div style={{fontSize: '0.9em'}}>
                <p style={{marginBottom: 10}}>You represent and warrant that:</p>
                <ol style={{marginBottom: 10}}>
                  <li>
                    you have full legal authority to agree to these terms presented above
                    on behalf of <strong>{companyName}</strong>;
                  </li>
                  <li>you have read and understand these terms; and</li>
                  <li>
                    you agree, on behalf of <strong>{companyName}</strong>, to these
                    terms.
                  </li>
                </ol>
                <p>
                  If you do not have the authority to bind <strong>{companyName}</strong>,
                  or do not agree to these terms, do not click the "I Accept" button
                  below.
                </p>
              </div>
            )}
          </Body>
          <Footer>
            {curPolicy.hasSignature ? (
              <PolicyActions>
                <small>
                  {tct('You are agreeing as [email]', {
                    email: <strong>{user.email}</strong>,
                  })}
                </small>

                <ButtonBar gap={1}>
                  <Button size="sm" onClick={closeModal}>
                    {t('Cancel')}
                  </Button>
                  <Button
                    size="sm"
                    priority="primary"
                    onClick={() => {
                      onAccept(curPolicy);
                      closeModal();
                    }}
                  >
                    {t('I Accept')}
                  </Button>
                </ButtonBar>
              </PolicyActions>
            ) : (
              <Button size="sm" onClick={closeModal}>
                {t('Close')}
              </Button>
            )}
          </Footer>
        </Fragment>
      ),
      {modalCss: modalCss(theme)}
    );
  };

  const getPolicySubstatus = () => {
    const {consent, updatedAt, version} = policy;
    if (consent && showConsentText) {
      let consentText = `Version ${consent.acceptedVersion} signed ${moment(
        consent.createdAt
      ).format('ll')}`;
      if (version && consent.acceptedVersion < version) {
        consentText = `${consentText}. New version available`;
      }
      return consentText;
    }
    if (showUpdated) {
      return `Updated on ${moment(updatedAt).format('ll')}`;
    }
    return '';
  };

  return (
    <PanelItemPolicy>
      <div>
        <PolicyTitle style={{marginBottom: showUpdated ? space(0.5) : 0}}>
          {policy.slug === 'terms' ? 'Terms of Service' : policy.name}
        </PolicyTitle>
        <PolicySubtext>{getPolicySubstatus()}</PolicySubtext>
      </div>
      <div>
        {policy.url &&
          policyUrl &&
          (policy.consent?.acceptedVersion === policy.version ? (
            <LinkButton size="sm" external href={policyUrl.toString()}>
              {t('Review')}
            </LinkButton>
          ) : policy.hasSignature &&
            policy.slug !== 'privacy' &&
            policy.slug !== 'terms' ? (
            <Button
              size="sm"
              priority="primary"
              onClick={showModal}
              disabled={activeSuperUser || !hasBillingAccess}
              title={
                activeSuperUser
                  ? t("Superusers can't consent to policies")
                  : !hasBillingAccess
                    ? t(
                        "You don't have access to manage billing and subscription details."
                      )
                    : undefined
              }
            >
              {t('Review and Accept')}
            </Button>
          ) : (
            <LinkButton size="sm" external href={policy.url}>
              {t('Review')}
            </LinkButton>
          ))}
      </div>
    </PanelItemPolicy>
  );
}

const PolicyFrame = styled('iframe')`
  height: 300px;
  width: 100%;
  border: 1px solid ${p => p.theme.innerBorder};
  border-radius: 3px;
  margin-bottom: ${space(1)};
`;

const PolicySubtext = styled('div')`
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.subText};
`;

const PolicyTitle = styled('h6')`
  @media (max-width: ${p => p.theme.breakpoints.small}) {
    font-size: ${p => p.theme.fontSizeLarge};
  }
`;

const PolicyHeader = styled('div')`
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const PolicyActions = styled('div')`
  flex-grow: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const modalCss = (theme: Theme) => css`
  @media (min-width: ${theme.breakpoints.small}) {
    width: 80%;
    max-width: 1200px;
  }
`;
