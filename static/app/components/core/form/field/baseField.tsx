import {useEffect, useRef, type Ref} from 'react';

import {useAutoSaveContext} from '@sentry/scraps/form/autoSaveContext';
import {useFieldContext} from '@sentry/scraps/form/formContext';
import {Checkmark, Spinner, Warning} from '@sentry/scraps/form/icons';
import {Tooltip} from '@sentry/scraps/tooltip';

export type BaseFieldProps = Record<never, unknown>;

type FieldChildrenProps = {
  'aria-describedby': string;
  'aria-invalid': boolean;
  id: string;
  name: string;
  onBlur: () => void;
  ref: Ref<HTMLElement>;
};

export const useFieldStateIndicator = () => {
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

  if (!field.state.meta.isValid) {
    const errorMessage = field.state.meta.errors.map(e => e?.message).join(',');
    return (
      <Tooltip position="bottom" offset={8} title={errorMessage} forceVisible skipWrapper>
        <Warning variant="danger" size="sm" />
      </Tooltip>
    );
  }
  return null;
};

export const useFieldId = () => {
  const field = useFieldContext();

  return field.form.formId + field.name;
};

export const useHintTextId = () => {
  const fieldId = useFieldId();

  return `${fieldId}-hint`;
};

function useScrollToHash(fieldName: string, ref: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    function handleHashChange() {
      try {
        const hash = decodeURIComponent(window.location.hash.slice(1));
        if (hash !== fieldName) {
          return;
        }
      } catch {
        return;
      }
      ref.current?.scrollIntoView({block: 'center', behavior: 'smooth'});
      ref.current?.focus({focusVisible: true});
      animateRowHighlight(ref.current);
    }
    // Check on mount (page loaded with hash already in URL)
    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [fieldName, ref]);
}

export function BaseField(
  props: BaseFieldProps & {
    children: (props: FieldChildrenProps) => React.ReactNode;
  }
) {
  const field = useFieldContext();
  const ref = useRef<HTMLElement>(null);
  const fieldId = useFieldId();
  const hintTextId = useHintTextId();
  useScrollToHash(field.name, ref);

  return props.children({
    ref,
    'aria-invalid': !field.state.meta.isValid,
    'aria-describedby': hintTextId,
    onBlur: field.handleBlur,
    name: field.name,
    id: fieldId,
  });
}

function animateRowHighlight(node: HTMLElement | null) {
  if (!node) return;
  const name = node.getAttribute('name');
  if (!name) return;
  const fieldRow = node.closest<HTMLElement>(`#${CSS.escape(name)}`);
  if (fieldRow) {
    fieldRow.dataset.highlight = '';
    fieldRow.addEventListener('animationend', () => delete fieldRow.dataset.highlight, {
      once: true,
    });
  }
}
