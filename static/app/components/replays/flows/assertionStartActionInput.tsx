import {useState} from 'react';

import {CompactSelect} from 'sentry/components/core/compactSelect';
import {Input} from 'sentry/components/core/input';
import {Flex} from 'sentry/components/core/layout/flex';
import {Stack} from 'sentry/components/core/layout/stack';
import {Text} from 'sentry/components/core/text';
import ReplaySelectorListHovercard from 'sentry/components/replays/flows/actions/replaySelectorListHovercard';
import {t, tct} from 'sentry/locale';
import type {
  NavigationAction,
  StartingAssertionAction,
} from 'sentry/utils/replays/assertions/types';

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
  action: initialAction,
  disabled = false,
  onChange,
  projectId,
}: Props) {
  const [categoryOrOp, setCategoryOrOp] = useState<string>(() =>
    getCategoryOrOp(initialAction)
  );

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
        {tct('When a [typeSelect] happens', {typeSelect})}
      </Flex>

      {categoryOrOp === 'ui.click' ? (
        <Flex gap="xs" align="center" wrap="nowrap">
          <Text>{t('that matches')}</Text>
          <ReplaySelectorListHovercard onChange={onChange} projectId={projectId}>
            <Input
              disabled={disabled}
              size="xs"
              placeholder={t('Search for an element')}
            />
          </ReplaySelectorListHovercard>
        </Flex>
      ) : null}

      {categoryOrOp === 'navigation' ? (
        <Flex gap="xs" align="center" wrap="nowrap">
          <Text wrap="nowrap">{t('that matches')}</Text>
          <Input
            disabled={disabled}
            size="xs"
            placeholder={t('Search for an element')}
            onChange={e => {
              onChange({
                type: 'breadcrumb',
                category: 'navigation',
                matcher: {url: e.target.value},
              } as NavigationAction);
            }}
          />
        </Flex>
      ) : null}
    </Stack>
  );
}
