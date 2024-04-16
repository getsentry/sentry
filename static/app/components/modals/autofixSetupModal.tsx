import {Fragment} from 'react';
import styled from '@emotion/styled';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {Button} from 'sentry/components/button';
import {
  type AutofixSetupResponse,
  useAutofixSetup,
} from 'sentry/components/events/autofix/useAutofixSetup';
import {GuidedSteps} from 'sentry/components/guidedSteps/guidedSteps';
import HookOrDefault from 'sentry/components/hookOrDefault';
import ExternalLink from 'sentry/components/links/externalLink';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {IconCheckmark} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';

interface AutofixSetupModalProps extends ModalRenderProps {
  groupId: string;
}

const ConsentStep = HookOrDefault({
  hookName: 'component:autofix-setup-step-consent',
  defaultComponent: null,
});

function AutofixIntegrationStep({autofixSetup}: {autofixSetup: AutofixSetupResponse}) {
  if (autofixSetup.integration.ok) {
    return (
      <Fragment>
        {tct('The GitHub integration is already installed, [link: view in settings].', {
          link: <ExternalLink href={`/settings/integrations/github/`} />,
        })}
        <GuidedSteps.StepButtons />
      </Fragment>
    );
  }

  if (autofixSetup.integration.reason === 'integration_inactive') {
    return (
      <Fragment>
        <p>
          {tct(
            'The GitHub integration has been installed but is not active. Navigate to the [integration settings page] and enable it to continue.',
            {
              link: <ExternalLink href={`/settings/integrations/github/`} />,
            }
          )}
        </p>
        <p>
          {tct(
            'Once enabled, come back to this page. For more information related to installing the GitHub integration, read the [link:documentation].',
            {
              link: (
                <ExternalLink href="https://docs.sentry.io/product/integrations/source-code-mgmt/github/" />
              ),
            }
          )}
        </p>
        <GuidedSteps.StepButtons />
      </Fragment>
    );
  }

  if (autofixSetup.integration.reason === 'integration_no_code_mappings') {
    return (
      <Fragment>
        <p>
          {tct(
            'You have an active GitHub installation, but no linked repositories. Add repositories to the integration on the [integration settings page].',
            {
              link: <ExternalLink href={`/settings/integrations/github/`} />,
            }
          )}
        </p>
        <p>
          {tct(
            'Once added, come back to this page. For more information related to installing the GitHub integration, read the [link:documentation].',
            {
              link: (
                <ExternalLink href="https://docs.sentry.io/product/integrations/source-code-mgmt/github/" />
              ),
            }
          )}
        </p>
        <GuidedSteps.StepButtons />
      </Fragment>
    );
  }

  return (
    <Fragment>
      <p>
        {tct(
          'Install the GitHub integration by navigating to the [link:integration settings page] and clicking the "Install" button. Follow the steps provided.',
          {
            link: <ExternalLink href={`/settings/integrations/github/`} />,
          }
        )}
      </p>
      <p>
        {tct(
          'Once installed, come back to this page. For more information related to installing the GitHub integration, read the [link:documentation].',
          {
            link: (
              <ExternalLink href="https://docs.sentry.io/product/integrations/source-code-mgmt/github/" />
            ),
          }
        )}
      </p>
      <GuidedSteps.StepButtons />
    </Fragment>
  );
}

function AutofixSetupSteps({autofixSetup}: {autofixSetup: AutofixSetupResponse}) {
  return (
    <GuidedSteps>
      <ConsentStep hasConsented={autofixSetup.genAIConsent.ok} />
      <GuidedSteps.Step
        stepKey="integration"
        title={t('Install the GitHub Integration')}
        isCompleted={autofixSetup.integration.ok}
      >
        <AutofixIntegrationStep autofixSetup={autofixSetup} />
      </GuidedSteps.Step>
    </GuidedSteps>
  );
}

function AutofixSetupContent({
  groupId,
  closeModal,
}: {
  closeModal: () => void;
  groupId: string;
}) {
  const {data, isLoading, isError} = useAutofixSetup(
    {groupId},
    // Want to check setup status whenever the user comes back to the tab
    {refetchOnWindowFocus: true}
  );

  if (isLoading) {
    return <LoadingIndicator />;
  }

  if (isError) {
    return <LoadingError message={t('Failed to fetch Autofix setup progress.')} />;
  }

  if (data.genAIConsent.ok && data.integration.ok) {
    return (
      <AutofixSetupDone>
        <DoneIcon size="xxl" isCircled />
        <p>{t("You've successfully configured Autofix!")}</p>
        <Button onClick={closeModal} priority="primary">
          {t("Let's go")}
        </Button>
      </AutofixSetupDone>
    );
  }

  return <AutofixSetupSteps autofixSetup={data} />;
}

export function AutofixSetupModal({
  Header,
  Body,
  groupId,
  closeModal,
}: AutofixSetupModalProps) {
  return (
    <Fragment>
      <Header closeButton>
        <h3>{t('Configure Autofix')}</h3>
      </Header>
      <Body>
        <AutofixSetupContent groupId={groupId} closeModal={closeModal} />
      </Body>
    </Fragment>
  );
}

const AutofixSetupDone = styled('div')`
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  padding: 40px;
  font-size: ${p => p.theme.fontSizeLarge};
`;

const DoneIcon = styled(IconCheckmark)`
  color: ${p => p.theme.success};
  margin-bottom: ${space(4)};
`;
