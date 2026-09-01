import {useEffect, useRef, type Ref} from 'react';
import {mergeRefs} from '@react-aria/utils';

import {useAutoSaveContext} from '@sentry/scraps/form/autoSaveContext';
import {fieldComponent, type AnyFieldApi} from '@sentry/scraps/form/formHelpers';
import {Checkmark, Spinner} from '@sentry/scraps/form/icons';
import {Flex} from '@sentry/scraps/layout';

import {useLocation} from 'sentry/utils/useLocation';

import {FieldMeta} from './meta';

export type BaseFieldProps<T extends HTMLElement> = {
  disabled?: boolean | string;
  error?: string;
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

export const useAutoSaveIndicator = (field: AnyFieldApi) => {
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

export const getFieldId = (field: AnyFieldApi) => {
  return field.form.formId + field.name;
};

export const getHintTextId = (field: AnyFieldApi) => {
  const fieldId = getFieldId(field);

  return `${fieldId}-hint`;
};

export const getLabelId = (field: AnyFieldApi) => {
  const fieldId = getFieldId(field);

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

function useFocusRestore(ref: React.RefObject<HTMLElement | null>) {
  const autoSaveContext = useAutoSaveContext();
  const hadFocusRef = useRef(false);
  const isDisabledByAutoSave = autoSaveContext?.status === 'pending';

  // When the element loses focus because it was disabled during an auto-save,
  // record that so we can restore focus when the mutation completes.
  // The native blur listener fires synchronously during DOM commit (when React
  // sets the disabled attribute), so we can check el.disabled at that point.
  useEffect(() => {
    const el = ref.current;
    if (!el) {
      return;
    }

    function onBlur() {
      if (el?.hasAttribute('disabled')) {
        hadFocusRef.current = true;
      }
    }

    el.addEventListener('blur', onBlur);
    return () => el.removeEventListener('blur', onBlur);
  }, [ref]);

  useEffect(() => {
    if (!isDisabledByAutoSave && hadFocusRef.current) {
      hadFocusRef.current = false;
      // Only restore focus if it's still on the body (i.e. the user hasn't
      // moved focus elsewhere while the mutation was in-flight).
      if (document.activeElement === document.body) {
        ref.current?.focus();
      }
    }
  }, [isDisabledByAutoSave, ref]);
}

type FieldState = {indicator: React.ReactNode};

function BaseFieldImpl<T extends HTMLElement>(
  props: BaseFieldProps<T> & {
    children: (props: FieldChildrenProps<T>, state: FieldState) => React.ReactNode;
    field: AnyFieldApi;
  }
) {
  const autoSaveContext = useAutoSaveContext();
  const indicator = useAutoSaveIndicator(props.field);
  const ref = useRef<T>(null);
  const fieldId = getFieldId(props.field);
  const hintTextId = getHintTextId(props.field);
  useScrollToHash(String(props.field.name), ref);
  useFocusRestore(ref);

  return (
    <Flex gap="sm" align="center">
      {props.children(
        {
          ref: mergeRefs(ref, props.ref),
          disabled: !!props.disabled || autoSaveContext?.status === 'pending',
          'aria-invalid': !props.field.meta.isValid,
          'aria-describedby': hintTextId,
          onBlur: props.field.handleBlur,
          name: props.field.name,
          id: fieldId,
        },
        {indicator}
      )}
      <FieldMeta.Status disabled={props.disabled} error={props.error} />
    </Flex>
  );
}

type BaseFieldComponent = <T extends HTMLElement>(
  props: BaseFieldProps<T> & {
    children: (props: FieldChildrenProps<T>, state: FieldState) => React.ReactNode;
  }
) => React.ReactNode;

export const BaseField = fieldComponent.loose(
  BaseFieldImpl,
  'field'
) as BaseFieldComponent;

export {BaseFieldImpl};

function animateRowHighlight(node: HTMLElement | null) {
  if (!node) {
    return;
  }
  const name = node.getAttribute('name');
  if (!name) {
    return;
  }
  const fieldRow = node.closest<HTMLElement>(`#${CSS.escape(name)}`);
  if (fieldRow) {
    fieldRow.dataset.highlight = '';
    fieldRow.addEventListener('animationend', () => delete fieldRow.dataset.highlight, {
      once: true,
    });
  }
}
