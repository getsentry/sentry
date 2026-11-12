import {useEffect} from 'react';

import {act, renderHook} from 'sentry-test/reactTestingLibrary';

import {FormContext} from 'sentry/components/forms/formContext';
import {FormModel} from 'sentry/components/forms/model';

import {useFormField} from './useFormField';

describe('useFormField', () => {
  let model: FormModel;

  const withFormContext = ({children}: {children: React.ReactNode}) => (
    <FormContext value={{form: model}}>{children}</FormContext>
  );

  beforeEach(() => {
    model = new FormModel();
  });

  it('only updates for the subscribed field', () => {
    model.setInitialData({targetField: 'initial', otherField: 'other'});
    const onRender = jest.fn();
    const getValue = jest.spyOn(model, 'getValue');

    const {result} = renderHook(
      () => {
        const value = useFormField('targetField');
        useEffect(onRender);
        return value;
      },
      {wrapper: withFormContext}
    );

    expect(result.current).toBe('initial');
    onRender.mockClear();
    getValue.mockClear();

    act(() => {
      model.setValue('otherField', 'changed');
    });
    expect(result.current).toBe('initial');
    expect(getValue).not.toHaveBeenCalledWith('targetField');
    expect(onRender).not.toHaveBeenCalled();

    act(() => {
      model.setValue('targetField', 'changed');
    });
    expect(result.current).toBe('changed');
    expect(onRender).toHaveBeenCalled();
    onRender.mockClear();
    getValue.mockClear();

    act(() => {
      model.setValue('otherField', 'changed again');
    });
    expect(getValue).not.toHaveBeenCalledWith('targetField');
    expect(onRender).not.toHaveBeenCalled();
  });

  it('ignores unrelated updates before and after the subscribed field is added', () => {
    model.setInitialData({otherField: 'other'});
    const onRender = jest.fn();
    const getValue = jest.spyOn(model, 'getValue');

    const {result} = renderHook(
      () => {
        const value = useFormField('targetField');
        useEffect(onRender);
        return value;
      },
      {wrapper: withFormContext}
    );

    expect(result.current).toBe('');
    onRender.mockClear();
    getValue.mockClear();

    act(() => {
      model.setValue('otherField', 'changed');
    });
    expect(getValue).not.toHaveBeenCalledWith('targetField');
    expect(onRender).not.toHaveBeenCalled();

    act(() => {
      model.setValue('targetField', 'newly added');
    });
    expect(result.current).toBe('newly added');
    expect(onRender).toHaveBeenCalled();
    onRender.mockClear();
    getValue.mockClear();

    act(() => {
      model.setValue('otherField', 'changed again');
    });
    expect(getValue).not.toHaveBeenCalledWith('targetField');
    expect(onRender).not.toHaveBeenCalled();
  });

  it('handles undefined values and type parameters', () => {
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

  it('handles fields that are added after subscription', () => {
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

  it('handles fields that are removed and added again after subscription', () => {
    model.setInitialData({targetField: 'initial'});

    const {result} = renderHook(() => useFormField('targetField'), {
      wrapper: withFormContext,
    });

    expect(result.current).toBe('initial');

    act(() => {
      model.removeField('targetField');
    });
    expect(result.current).toBe('');
    act(() => {
      model.setValue('targetField', 'restored');
    });
    expect(result.current).toBe('restored');
  });
});
