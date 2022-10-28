import styled from '@emotion/styled';

import {CodeSnippet} from 'sentry/components/codeSnippet';
import ExternalLink from 'sentry/components/links/externalLink';
import List from 'sentry/components/list';
import ListItem from 'sentry/components/list/listItem';
import {Panel, PanelBody, PanelHeader} from 'sentry/components/panels';
import {t, tct} from 'sentry/locale';
import space from 'sentry/styles/space';

import {Monitor} from './types';

type Props = {
  monitor: Monitor;
};

const MonitorOnboarding = ({monitor}: Props) => {
  const checkInUrl = `https://sentry.io/api/0/monitors/${monitor.id}/checkins/`;

  return (
    <Panel>
      <PanelHeader>{t('How to instrument monitors')}</PanelHeader>
      <PanelBody withPadding>
        <List symbol="bullet">
          <StyledListItem>
            <OnboardingText>
              {tct(
                'To report on the status of a job make POST requests using [linkDocs:DSN authentication]',
                {
                  linkDocs: (
                    <ExternalLink href="https://docs.sentry.io/api/auth/#dsn-authentication" />
                  ),
                }
              )}
            </OnboardingText>
            <CodeSnippet language="text" hideActionBar>
              {`POST ${checkInUrl}`}
            </CodeSnippet>
          </StyledListItem>
          <StyledListItem>
            <OnboardingText>
              {t(
                'Supply one of the following JSON bodies to the POST request depending on the job status to be reported'
              )}
            </OnboardingText>
            <OnboardingText>
              {t('For the start of a job')}
              <CodeSnippet language="json" hideActionBar>
                {`{ "status": "in_progress" }`}
              </CodeSnippet>
            </OnboardingText>
            <OnboardingText>
              {t('For job completion with optional duration in milliseconds')}
              <CodeSnippet language="json" hideActionBar>
                {`{ "status": "ok", "duration": 3000 }`}
              </CodeSnippet>
            </OnboardingText>
            <OnboardingText>
              {t('For a job failure with optional duration in milliseconds')}
              <CodeSnippet language="json" hideActionBar>
                {`{ "status": "error", "duration": 3000 }`}
              </CodeSnippet>
            </OnboardingText>
          </StyledListItem>
        </List>
      </PanelBody>
    </Panel>
  );
};

const OnboardingText = styled('p')`
  font-size: ${p => p.theme.fontSizeLarge};
`;

const StyledListItem = styled(ListItem)`
  margin-bottom: ${space(2)};
`;

export default MonitorOnboarding;
