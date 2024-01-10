import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import useFeedbackCache from 'sentry/components/feedback/useFeedbackCache';
import useMutateActivity from 'sentry/components/feedback/useMutateActivity';
import {t} from 'sentry/locale';
import {Group} from 'sentry/types';
import {FeedbackIssue} from 'sentry/utils/feedback/types';
import useOrganization from 'sentry/utils/useOrganization';
import ActivitySection from 'sentry/views/issueDetails/activitySection';

type Props = {
  feedbackItem: FeedbackIssue;
};

function FeedbackActivitySection(props: Props) {
  const {feedbackItem} = props;
  const organization = useOrganization();

  const {updateCached, invalidateCached} = useFeedbackCache();

  const mutators = useMutateActivity({
    onMutate: ([{activity}, _method]) => {
      updateCached([feedbackItem.id], {activity});
    },
    onSettled: (_resp, _error, _var, _context) => {
      invalidateCached([feedbackItem.id]);
    },
    organization,
    group: feedbackItem as unknown as Group,
  });

  const deleteMutationOptions = {
    onError: () => {
      addErrorMessage(t('An error occurred while removing the comment.'));
    },
    onSuccess: () => {
      addSuccessMessage(t('Comment removed'));
    },
  };

  const addMutationOptions = {
    onError: () => {
      addErrorMessage(t('An error occurred while posting the comment.'));
    },
    onSuccess: () => {
      addSuccessMessage(t('Comment posted'));
    },
  };

  const updateMutationOptions = {
    onError: () => {
      addErrorMessage(t('An error occurred while updating the comment.'));
    },
    onSuccess: () => {
      addSuccessMessage(t('Comment updated'));
    },
  };

  return (
    <ActivitySection
      group={feedbackItem as unknown as Group}
      mutators={mutators}
      placeholderText={t(
        'Add details or updates to this feedback. \nTag users with @, or teams with #'
      )}
      updateMutationOptions={updateMutationOptions}
      addMutationOptions={addMutationOptions}
      deleteMutationOptions={deleteMutationOptions}
    />
  );
}

export default FeedbackActivitySection;
