import {useEffect, useRef, type Ref} from 'react';
import {mergeRefs} from '@react-aria/utils';

import {useAutoSaveContext} from '@sentry/scraps/form/autoSaveContext';
import {useFieldContext} from '@sentry/scraps/form/formContext';
import {Checkmark, Spinner} from '@sentry/scraps/form/icons';
import {Flex} from '@sentry/scraps/layout';

import {useLocation} from 'sentry/utils/useLocation';

import {useFieldId, useHintTextId} from './fieldIds';
import {FieldMeta} from './meta';

export type BaseFieldProps<T extends HTMLElement> = {
  disabled?: boolean | string;
  ref?: Ref<T>;
};
type FieldChildrenProps<T extends HTMLElement> = {
  'aria-describedby': string;
  'aria-invalid': boolean;
  disabled: boolean;
  id: string;
  name: string;
  onBlur: () => void;
  ref: Ref<T>;
};

export const useAutoSaveIndicator = () => {
  const field = useFieldContext();
  const status = useAutoSaveContext()?.status;

  if (status === 'pending') {
    return (
      <Spinner role="status" aria-label={`Saving ${field.name}`} aria-live="polite" />
    );
  }

  if (status === 'success') {
    return <Checkmark variant="success" size="sm" />;
  }

  return null;
};

function useScrollToHash(fieldName: string, ref: React.RefObject<HTMLElement | null>) {
  const location = useLocation();
  useEffect(() => {
    let hash: string;
    try {
      hash = decodeURIComponent(location.hash.slice(1));
    } catch {
      return;
    }
    if (hash !== fieldName) {
      return;
    }
    ref.current?.scrollIntoView({block: 'center', behavior: 'smooth'});
    ref.current?.focus({focusVisible: true});
    animateRowHighlight(fieldName, ref.current);
  }, [fieldName, ref, location.hash]);
}

function useFocusRestore(ref: React.RefObject<HTMLElement | null>) {
  const autoSaveContext = useAutoSaveContext();
  const focusRestoreTargetRef = useRef<HTMLElement | null>(null);
  const isDisabledByAutoSave = autoSaveContext?.status === 'pending';

  // Capture also observes blur from controls inside a group.
  // Native blur fires during DOM commit, after React sets the disabled attribute.
  useEffect(() => {
    const el = ref.current;
    if (!el) {
      return;
    }

    function onBlur(event: FocusEvent) {
      const target = event.target;
      if (target instanceof HTMLElement && target.hasAttribute('disabled')) {
        focusRestoreTargetRef.current = target;
      }
    }

    el.addEventListener('blur', onBlur, true);
    return () => el.removeEventListener('blur', onBlur, true);
  }, [ref]);

  useEffect(() => {
    if (!isDisabledByAutoSave && focusRestoreTargetRef.current) {
      const target = focusRestoreTargetRef.current;
      focusRestoreTargetRef.current = null;
      // Only restore focus if it's still on the body (i.e. the user hasn't
      // moved focus elsewhere while the mutation was in-flight).
      if (target.isConnected && document.activeElement === document.body) {
        target.focus();
      }
    }
  }, [isDisabledByAutoSave]);
}

type FieldState = {indicator: React.ReactNode};

export function BaseField<T extends HTMLElement>({
  children,
  disabled,
  ref: refProp,
}: BaseFieldProps<T> & {
  children: (props: FieldChildrenProps<T>, state: FieldState) => React.ReactNode;
}) {
  const autoSaveContext = useAutoSaveContext();
  const indicator = useAutoSaveIndicator();
  const field = useFieldContext();
  const ref = useRef<T>(null);
  const fieldId = useFieldId();
  const hintTextId = useHintTextId();
  useScrollToHash(field.name, ref);
  useFocusRestore(ref);

  return (
    <Flex gap="sm" align="center">
      {children(
        {
          // oxlint-disable-next-line react/refs
          ref: mergeRefs(ref, refProp),
          disabled: !!disabled || autoSaveContext?.status === 'pending',
          'aria-invalid': !field.state.meta.isValid,
          'aria-describedby': hintTextId,
          onBlur: field.handleBlur,
          name: field.name,
          id: fieldId,
        },
        {indicator}
      )}

      <FieldMeta.Status disabled={disabled} />
    </Flex>
  );
}

function animateRowHighlight(fieldName: string, node: HTMLElement | null) {
  if (!node) {
    return;
  }
  const selector = `#${CSS.escape(fieldName)}`;
  // Group controls can wrap their layout instead of being inside it.
  const fieldRow =
    node.closest<HTMLElement>(selector) ?? node.querySelector<HTMLElement>(selector);
  if (fieldRow) {
    fieldRow.dataset.highlight = '';
    fieldRow.addEventListener('animationend', () => delete fieldRow.dataset.highlight, {
      once: true,
    });
  }
}
