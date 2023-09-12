import {ActivityItem} from 'sentry/components/activity/item';
import {NoteInput} from 'sentry/components/activity/note/input';
import ConfigStore from 'sentry/stores/configStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';

export default function FeedbackComments() {
  const config = useLegacyStore(ConfigStore);
  return (
    <ActivityItem
      noPadding
      hideDate
      showTime={false}
      id="activity-item-input"
      author={{
        type: 'user',
        user: config.user,
      }}
    >
      <NoteInput onEditFinish={() => {}} onUpdate={() => {}} onCreate={() => {}} />
    </ActivityItem>
  );
}
