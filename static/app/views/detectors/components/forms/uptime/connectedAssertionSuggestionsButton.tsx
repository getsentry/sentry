import {useContext, useRef} from 'react';

import type {ButtonProps} from '@sentry/scraps/button';

import FormContext from 'sentry/components/forms/formContext';
import {defined} from 'sentry/utils';
import {AssertionSuggestionsButton} from 'sentry/views/alerts/rules/uptime/assertionSuggestionsButton';
import type {Assertion} from 'sentry/views/alerts/rules/uptime/types';
import {DEFAULT_UPTIME_DETECTOR_FORM_DATA_MAP} from 'sentry/views/detectors/components/forms/uptime/fields';

const HTTP_METHODS_NO_BODY = ['GET', 'HEAD', 'OPTIONS'];

interface ConnectedAssertionSuggestionsButtonProps {
  size?: ButtonProps['size'];
}

export function ConnectedAssertionSuggestionsButton({
  size,
}: ConnectedAssertionSuggestionsButtonProps) {
  const {form} = useContext(FormContext);
  const formRef = useRef(form);
  formRef.current = form;

  const getFormData = () => {
    const data = formRef.current?.getTransformedData() ?? {};
    const method = data.method || DEFAULT_UPTIME_DETECTOR_FORM_DATA_MAP.method;
    const methodHasBody = !HTTP_METHODS_NO_BODY.includes(method);
    return {
      url: data.url || undefined,
      method,
      headers: data.headers ?? DEFAULT_UPTIME_DETECTOR_FORM_DATA_MAP.headers,
      body: methodHasBody ? data.body || null : null,
      timeoutMs: defined(data.timeoutMs)
        ? data.timeoutMs
        : DEFAULT_UPTIME_DETECTOR_FORM_DATA_MAP.timeoutMs,
    };
  };

  const getCurrentAssertion = (): Assertion | null =>
    (formRef.current?.getTransformedData()?.assertion as Assertion) ?? null;

  const handleApplySuggestion = (newAssertion: Assertion) => {
    formRef.current?.setValue('assertion', newAssertion as any);
  };

  return (
    <AssertionSuggestionsButton
      getFormData={getFormData}
      getCurrentAssertion={getCurrentAssertion}
      onApplySuggestion={handleApplySuggestion}
      size={size}
    />
  );
}
