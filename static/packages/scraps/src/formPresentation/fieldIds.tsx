import {useFieldContext} from './formContext';

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
