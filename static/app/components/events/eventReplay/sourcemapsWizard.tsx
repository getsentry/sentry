import {useState} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import {CodeSnippet} from 'sentry/components/codeSnippet';
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
    <StyledOnboardingPanel>
      <div>
        <Heading>{t('Upload Source Maps')}</Heading>
        <Content>
          {t(
            'Automatically upload your source maps to enable readable stack traces for errors.'
          )}
        </Content>
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
        <Button
          size="sm"
          onClick={() => {
            setHideUntilTime(DISMISS_TIME);
            setIsHidden(true);
            trackAnalytics('issues.sourcemap_wizard_dismiss', {
              organization: organization.id,
            });
          }}
        >
          {t('Dismiss')}
        </Button>
      </div>
    </StyledOnboardingPanel>
  );
}

const StyledOnboardingPanel = styled('div')`
  display: flex;
  flex-direction: column;
  max-width: 600px;
  border: 1px dashed ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  padding: ${space(3)};
  margin-bottom: ${space(3)};
  margin-left: 30px;

  @media (min-width: ${p => p.theme.breakpoints.small}) {
    flex-direction: row;
  }
`;

const Heading = styled('h3')`
  text-transform: uppercase;
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.gray300};
  margin-bottom: ${space(1)};
`;

const Content = styled('p')`
  margin-bottom: ${space(2)};
  font-size: ${p => p.theme.fontSizeMedium};
`;

const StyledCodeSnipped = styled(CodeSnippet)`
  margin-bottom: ${space(2)};
`;
