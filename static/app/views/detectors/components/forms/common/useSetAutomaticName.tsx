import {useContext, useEffect} from 'react';
import {autorun} from 'mobx';

import FormContext from 'sentry/components/forms/formContext';
import type FormModel from 'sentry/components/forms/model';
import {useDetectorFormContext} from 'sentry/views/detectors/components/forms/context';

/**
 * Hook to automatically set the detector name based on form values.
 *
 * The provided function is called with a mobx autorun, so any access to
 * getters on the prvided form model will automatically act reactively.
 *
 * @example
 * ```tsx
 * useSetAutomaticName((form) => {
 *   const metricType = form.getValue('metricType');
 *   const interval = form.getValue('interval');
 *
 *   if (!metricType || !interval) {
 *     return null;
 *   }
 *
 *   return t('Check %s every %s', metricType, getDuration(interval));
 * });
 * ```
 */
export function useSetAutomaticName(getNameFn: (form: FormModel) => string | null) {
  const {form} = useContext(FormContext);
  const {hasSetDetectorName, detector} = useDetectorFormContext();

  useEffect(() => {
    if (form === undefined || hasSetDetectorName) {
      return () => {};
    }

    // Don't auto-generate name if we're editing an existing detector
    if (detector) {
      return () => {};
    }

    return autorun(() => {
      const generatedName = getNameFn(form);
      if (generatedName) {
        form.setValue('name', generatedName);
      }
    });
  }, [form, hasSetDetectorName, getNameFn, detector]);
}
