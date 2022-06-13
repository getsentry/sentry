import styled from '@emotion/styled';

import Button from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import {Panel, PanelFooter} from 'sentry/components/panels';
import {IconAdd} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';

import {Rules} from './rules';
import {SAMPLING_DOC_LINK} from './utils';

export interface RulesPanelProps
  extends Omit<React.ComponentProps<typeof Rules>, 'emptyMessage'> {
  onAddRule: () => void;
}

export function RulesPanel({
  rules,
  onAddRule,
  onEditRule,
  onDeleteRule,
  onUpdateRules,
  disabled,
  infoAlert,
}: RulesPanelProps) {
  return (
    <Panel>
      <Rules
        rules={rules}
        onEditRule={onEditRule}
        onDeleteRule={onDeleteRule}
        disabled={disabled}
        onUpdateRules={onUpdateRules}
        infoAlert={infoAlert}
      />
      <StyledPanelFooter>
        <StyledButtonBar gap={1}>
          <Button href={SAMPLING_DOC_LINK} external>
            {t('Read Docs')}
          </Button>
          <AddRuleButton
            priority="primary"
            onClick={onAddRule}
            icon={<IconAdd isCircled />}
          >
            {t('Add Rule')}
          </AddRuleButton>
        </StyledButtonBar>
      </StyledPanelFooter>
    </Panel>
  );
}

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
