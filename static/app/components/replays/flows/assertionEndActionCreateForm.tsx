import {useState, type ReactNode} from 'react';

import {Button} from 'sentry/components/core/button';
import {CompactSelect} from 'sentry/components/core/compactSelect';
import {Flex} from 'sentry/components/core/layout/flex';
import ClickInput from 'sentry/components/replays/flows/actions/clickinput';
import NavigationInput from 'sentry/components/replays/flows/actions/navigationInput';
import AssertionReplayTable from 'sentry/components/replays/flows/assertionReplayTable';
import {IconChevron} from 'sentry/icons/iconChevron';
import {IconClose} from 'sentry/icons/iconClose';
import {t, tct} from 'sentry/locale';
import type {
  EndingAssertionAction,
  NavigationAction,
  UIClickAction,
} from 'sentry/utils/replays/assertions/types';

interface Props {
  action: EndingAssertionAction;
  children: ReactNode;
  onChange: (action?: EndingAssertionAction) => void;
  projectId: string;
}

const TYPE_OPTIONS = [
  {value: 'ui.click', label: t('Click')},
  {value: 'navigation', label: t('Navigation')},
  {value: 'html-change', label: t('Html Change')},
  {value: 'span', label: t('Span')},
  {value: 'log', label: t('Log')},
  {value: 'console', label: t('Console')},
  {value: 'network-request', label: t('Network Request')},
  {value: 'timeout', label: t('Timeout')},
];

function getCategoryOrOp(action: EndingAssertionAction): string {
  if ('op' in action) {
    return action.op;
  }
  if ('category' in action) {
    return action.category;
  }
  return 'null';
}

export default function AssertionEndActionCreateForm({
  action,
  onChange,
  projectId,
}: Props) {
  const [categoryOrOp, setCategoryOrOp] = useState<string>(() => getCategoryOrOp(action));

  const [isExpanded, setIsExpanded] = useState(false);

  const typeSelect = (
    <CompactSelect<string>
      size="xs"
      options={TYPE_OPTIONS}
      value={categoryOrOp}
      onChange={selected => {
        setCategoryOrOp(selected.value);
      }}
    />
  );

  return (
    <Flex border="primary" padding="md" gap="md" justify="between" direction="column">
      <Flex direction="row" gap="md" flex="1" justify="between">
        {categoryOrOp === 'ui.click' ? null : (
          <Flex gap="xs" align="center" wrap="nowrap">
            {tct('if a [typeSelect] happens', {typeSelect})}
          </Flex>
        )}

        {categoryOrOp === 'ui.click' ? (
          <ClickInput
            onChange={onChange}
            projectId={projectId}
            disabled={false}
            initialAction={action as UIClickAction}
          />
        ) : null}

        {categoryOrOp === 'navigation' ? (
          <NavigationInput
            initialAction={action as NavigationAction}
            onChange={onChange}
            disabled={false}
          />
        ) : null}

        <Flex gap="md">
          <Button
            aria-label="Remove"
            icon={<IconChevron direction={isExpanded ? 'down' : 'right'} />}
            size="xs"
            onClick={() => setIsExpanded(!isExpanded)}
          />
          <Button
            aria-label="Remove"
            icon={<IconClose />}
            size="xs"
            onClick={() => onChange()}
          />
        </Flex>
      </Flex>

      {isExpanded ? (
        <Flex height="480px" width="100%">
          <AssertionReplayTable
            action={action}
            projectId={projectId}
            style={{width: '100%'}}
          />
        </Flex>
      ) : null}
    </Flex>
  );
}
