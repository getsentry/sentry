import {useState} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import {CodeSnippet} from 'sentry/components/codeSnippet';
import EmptyMessage from 'sentry/components/emptyMessage';
import Panel from 'sentry/components/panels/panel';
import {IconBroadcast} from 'sentry/icons';
import {t} from 'sentry/locale';
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
      <EmptyMessage
        size="large"
        icon={<IconBroadcast size="xl" />}
        title={t("Sentry isn't Sentry without source maps")}
        description={t(
          'Source maps are crucial for Sentry to de-minify yoiur stack traces. Send them automatically with the Sentry Wizard:'
        )}
        action={
          <ButtonBar gap={1}>
            <Button
              onClick={() =>
                trackAnalytics('issues.sourcemap_wizard_copy', {
                  organization: organization.id,
                })
              }
              priority="primary"
              href="https://docs.sentry.io/platforms/javascript/sourcemaps/#uploading-source-maps"
              external
            >
              {t('Learn More')}
            </Button>
            <Button
              onClick={() => {
                setIsHidden(true);
                setHideUntilTime(DISMISS_TIME);
                trackAnalytics('issues.sourcemap_wizard_dismiss', {
                  organization: organization.id,
                });
              }}
            >
              {t('Dismiss')}
            </Button>
          </ButtonBar>
        }
      >
        <StyledCodeSnipped
          dark
          hideCopyButton={false}
          language="bash"
          onCopy={() => {
            trackAnalytics('issues.sourcemap_wizard_copy', {
              organization: organization.id,
            });
          }}
        >
          {wizardCommand}
        </StyledCodeSnipped>
      </EmptyMessage>
    </Panel>
  );
}

const StyledCodeSnipped = styled(CodeSnippet)`
  margin-top: ${space(1)};
  margin-bottom: ${space(1)};
`;
