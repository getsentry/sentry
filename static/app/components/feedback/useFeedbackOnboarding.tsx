import useSelectedProjectsHaveField from 'sentry/utils/project/useSelectedProjectsHaveField';

export default function useHaveSelectedProjectsSetupFeedback() {
  const {hasField: hasSetupOneFeedback, fetching} =
    useSelectedProjectsHaveField('hasFeedbacks');
  return {hasSetupOneFeedback, fetching};
}

export function useHaveSelectedProjectsSetupNewFeedback() {
  const {hasField: hasSetupNewFeedback, fetching} =
    useSelectedProjectsHaveField('hasNewFeedbacks');
  return {hasSetupNewFeedback, fetching};
}
