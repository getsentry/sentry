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
});
