import {IconWarning} from 'sentry/icons';
import {t} from 'sentry/locale';
import EmptyMessage from 'sentry/views/settings/components/emptyMessage';

import Rules from './rules';
import {Rule} from './types';

type Props = {
  onDeleteRule: (rule: Rule['id']) => () => void;
  onEditRule: (rule: Rule['id']) => () => void;
  rules: Array<Rule>;
  disabled?: boolean;
};

const Content = ({rules, disabled, onDeleteRule, onEditRule}: Props) => {
  if (rules.length === 0) {
    return (
      <EmptyMessage
        icon={<IconWarning size="xl" />}
        description={t('You have no data scrubbing rules')}
      />
    );
  }

  return (
    <Rules
      rules={rules}
      onDeleteRule={onDeleteRule}
      onEditRule={onEditRule}
      disabled={disabled}
    />
  );
};

export default Content;
