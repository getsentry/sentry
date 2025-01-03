import {renderHook, waitFor} from 'sentry-test/reactTestingLibrary';

import type {FeedbackIntegration} from 'sentry/components/feedback/widget/useFeedback';
import * as useFeedback from 'sentry/components/feedback/widget/useFeedback';
import {GlobalFeedbackForm, useFeedbackForm} from 'sentry/utils/useFeedbackForm';

const mockForm = {
  appendToDom: jest.fn(),
  open: jest.fn(),
  close: jest.fn(),
  removeFromDom: jest.fn(),
};

const mockFeedback = {
  createForm: jest.fn().mockResolvedValue(mockForm),
} as unknown as FeedbackIntegration;

const defaultOptions = {
  colorScheme: 'light' as const,
  buttonLabel: '',
  submitButtonLabel: '',
  messagePlaceholder: '',
  formTitle: '',
  tags: {},
};

describe('useFeedbackForm', function () {
  beforeEach(() => {
    jest
      .spyOn(useFeedback, 'useFeedback')
      .mockReturnValue({feedback: mockFeedback, options: defaultOptions});
    jest.clearAllMocks();
  });

  it('can open the form using useFeedbackForm', async function () {
    const {result} = renderHook(useFeedbackForm, {wrapper: GlobalFeedbackForm});
    const openForm = result.current;

    expect(openForm).not.toBeNull();

    // Calling openForm() should create a form and append it to the DOM
    await openForm!();

    expect(mockFeedback.createForm).toHaveBeenCalledTimes(1);
    expect(mockForm.appendToDom).toHaveBeenCalledTimes(1);
    expect(mockForm.open).toHaveBeenCalledTimes(1);
  });

  it('uses a new form instance each time', async function () {
    const {result} = renderHook(useFeedbackForm, {wrapper: GlobalFeedbackForm});
    const openForm = result.current;

    await openForm!({formTitle: 'foo'});
    expect(mockFeedback.createForm).toHaveBeenLastCalledWith(
      expect.objectContaining({...defaultOptions, formTitle: 'foo'})
    );

    expect(mockForm.removeFromDom).not.toHaveBeenCalled();

    await openForm!({formTitle: 'bar'});
    expect(mockFeedback.createForm).toHaveBeenLastCalledWith(
      expect.objectContaining({...defaultOptions, formTitle: 'bar'})
    );

    // Shoul have been removed once and added twice
    expect(mockForm.removeFromDom).toHaveBeenCalledTimes(1);
    expect(mockFeedback.createForm).toHaveBeenCalledTimes(2);
    expect(mockForm.appendToDom).toHaveBeenCalledTimes(2);
    expect(mockForm.open).toHaveBeenCalledTimes(2);
  });

  it('cleans up on unmount', async function () {
    const {result, unmount} = renderHook(useFeedbackForm, {wrapper: GlobalFeedbackForm});
    const openForm = result.current;

    await openForm!();
    unmount();

    await waitFor(() => {
      expect(mockForm.removeFromDom).toHaveBeenCalledTimes(1);
    });
  });
});
