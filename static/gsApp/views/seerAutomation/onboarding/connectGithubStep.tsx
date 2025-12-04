import {useCallback} from 'react';

import Access from 'sentry/components/acl/access';
import {Flex} from 'sentry/components/core/layout';
import {GuidedSteps} from 'sentry/components/guidedSteps/guidedSteps';
import PanelBody from 'sentry/components/panels/panelBody';
import Placeholder from 'sentry/components/placeholder';
import {IconAdd} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {IntegrationProvider} from 'sentry/types/integrations';
import useOrganization from 'sentry/utils/useOrganization';
import IntegrationButton from 'sentry/views/settings/organizationIntegrations/integrationButton';
import {IntegrationContext} from 'sentry/views/settings/organizationIntegrations/integrationContext';

import {ActionSection, MaxWidthPanel, StepContent} from './common';
import {Steps} from './types';

interface Props {
  isProviderPending: boolean;
  provider: IntegrationProvider | undefined;
}

export function ConnectGithubStep({isProviderPending, provider}: Props) {
  const organization = useOrganization();
  const handleAddIntegration = useCallback(() => {
    window.location.reload();
  }, []);
  return (
    <GuidedSteps.Step stepKey={Steps.CONNECT_GITHUB} title={t('Connect GitHub')}>
      <StepContent>
        <MaxWidthPanel>
          <PanelBody withPadding>
            <p>
              {t(
                'In order to get the most out of Sentry and use Seer we will need to access your code repositories in GitHub. (We do not currently support Gitlab, Bitbucket, or others)'
              )}
            </p>
            <ActionSection>
              {!provider || isProviderPending ? (
                <Placeholder />
              ) : (
                <IntegrationContext
                  value={{
                    provider,
                    type: 'first_party',
                    installStatus: 'Not Installed', // `AddIntegrationButton` only handles `Disabled`
                    analyticsParams: {
                      view: 'seer_onboarding_github',
                      already_installed: false,
                    },
                  }}
                >
                  <Flex gap="xl">
                    <Access access={['org:integrations']} organization={organization}>
                      {({hasAccess}) => (
                        <IntegrationButton
                          userHasAccess={hasAccess}
                          onAddIntegration={handleAddIntegration}
                          onExternalClick={() => {}}
                          buttonProps={{
                            icon: <IconAdd />,
                            buttonText: t('Connect GitHub'),
                            priority: 'primary',
                          }}
                        />
                      )}
                    </Access>
                  </Flex>
                </IntegrationContext>
              )}
            </ActionSection>
            <GuidedSteps.ButtonWrapper>
              <GuidedSteps.NextButton size="md" />
            </GuidedSteps.ButtonWrapper>
          </PanelBody>
        </MaxWidthPanel>
      </StepContent>
    </GuidedSteps.Step>
  );
}
