import {act, renderHook} from 'sentry-test/reactTestingLibrary';

import FormContext from 'sentry/components/forms/formContext';
import FormModel from 'sentry/components/forms/model';

import {useFormField} from './useFormField';

describe('useFormField', () => {
  let model: FormModel;

  const withFormContext = ({children}: {children: React.ReactNode}) => (
    <FormContext value={{form: model}}>{children}</FormContext>
  );

  beforeEach(() => {
    model = new FormModel();
  });

  it('returns field values and handles updates correctly', () => {
    model.setInitialData({targetField: 'initial', otherField: 'other'});

    const {result} = renderHook(useFormField, {
      wrapper: withFormContext,
      initialProps: 'targetField',
    });

    expect(result.current).toBe('initial');

    act(() => {
      model.setValue('otherField', 'changed');
    });
    expect(result.current).toBe('initial');

    act(() => {
      model.setValue('targetField', 'changed');
    });
    expect(result.current).toBe('changed');
  });

  it('handles undefined values and type parameters', () => {
    const {result: undefinedResult} = renderHook(useFormField, {
      wrapper: withFormContext,
      initialProps: 'nonexistent',
    });
    expect(undefinedResult.current).toBe('');

    model.setInitialData({numberField: 42});
    const {result: typedResult} = renderHook(useFormField, {
      wrapper: withFormContext,
      initialProps: 'numberField',
    });
    expect(typedResult.current).toBe(42);
    expect(typeof typedResult.current).toBe('number');
  });

  it('handles fields that are added after subscription', () => {
    // Start with a hook subscribed to a field that doesn't exist yet
    const {result} = renderHook(useFormField, {
      wrapper: withFormContext,
      initialProps: 'laterField',
    });

    // Initially should return empty string for non-existent field
    expect(result.current).toBe('');

    // Add the field later
    act(() => {
      model.setValue('laterField', 'newly added');
    });

    // Should now return the newly added field value
    expect(result.current).toBe('newly added');

    // Should continue to update when the field changes
    act(() => {
      model.setValue('laterField', 'updated value');
    });

    expect(result.current).toBe('updated value');
  });

  it('handles fields that are removed after subscription', () => {
    model.setInitialData({targetField: 'initial'});

    const {result} = renderHook(useFormField, {
      wrapper: withFormContext,
      initialProps: 'targetField',
    });

    expect(result.current).toBe('initial');

    act(() => {
      model.removeField('targetField');
    });
    expect(result.current).toBe('');
  });
});
