import {useCallback} from 'react';

import {Button, type ButtonProps} from '@sentry/scraps/button';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import useDrawer from 'sentry/components/globalDrawer';
import {IconSeer} from 'sentry/icons';
import {t} from 'sentry/locale';
import {uniqueId} from 'sentry/utils/guid';
import {AssertionSuggestionsDrawerContent} from 'sentry/views/alerts/rules/uptime/assertionSuggestionsDrawerContent';
import {
  UptimeOpType,
  type UptimeAndOp,
  type UptimeAssertion,
  type UptimeAssertionSuggestion,
  type UptimeOp,
} from 'sentry/views/alerts/rules/uptime/types';

/**
 * Adds an `id` field to an assertion Op for the frontend
 */
function addIdToOp(op: UptimeOp): UptimeOp {
  const id = uniqueId();
  switch (op.op) {
    case UptimeOpType.AND:
    case UptimeOpType.OR:
      return {...op, id, children: op.children.map(addIdToOp)};
    case UptimeOpType.NOT:
      return {...op, id, operand: addIdToOp(op.operand)};
    default:
      return {...op, id};
  }
}

interface AssertionSuggestionsButtonProps {
  /**
   * Returns the current assertion value from the form at call time.
   */
  getCurrentAssertion: () => UptimeAssertion | null;
  /**
   * Callback to get the current form data for the test request.
   */
  getFormData: () => {
    body: string | null;
    headers: Array<[string, string]>;
    method: string;
    timeoutMs: number;
    url: string | undefined;
  };
  /**
   * Callback when user applies a suggestion
   */
  onApplySuggestion: (updatedAssertion: UptimeAssertion) => void;
  /**
   * Button size
   */
  size?: ButtonProps['size'];
}

/**
 * Button component that generates AI-powered assertion suggestions using Seer.
 * Opens a drawer displaying suggestions that can be applied to the form.
 */
export function AssertionSuggestionsButton({
  getFormData,
  getCurrentAssertion,
  onApplySuggestion,
  size,
}: AssertionSuggestionsButtonProps) {
  const {openDrawer, isDrawerOpen} = useDrawer();

  const handleApplySuggestion = useCallback(
    (suggestion: UptimeAssertionSuggestion) => {
      const newOp = addIdToOp(suggestion.assertion_json);
      // Read the current assertion at apply time so we always merge with
      // the latest form state, preserving any existing assertions.
      const current = getCurrentAssertion();

      const newRoot: UptimeAndOp = current?.root
        ? {
            ...current.root,
            children: [...current.root.children, newOp],
          }
        : {
            op: UptimeOpType.AND,
            id: uniqueId(),
            children: [newOp],
          };

      onApplySuggestion({root: newRoot});
    },
    [getCurrentAssertion, onApplySuggestion]
  );

  const handleClick = useCallback(() => {
    const {url, timeoutMs, method, headers, body} = getFormData();

    if (!url) {
      addErrorMessage(t('Please enter a URL first'));
      return;
    }

    openDrawer(
      () => (
        <AssertionSuggestionsDrawerContent
          payload={{url, timeoutMs, method, headers, body}}
          onApply={handleApplySuggestion}
        />
      ),
      {ariaLabel: t('AI Assertion Suggestions')}
    );
  }, [getFormData, openDrawer, handleApplySuggestion]);

  return (
    <Button
      onClick={handleClick}
      disabled={isDrawerOpen}
      size={size}
      icon={<IconSeer />}
      aria-label={t('Use AI to suggest assertions based on response')}
    >
      {t('Suggest Assertions')}
    </Button>
  );
}
