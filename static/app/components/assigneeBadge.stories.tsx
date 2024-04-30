import {AssigneeBadge} from 'sentry/components/assigneeBadge';
import storyBook from 'sentry/stories/storyBook';
import type {Actor} from 'sentry/types';
import {useUser} from 'sentry/utils/useUser';

export default storyBook(AssigneeBadge, story => {
  story('Assignee Exists', () => {
    const user = useUser();

    const userActor: Actor = {
      type: 'user',
      id: user.id,
      name: user.name,
      email: user.email,
    };

    return <AssigneeBadge assignedTo={userActor} />;
  });

  story('Assignee Does Not Exist', () => {
    return <AssigneeBadge assignedTo={null} />;
  });
});
