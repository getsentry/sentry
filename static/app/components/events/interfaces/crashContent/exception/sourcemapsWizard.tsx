import {useState} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button';
import EmptyMessage from 'sentry/components/emptyMessage';
import ExternalLink from 'sentry/components/links/externalLink';
import {TabbedCodeSnippet} from 'sentry/components/onboarding/gettingStartedDoc/step';
import Panel from 'sentry/components/panels/panel';
import {IconClose, IconFlag} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import {trackAnalytics} from 'sentry/utils/analytics';
import type {BaseEventAnalyticsParams} from 'sentry/utils/analytics/workflowAnalyticsEvents';
import {getWizardConfig} from 'sentry/utils/gettingStartedDocs/cliSdkWizard';
import localStorage from 'sentry/utils/localStorage';

const LOCAL_STORAGE_KEY = 'issues-sourcemap-wizard-hide-until';
const DISMISS_TIME = 1000 * 60 * 60 * 24 * 7; // 1 week

function getHideUntilTime() {
  return Number(localStorage.getItem(LOCAL_STORAGE_KEY)) || 0;
}

function setHideUntilTime(offset: number) {
  localStorage.setItem(LOCAL_STORAGE_KEY, String(Date.now() + offset));
}

function clearHideUntilTime() {
  localStorage.removeItem(LOCAL_STORAGE_KEY);
}

interface Props {
  analyticsParams: {
    organization: Organization;
    project_id: string;
    group_id?: string;
  } & BaseEventAnalyticsParams;
}

export default function SourceMapsWizard({analyticsParams}: Props) {
  const [isHidden, setIsHidden] = useState(() => {
    const hideUntilTime = getHideUntilTime();
    if (hideUntilTime && Date.now() < hideUntilTime) {
      return true;
    }
    clearHideUntilTime();
    return false;
  });

  if (isHidden) {
    return null;
  }

  // Get the wizard configuration including the tabs
  // Cast as any since we're passing a minimal set of parameters
  // The getWizardSnippet function only uses isSelfHosted, organization.slug, and projectSlug
  const wizardConfig = getWizardConfig(
    {
      isSelfHosted: false,
      organization: analyticsParams.organization,
      projectSlug: analyticsParams.project_id,
      // Provide a complete mock of sourcePackageRegistries with the expected structure
      sourcePackageRegistries: {
        isLoading: false,
        data: {
          'sentry.wizard': {
            version: '4.0.1',
          },
        },
      },
    } as any,
    'source-maps',
    {
      onCopy: () => {
        trackAnalytics('issue_details.sourcemap_wizard_copy', {
          ...analyticsParams,
        });
      },
    }
  );

  return (
    <StyledPanel dashedBorder data-test-id="sourcemaps-wizard">
      <CloseButton
        onClick={() => {
          setIsHidden(true);
          setHideUntilTime(DISMISS_TIME);
          trackAnalytics('issue_details.sourcemap_wizard_dismiss', {
            ...analyticsParams,
          });
        }}
        icon={<IconClose size="xs" />}
        aria-label={t('Dismiss sourcemap wizard banner')}
        size="zero"
      />
      <EmptyMessage
        size="medium"
        icon={<IconFlag size="xl" />}
        title={t("You're not a computer, so why parse minified code?")}
        description={tct(
          'Upload source maps with the Sentry Wizard to unlock readable stack traces and better error grouping. [link:Learn more]',
          {
            link: (
              <ExternalLink
                onClick={() => {
                  trackAnalytics('issue_details.sourcemap_wizard_learn_more', {
                    ...analyticsParams,
                  });
                }}
                openInNewTab
                href="https://docs.sentry.io/platforms/javascript/sourcemaps/#uploading-source-maps"
              />
            ),
          }
        )}
      >
        <StyledCodeContainer>
          <TabbedCodeSnippet tabs={wizardConfig.code} onCopy={wizardConfig.onCopy} />
        </StyledCodeContainer>
      </EmptyMessage>
    </StyledPanel>
  );
}

const StyledCodeContainer = styled('div')`
  margin-top: ${space(2)};
  width: 500px;

  @media (max-width: ${p => p.theme.breakpoints.small}) {
    width: 100%;
  }
`;

const StyledPanel = styled(Panel)`
  margin: 0 30px;
`;

const CloseButton = styled(Button)`
  position: absolute;
  top: -${space(1.5)};
  right: -${space(1.5)};
  border-radius: 50%;
  height: ${p => p.theme.iconSizes.lg};
  width: ${p => p.theme.iconSizes.lg};
`;
