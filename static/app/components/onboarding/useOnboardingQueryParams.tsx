import {parseAsBoolean, useQueryStates} from 'nuqs';

import {parseAsStringArray} from 'sentry/utils/url/parseAsStringArray';

type QueryValues = {
  /**
   * Used to show product selection (error monitoring, tracing, profiling and session replay) for certain platforms, e.g. javascript-react
   */
  product: string[];
  /**
   * Used to show or not the integration onboarding for certain platforms, e.g. AWS (python)
   */
  showManualSetup: boolean;
};

const onboardingParsers = {
  product: parseAsStringArray,
  showManualSetup: parseAsBoolean.withDefault(false),
};

export function useOnboardingQueryParams(): [
  params: QueryValues,
  setParams: (newValues: Partial<QueryValues>) => void,
] {
  return useQueryStates(onboardingParsers, {history: 'replace'});
}
