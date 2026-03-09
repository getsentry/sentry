import {useEffect, useRef, type Ref} from 'react';
import {mergeRefs} from '@react-aria/utils';

import {useAutoSaveContext} from '@sentry/scraps/form/autoSaveContext';
import {useFieldContext} from '@sentry/scraps/form/formContext';
import {Checkmark, Spinner} from '@sentry/scraps/form/icons';
import {Flex} from '@sentry/scraps/layout';

import {useLocation} from 'sentry/utils/useLocation';

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

export const useFieldId = () => {
  const field = useFieldContext();

  return field.form.formId + field.name;
};

export const useHintTextId = () => {
  const fieldId = useFieldId();

  return `${fieldId}-hint`;
};

export const useLabelId = () => {
  const fieldId = useFieldId();

  return `${fieldId}-label`;
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
    animateRowHighlight(ref.current);
  }, [fieldName, ref, location.hash]);
}

type FieldState = {indicator: React.ReactNode};

export function BaseField<T extends HTMLElement>(
  props: BaseFieldProps<T> & {
    children: (props: FieldChildrenProps<T>, state: FieldState) => React.ReactNode;
  }
) {
  const autoSaveContext = useAutoSaveContext();
  const indicator = useAutoSaveIndicator();
  const field = useFieldContext();
  const ref = useRef<T>(null);
  const fieldId = useFieldId();
  const hintTextId = useHintTextId();
  useScrollToHash(field.name, ref);

  return (
    <Flex gap="sm" align="center">
      {props.children(
        {
          ref: mergeRefs(ref, props.ref),
          disabled: !!props.disabled || autoSaveContext?.status === 'pending',
          'aria-invalid': !field.state.meta.isValid,
          'aria-describedby': hintTextId,
          onBlur: field.handleBlur,
          name: field.name,
          id: fieldId,
        },
        {indicator}
      )}
      <FieldMeta.Status disabled={props.disabled} />
    </Flex>
  );
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
