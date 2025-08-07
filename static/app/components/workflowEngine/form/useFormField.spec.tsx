import {act, renderHook} from 'sentry-test/reactTestingLibrary';

import FormContext from 'sentry/components/forms/formContext';
import FormModel from 'sentry/components/forms/model';

import {useFormField} from './useFormField';

describe('useFormField', function () {
  let model: FormModel;

  const withFormContext = ({children}: {children: React.ReactNode}) => (
    <FormContext value={{form: model}}>{children}</FormContext>
  );

  beforeEach(function () {
    model = new FormModel();
  });

  it('returns field values and handles updates correctly', function () {
    model.setInitialData({targetField: 'initial', otherField: 'other'});

    const {result} = renderHook(() => useFormField('targetField'), {
      wrapper: withFormContext,
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

  it('handles undefined values and type parameters', function () {
    const {result: undefinedResult} = renderHook(() => useFormField('nonexistent'), {
      wrapper: withFormContext,
    });
    expect(undefinedResult.current).toBe('');

    model.setInitialData({numberField: 42});
    const {result: typedResult} = renderHook(() => useFormField<number>('numberField'), {
      wrapper: withFormContext,
    });
    expect(typedResult.current).toBe(42);
    expect(typeof typedResult.current).toBe('number');
  });

  it('handles fields that are added after subscription', function () {
    // Start with a hook subscribed to a field that doesn't exist yet
    const {result} = renderHook(() => useFormField('laterField'), {
      wrapper: withFormContext,
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

  it('handles fields that are removed after subscription', function () {
    model.setInitialData({targetField: 'initial'});

    const {result} = renderHook(() => useFormField('targetField'), {
      wrapper: withFormContext,
    });

    expect(result.current).toBe('initial');

    act(() => {
      model.removeField('targetField');
    });
    expect(result.current).toBe('');
  });
});
