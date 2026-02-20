import {Alert} from '@sentry/scraps/alert';
import {Button} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';

import type {FormFieldProps} from 'sentry/components/forms/formField';
import FormField from 'sentry/components/forms/formField';
import {tct} from 'sentry/locale';
import {uniqueId} from 'sentry/utils/guid';
import {resolveErroredAssertionOp} from 'sentry/views/alerts/rules/uptime/formErrors';
import {usePreviewCheckResult} from 'sentry/views/alerts/rules/uptime/previewCheckContext';
import {
  UptimeComparisonType,
  UptimeOpType,
  type UptimeAndOp,
  type UptimeAssertion,
  type UptimeOp,
} from 'sentry/views/alerts/rules/uptime/types';

import {AssertionOpGroup} from './opGroup';

/**
 * Recursively normalizes assertion values to ensure they are valid before submission.
 * Handles NaN values (from cleared inputs) and clamps to valid HTTP status code range.
 */
export function normalizeAssertion(op: UptimeOp): UptimeOp {
  switch (op.op) {
    case UptimeOpType.STATUS_CODE_CHECK:
      return {
        ...op,
        // Default to 200 if NaN (e.g., user cleared input and submitted without blur)
        value: isNaN(op.value) ? 200 : Math.max(100, Math.min(599, op.value)),
      };
    case UptimeOpType.AND:
    case UptimeOpType.OR:
      return {
        ...op,
        children: op.children.map(normalizeAssertion),
      };
    case UptimeOpType.NOT:
      return {
        ...op,
        operand: normalizeAssertion(op.operand),
      };
    default:
      return op;
  }
}

/**
 * Creates an empty assertion root with no children.
 * Used when editing monitors that have no assertions - empty children signals
 * "edit with no assertions" vs the default assertions for new monitors.
 */
export function createEmptyAssertionRoot(): UptimeAndOp {
  return {
    op: UptimeOpType.AND,
    id: uniqueId(),
    children: [],
  };
}

/**
 * Creates a default assertion root that validates 2xx status codes (>199 AND <300)
 */
function createDefaultAssertionRoot(): UptimeAndOp {
  return {
    op: UptimeOpType.AND,
    id: uniqueId(),
    children: [
      {
        op: UptimeOpType.STATUS_CODE_CHECK,
        id: uniqueId(),
        operator: {cmp: UptimeComparisonType.GREATER_THAN},
        value: 199,
      },
      {
        op: UptimeOpType.STATUS_CODE_CHECK,
        id: uniqueId(),
        operator: {cmp: UptimeComparisonType.LESS_THAN},
        value: 300,
      },
    ],
  };
}

// XXX(epurkhiser): The types of the FormField render props are absolutely
// abysmal, so we're leaving this untyped for now.

function UptimeAssertionsControl({onChange, onBlur, value, trailingButtons}: any) {
  const previewCheckResult = usePreviewCheckResult();

  // value is an UptimeAssertion object from initialData or defaultValue.
  // During initial render, value may briefly be undefined before FormField processes defaultValue.
  if (!value?.root) {
    return null;
  }

  const rootOp: UptimeAndOp = value.root;
  const erroredOp = resolveErroredAssertionOp(previewCheckResult, rootOp) ?? undefined;

  return (
    <Flex direction="column" gap="md">
      {rootOp.children.length === 0 && (
        <Alert variant="warning">
          {tct(
            'Without any Assertions all uptime checks will be marked as success! [addDefault:Add a 2xx status code assertion.]',
            {
              addDefault: (
                <Button
                  priority="link"
                  onClick={() => {
                    const defaultRoot = createDefaultAssertionRoot();
                    onChange({root: defaultRoot}, {});
                    onBlur({root: defaultRoot}, {});
                  }}
                />
              ),
            }
          )}
        </Alert>
      )}
      <AssertionOpGroup
        root
        value={rootOp}
        erroredOp={erroredOp}
        onChange={op => {
          previewCheckResult?.resetPreviewCheckResult();
          onChange({root: op}, {});
          onBlur({root: op}, {});
        }}
        trailingButtons={trailingButtons}
      />
    </Flex>
  );
}

interface UptimeAssertionsFieldProps extends Omit<FormFieldProps, 'children'> {
  trailingButtons?: React.ReactNode;
}

export function UptimeAssertionsField({
  trailingButtons,
  ...props
}: UptimeAssertionsFieldProps) {
  return (
    <FormField
      defaultValue={{root: createDefaultAssertionRoot()}}
      {...props}
      flexibleControlStateSize
      // Use getValue (not getData) to transform field value at submission time.
      // getData only works for save-on-blur; getValue is used by getTransformedData()
      // which is called during full form submission via saveForm().
      getValue={(value: UptimeAssertion) => {
        // Handle edge cases where FormField may pass undefined/null/empty string
        if (!value?.root) {
          return null;
        }
        // Empty children = user deleted all assertions or editing monitor with no assertions
        if (value.root.children.length === 0) {
          return null;
        }
        return {root: normalizeAssertion(value.root)};
      }}
    >
      {({ref: _ref, ...fieldProps}) => (
        <UptimeAssertionsControl {...fieldProps} trailingButtons={trailingButtons} />
      )}
    </FormField>
  );
}
