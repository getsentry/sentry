import {useState} from 'react';

import {CompactSelect} from 'sentry/components/core/compactSelect';
import {Flex} from 'sentry/components/core/layout/flex';
import UIClickActionEditor from 'sentry/components/replays/assertions/actions/uiClickActionEditor';
import {formatSelectorAsCode} from 'sentry/components/replays/assertions/selectorCodeFormatter';
import {t, tct} from 'sentry/locale';
import type {StartingAssertionAction} from 'sentry/utils/replays/assertions/types';

interface Props {
  action: StartingAssertionAction;
  onActionSubmit: (action: StartingAssertionAction) => void;
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

export default function AssertionStartActionCreateForm({
  action: initialAction,
  onActionSubmit,
  projectId,
}: Props) {
  const [categoryOrOp, setCategoryOrOp] = useState<string>(() =>
    getCategoryOrOp(initialAction)
  );

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
    <Flex border="primary" padding="md" flex="1">
      {categoryOrOp === 'ui.click' ? null : (
        <Flex gap="xs" align="center" wrap="nowrap">
          {tct('when a [typeSelect] happens', {typeSelect})}
        </Flex>
      )}

      {categoryOrOp === 'ui.click' ? (
        <Flex gap="xs" align="center">
          {tct('when a [typeSelect] happens on a [clickSelect]', {
            typeSelect,
            clickSelect: (
              <UIClickActionEditor
                onActionSubmit={selected => {
                  onActionSubmit(selected);
                }}
                projectId={projectId}
              >
                {initialAction.type === 'breadcrumb' &&
                initialAction.category === 'ui.click' ? (
                  formatSelectorAsCode(initialAction.matcher.dom_element)
                ) : (
                  <span>-Pick something-</span>
                )}
              </UIClickActionEditor>
            ),
          })}
        </Flex>
      ) : null}
    </Flex>
  );
}
