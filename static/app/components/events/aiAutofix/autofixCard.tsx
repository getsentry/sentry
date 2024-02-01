import styled from '@emotion/styled';

import {FixResult} from 'sentry/components/events/aiAutofix/fixResult';
import {Step} from 'sentry/components/events/aiAutofix/step';
import type {AutofixData} from 'sentry/components/events/aiAutofix/types';
import {ExperimentalFeatureBadge} from 'sentry/components/events/aiSuggestedSolution/experimentalFeatureBadge';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelFooter from 'sentry/components/panels/panelFooter';
import PanelHeader from 'sentry/components/panels/panelHeader';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

export function AutofixCard({data, onRetry}: {data: AutofixData; onRetry: () => void}) {
  const hasSteps = data.steps && data.steps.length > 0;

  return (
    <AutofixPanel>
      <Header>
        <Title>
          {t('AI Autofix')}
          <ExperimentalFeatureBadge />
        </Title>
      </Header>
      {hasSteps && (
        <Body>
          <StepsArea>
            {data.steps?.map(step => (
              <Step step={step} key={step.id} />
            ))}
          </StepsArea>
        </Body>
      )}
      {data.status !== 'PROCESSING' && (
        <Footer hasSteps={hasSteps}>
          <FixResult autofixData={data} onRetry={onRetry} />
        </Footer>
      )}
    </AutofixPanel>
  );
}

const Body = styled(PanelBody)`
  display: flex;
  flex-direction: column;
`;

const Header = styled(PanelHeader)`
  align-items: center;
  background: transparent;
  color: ${p => p.theme.subText};
  padding: ${space(1)} ${space(2)};
`;

const Footer = styled(PanelFooter)<{hasSteps?: boolean}>`
  border-top: ${p => (p.hasSteps ? '1px' : '0px')} solid ${p => p.theme.border};
`;

const StepsArea = styled('div')`
  display: flex;
  flex-direction: column;
`;

const Title = styled('div')`
  align-items: center;
  display: flex;
  height: ${space(2)}; /* to be consistent with the feature badge size */
  line-height: ${space(2)};
`;

const AutofixPanel = styled(Panel)`
  margin-bottom: 0;
  overflow: hidden;
`;
