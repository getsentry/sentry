import styled from '@emotion/styled';

import {CodeSnippet} from 'sentry/components/codeSnippet';
import ExternalLink from 'sentry/components/links/externalLink';
import Link from 'sentry/components/links/link';
import List from 'sentry/components/list';
import ListItem from 'sentry/components/list/listItem';
import {Panel, PanelBody, PanelHeader} from 'sentry/components/panels';
import {t, tct} from 'sentry/locale';
import space from 'sentry/styles/space';
import useOrganization from 'sentry/utils/useOrganization';

import {Monitor} from './types';

type Props = {
  monitor: Monitor;
};

const MonitorOnboarding = ({monitor}: Props) => {
  const checkInUrl = `https://sentry.io/api/0/monitors/${monitor.id}/checkins/`;
  const checkInDetailsUrl = `${checkInUrl}{checkInId}/`;

  const organization = useOrganization();
  return (
    <Panel>
      <PanelHeader>{t('How to instrument monitors')}</PanelHeader>
      <PanelBody withPadding>
        <List symbol="bullet">
          <StyledListItem>
            <OnboardingText>
              {tct(
                'To report the start of a job execution using [linkDocs:DSN authentication], use the following request (your DSN can be found [linkProjectDSN:here])',
                {
                  linkDocs: (
                    <ExternalLink href="https://docs.sentry.io/api/auth/#dsn-authentication" />
                  ),
                  linkProjectDSN: (
                    <Link
                      to={`/settings/${organization.slug}/projects/${monitor.project.slug}/keys/`}
                    />
                  ),
                }
              )}
            </OnboardingText>
            <CodeSnippet language="text" hideActionBar>
              {`curl -X POST \\\n'${checkInUrl}' \\\n--header 'Authorization: DSN {DSN}' \\\n--header 'Content-Type: application/json' \\\n--data-raw '{"status": "in_progress"}'`}
            </CodeSnippet>
          </StyledListItem>
          <StyledListItem>
            <OnboardingText>
              {t(
                'The above request will then return a check-in id which you can use to modify the check-in upon job completion'
              )}
            </OnboardingText>
            <OnboardingText>
              {t('For reflecting successful execution with optional duration in ms')}
              <CodeSnippet language="json" hideActionBar>
                {`curl -X PUT \\\n'${checkInDetailsUrl}' \\\n--header 'Authorization: DSN {DSN}' \\\n--header 'Content-Type: application/json' \\\n--data-raw '{"status": "ok", "duration": 3000}'`}
              </CodeSnippet>
            </OnboardingText>
            <OnboardingText>
              {t('For reflecting failed execution with optional duration in ms')}
              <CodeSnippet language="json" hideActionBar>
                {`curl -X PUT \\\n'${checkInDetailsUrl}' \\\n--header 'Authorization: DSN {DSN}' \\\n--header 'Content-Type: application/json' \\\n--data-raw '{"status": "error", "duration": 3000}'`}
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
