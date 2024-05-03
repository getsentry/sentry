import {AssigneeBadge} from 'sentry/components/assigneeBadge';
import storyBook from 'sentry/stories/storyBook';
import type {Actor} from 'sentry/types';
import {useUser} from 'sentry/utils/useUser';

export default storyBook(AssigneeBadge, story => {
  story('Assignee Exists (no label)', () => {
    const user = useUser();

    const userActor: Actor = {
      type: 'user',
      id: user.id,
      name: user.name,
      email: user.email,
    };

    return <AssigneeBadge assignedTo={userActor} />;
  });

  story('Assignee Exists (with label)', () => {
    const user = useUser();

    const userActor: Actor = {
      type: 'user',
      id: user.id,
      name: user.name,
      email: user.email,
    };

    return <AssigneeBadge assignedTo={userActor} showLabel />;
  });

  story('Assignee Does Not Exist (no label)', () => {
    return <AssigneeBadge assignedTo={undefined} />;
  });

  story('Assignee Does Not Exist (with label)', () => {
    return <AssigneeBadge assignedTo={undefined} showLabel />;
  });
});
