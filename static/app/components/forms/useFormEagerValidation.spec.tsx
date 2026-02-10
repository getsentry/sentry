import {act, renderHook} from 'sentry-test/reactTestingLibrary';

import FormModel from 'sentry/components/forms/model';

import {useFormEagerValidation} from './useFormEagerValidation';

describe('useFormEagerValidation', () => {
  let formModel: FormModel;

  beforeEach(() => {
    formModel = new FormModel();
    jest.spyOn(formModel, 'validateForm');
  });

  it('does not validate during initial render', () => {
    renderHook(() => useFormEagerValidation(formModel));

    expect(formModel.validateForm).not.toHaveBeenCalled();
  });

  it('validates on first field change', () => {
    const {result} = renderHook(() => useFormEagerValidation(formModel));

    act(() => result.current.onFieldChange());

    expect(formModel.validateForm).toHaveBeenCalledTimes(1);
  });

  it('does not validate on subsequent field changes', () => {
    const {result} = renderHook(() => useFormEagerValidation(formModel));

    act(() => result.current.onFieldChange());
    act(() => result.current.onFieldChange());
    act(() => result.current.onFieldChange());

    expect(formModel.validateForm).toHaveBeenCalledTimes(1);
  });
});
