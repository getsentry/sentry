import {useState} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import {CodeSnippet} from 'sentry/components/codeSnippet';
import EmptyMessage from 'sentry/components/emptyMessage';
import ExternalLink from 'sentry/components/links/externalLink';
import Panel from 'sentry/components/panels/panel';
import {IconClose, IconFlag} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import {space} from 'sentry/styles/space';
import {trackAnalytics} from 'sentry/utils/analytics';
import localStorage from 'sentry/utils/localStorage';
import useOrganization from 'sentry/utils/useOrganization';

const LOCAL_STORAGE_KEY = 'issues-sourcemap-wizard-hide-until';
const DISMISS_TIME = 1000 * 60 * 60 * 24 * 7; // 1 week

const wizardCommand = 'npx @sentry/wizard@latest -i sourcemaps';

function getHideUntilTime() {
  return Number(localStorage.getItem(LOCAL_STORAGE_KEY)) || 0;
}

function setHideUntilTime(offset: number) {
  localStorage.setItem(LOCAL_STORAGE_KEY, String(Date.now() + offset));
}

function clearHideUntilTime() {
  localStorage.removeItem(LOCAL_STORAGE_KEY);
}

export default function SourceMapsWizard() {
  const organization = useOrganization();
  const isDarkmode = useLegacyStore(ConfigStore).theme === 'dark';

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

  return (
    <Panel dashedBorder data-test-id="sourcemaps-wizard">
      <CloseButton
        onClick={() => {
          setIsHidden(true);
          setHideUntilTime(DISMISS_TIME);
          trackAnalytics('issue_details.sourcemap_wizard_dismiss', {
            organization,
          });
        }}
        icon={<IconClose size="xs" />}
        aria-label={t('Dismiss sourcemap wizard banner')}
        size="zero"
      />
      <EmptyMessage
        size="medium"
        icon={<IconFlag size="xl" />}
        title={t("Sentry isn't Sentry without source maps")}
        description={tct(
          'Automatically upload your source maps to enable readable stack traces and better error grouping using the Sentry Wizard. [link:Learn more]',
          {
            link: (
              <ExternalLink
                onClick={() => {
                  trackAnalytics('issue_details.sourcemap_wizard_learn_more', {
                    organization,
                  });
                }}
                openInNewTab
                href="https://docs.sentry.io/platforms/javascript/sourcemaps/#uploading-source-maps"
              />
            ),
          }
        )}
      >
        <StyledCodeSnippet
          dark
          isDarkMode={isDarkmode}
          hideCopyButton={false}
          language="bash"
          onCopy={() => {
            trackAnalytics('issue_details.sourcemap_wizard_copy', {
              organization,
            });
          }}
        >
          {wizardCommand}
        </StyledCodeSnippet>
      </EmptyMessage>
    </Panel>
  );
}

const StyledCodeSnippet = styled(CodeSnippet)<{isDarkMode: boolean}>`
  margin-top: ${space(2)};
  width: 500px;
  border: ${p => (p.isDarkMode ? `1px solid ${p.theme.border}` : 'none')};

  @media (max-width: ${p => p.theme.breakpoints.small}) {
    width: 100%;
  }
`;

const CloseButton = styled(Button)`
  position: absolute;
  top: -${space(1.5)};
  right: -${space(1.5)};
  border-radius: 50%;
  height: ${p => p.theme.iconSizes.lg};
  width: ${p => p.theme.iconSizes.lg};
`;
