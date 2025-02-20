import {Fragment} from 'react';
import styled from '@emotion/styled';

import {addLoadingMessage, clearIndicators} from 'sentry/actionCreators/indicator';
import {Button, LinkButton} from 'sentry/components/button';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import {IconBusiness} from 'sentry/icons';
import {t} from 'sentry/locale';
import {isActiveSuperuser} from 'sentry/utils/isActiveSuperuser';
import type {ApiQueryKey} from 'sentry/utils/queryClient';
import {setApiQueryData, useApiQuery, useQueryClient} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';

import {openUpsellModal} from 'getsentry/actionCreators/modal';
import type {Policy, Subscription} from 'getsentry/types';
import DataConsentForm from 'getsentry/views/legalAndCompliance/dataConsentForm';
import {PolicyRow} from 'getsentry/views/legalAndCompliance/policyRow';
import {PanelItemPolicy} from 'getsentry/views/legalAndCompliance/styles';

const KNOWN_POLICIES = new Set([
  'privacy',
  'terms',
  'soc2',
  'dpf-cert',
  'iso-certificate',
  'iso-27001-2022',
  'pentest',
  'soc-2-bridge-letter',
]);

interface TermsProps {
  subscription: Subscription;
}

function makeFetchPoliciesQueryKey(subscription: Subscription): ApiQueryKey {
  return [`/customers/${subscription.slug}/policies/`];
}

export function TermsAndConditions({subscription}: TermsProps) {
  const api = useApi();
  const organization = useOrganization();
  const queryClient = useQueryClient();

  const {
    data: policies,
    isPending,
    isError,
    refetch,
  } = useApiQuery<Record<string, Policy>>(makeFetchPoliciesQueryKey(subscription), {
    staleTime: 0,
  });

  if (isPending) {
    return (
      <Panel>
        <PanelHeader>{t('Terms & Conditions')}</PanelHeader>
        <PanelBody>
          <LoadingIndicator />
        </PanelBody>
      </Panel>
    );
  }

  if (isError) {
    return <LoadingError onRetry={refetch} />;
  }

  const acceptPolicy = async (policy: Policy) => {
    // Superusers can't consent to policies
    if (isActiveSuperuser()) {
      return;
    }

    // we need to find the first parent
    addLoadingMessage();
    const data = await api.requestPromise(`/customers/${subscription.slug}/policies/`, {
      method: 'POST',
      data: {
        policy: policy.slug,
        version: policy.version,
      },
    });

    setApiQueryData<Record<string, Policy>>(
      queryClient,
      makeFetchPoliciesQueryKey(subscription),
      oldState => ({...oldState, [data.slug]: data})
    );
    clearIndicators();
  };

  const otherPolicies = Object.values(policies).filter(
    policy => !KNOWN_POLICIES.has(policy.slug) && policy.standalone
  );

  return (
    <Fragment>
      <Panel>
        <PanelHeader>{t('Terms & Conditions')}</PanelHeader>
        <PanelBody data-test-id="terms-and-conditions">
          {policies.terms && (
            <PolicyRow
              key="terms"
              showUpdated
              showConsentText={false}
              policies={policies}
              policy={policies.terms}
              subscription={subscription}
              onAccept={acceptPolicy}
            />
          )}
          {policies.privacy && (
            <PolicyRow
              key="privacy"
              showUpdated
              showConsentText={false}
              policies={policies}
              policy={policies.privacy}
              subscription={subscription}
              onAccept={acceptPolicy}
            />
          )}
          {!policies.baa && (
            <PanelItemPolicy>
              <div>
                <PolicyTitle>{t('Business Associate Agreement')}</PolicyTitle>
              </div>
              <div>
                <Button
                  size="sm"
                  priority="primary"
                  icon={<IconBusiness />}
                  onClick={() =>
                    openUpsellModal({organization, source: 'legal_and_compliance.baa'})
                  }
                >
                  {t('Learn More')}
                </Button>
              </div>
            </PanelItemPolicy>
          )}
          {otherPolicies.map(p => (
            <PolicyRow
              key={p.slug}
              policies={policies}
              policy={p}
              subscription={subscription}
              onAccept={acceptPolicy}
            />
          ))}
        </PanelBody>
      </Panel>
      <DataConsentForm />
      <Panel>
        <PanelHeader>{t('Compliance & Security')}</PanelHeader>
        <PanelBody data-test-id="compliance-and-security">
          <PanelItemPolicy>
            <div>
              <PolicyTitle>{t('Security Overview')}</PolicyTitle>
            </div>
            <div>
              <LinkButton size="sm" external href="https://sentry.io/security/">
                {t('Review')}
              </LinkButton>
            </div>
          </PanelItemPolicy>
          {policies.pentest && (
            <PolicyRow
              key="pentest"
              policies={policies}
              policy={policies.pentest}
              showUpdated
              subscription={subscription}
              onAccept={acceptPolicy}
            />
          )}
          {policies.soc2 && (
            <PolicyRow
              key="soc2"
              policies={policies}
              policy={policies.soc2}
              showUpdated
              subscription={subscription}
              onAccept={acceptPolicy}
            />
          )}
          {policies['soc-2-bridge-letter'] && (
            <PolicyRow
              key="soc-2-bridge-letter"
              policies={policies}
              policy={policies['soc-2-bridge-letter']}
              showUpdated
              subscription={subscription}
              onAccept={acceptPolicy}
            />
          )}
          {policies['dpf-cert'] && (
            <PolicyRow
              key="dpf-cert"
              policies={policies}
              policy={policies['dpf-cert']}
              subscription={subscription}
              onAccept={acceptPolicy}
            />
          )}
          {policies['iso-certificate'] && (
            <PolicyRow
              key="iso-certificate"
              policies={policies}
              policy={policies['iso-certificate']}
              showUpdated
              subscription={subscription}
              onAccept={acceptPolicy}
            />
          )}
          {policies['iso-27001-2022'] && (
            <PolicyRow
              key="iso-27001-2022"
              policies={policies}
              policy={policies['iso-27001-2022']}
              showUpdated
              subscription={subscription}
              onAccept={acceptPolicy}
            />
          )}
        </PanelBody>
      </Panel>
    </Fragment>
  );
}

const PolicyTitle = styled('h6')`
  @media (max-width: ${p => p.theme.breakpoints.small}) {
    font-size: ${p => p.theme.fontSizeLarge};
  }
`;
