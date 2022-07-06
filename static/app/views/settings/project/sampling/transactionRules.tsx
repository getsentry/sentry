import {Fragment} from 'react';

import Alert from 'sentry/components/alert';
import {t} from 'sentry/locale';
import {SamplingConditionOperator} from 'sentry/types/sampling';
import TextBlock from 'sentry/views/settings/components/text/textBlock';

import {RulesPanel, RulesPanelProps} from './rulesPanel';

interface Props extends RulesPanelProps {}

export function TransactionRules(props: Props) {
  const notSupportedConditionOperator = props.rules.some(
    rule => rule.condition.op !== SamplingConditionOperator.AND
  );

  return (
    <Fragment>
      <TextBlock>
        {t('Select Transactions only within this project which match your conditions.')}
      </TextBlock>
      {notSupportedConditionOperator ? (
        <Alert type="error">
          {t('A condition operator has been found that is not yet supported.')}
        </Alert>
      ) : (
        <RulesPanel {...props} />
      )}
    </Fragment>
  );
}
