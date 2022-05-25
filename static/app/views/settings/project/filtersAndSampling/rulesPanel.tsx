import styled from '@emotion/styled';

import Button from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import {Panel, PanelFooter} from 'sentry/components/panels';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';

import Rules from './rules';
import {DYNAMIC_SAMPLING_DOC_LINK} from './utils';

type Props = Omit<React.ComponentProps<typeof Rules>, 'emptyMessage'> & {
  onAddRule: () => void;
  isErrorPanel?: boolean;
};

function RulesPanel({
  rules,
  onAddRule,
  onEditRule,
  onDeleteRule,
  onUpdateRules,
  isErrorPanel,
  disabled,
}: Props) {
  const panelType = isErrorPanel ? t('error') : t('transaction');
  return (
    <Panel>
      <Rules
        rules={rules}
        onEditRule={onEditRule}
        onDeleteRule={onDeleteRule}
        disabled={disabled}
        onUpdateRules={onUpdateRules}
        emptyMessage={t('There are no %s rules to display', panelType)}
      />
      <StyledPanelFooter>
        <StyledButtonBar gap={1}>
          <Button href={DYNAMIC_SAMPLING_DOC_LINK} external>
            {t('Read the docs')}
          </Button>
          <AddRuleButton priority="primary" onClick={onAddRule}>
            {t('Add %s rule', panelType)}
          </AddRuleButton>
        </StyledButtonBar>
      </StyledPanelFooter>
    </Panel>
  );
}

export default RulesPanel;

const StyledPanelFooter = styled(PanelFooter)`
  padding: ${space(1)} ${space(2)};
  @media (min-width: ${p => p.theme.breakpoints[0]}) {
    display: flex;
    align-items: center;
    justify-content: flex-end;
  }
`;

const StyledButtonBar = styled(ButtonBar)`
  @media (max-width: ${p => p.theme.breakpoints[0]}) {
    grid-auto-flow: row;
    grid-row-gap: ${space(1)};
  }
`;

const AddRuleButton = styled(Button)`
  @media (max-width: ${p => p.theme.breakpoints[0]}) {
    width: 100%;
  }
`;
