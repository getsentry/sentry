import {useState} from 'react';

import {CompactSelect} from 'sentry/components/core/compactSelect';
import {Flex} from 'sentry/components/core/layout/flex';
import {Stack} from 'sentry/components/core/layout/stack';
import ClickInput from 'sentry/components/replays/flows/actions/clickinput';
import NavigationInput from 'sentry/components/replays/flows/actions/navigationInput';
import {t, tct} from 'sentry/locale';
import type {StartingAssertionAction} from 'sentry/utils/replays/assertions/types';

interface Props {
  action: StartingAssertionAction;
  onChange: (action: StartingAssertionAction) => void;
  projectId: string;
  disabled?: boolean;
}

const TYPE_OPTIONS = [
  {value: 'ui.click', label: t('Click')},
  {value: 'navigation', label: t('Navigation')},
  {value: 'html-change', label: t('Html Change')},
  {value: 'span', label: t('Span')},
  {value: 'log', label: t('Log')},
  {value: 'console', label: t('Console')},
  {value: 'network-request', label: t('Network Request')},
];

function getCategoryOrOp(action: StartingAssertionAction): string {
  if ('op' in action) {
    return action.op;
  }
  if ('category' in action) {
    return action.category;
  }
  return 'null';
}

export default function AssertionStartActionInput({
  action,
  disabled = false,
  onChange,
  projectId,
}: Props) {
  const [categoryOrOp, setCategoryOrOp] = useState<string>(() => getCategoryOrOp(action));

  const typeSelect = (
    <CompactSelect<string>
      disabled={disabled}
      size="xs"
      options={TYPE_OPTIONS}
      value={categoryOrOp}
      onChange={selected => {
        setCategoryOrOp(selected.value);
      }}
    />
  );

  return (
    <Stack gap="md" direction="column">
      <Flex gap="xs" align="center" wrap="nowrap">
        {tct('when a [typeSelect] happens', {typeSelect})}
      </Flex>

      {categoryOrOp === 'ui.click' ? (
        <ClickInput
          onChange={onChange}
          projectId={projectId}
          disabled={disabled}
          initialAction={
            action.type === 'breadcrumb' && action.category === 'ui.click' ? action : null
          }
        />
      ) : null}

      {categoryOrOp === 'navigation' ? (
        <NavigationInput
          initialAction={
            action.type === 'breadcrumb' && action.category === 'navigation'
              ? action
              : null
          }
          onChange={onChange}
          disabled={disabled}
        />
      ) : null}
    </Stack>
  );
}
