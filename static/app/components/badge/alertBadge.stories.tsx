import {Fragment} from 'react';

import AlertBadge from 'sentry/components/badge/alertBadge';
import Matrix from 'sentry/components/stories/matrix';
import storyBook from 'sentry/stories/storyBook';
import {IncidentStatus} from 'sentry/views/alerts/types';

export default storyBook('AlertBadge', story => {
  story('Default', () => <AlertBadge />);

  const props = {
    status: [
      IncidentStatus.OPENED,
      IncidentStatus.CLOSED,
      IncidentStatus.WARNING,
      IncidentStatus.CRITICAL,
    ],
    withText: [false, true],
    isIssue: [false, true],
  };
  story('Props', () => (
    <Fragment>
      <Matrix
        render={AlertBadge}
        selectedProps={['withText', 'status']}
        propMatrix={props}
      />
      <Matrix
        render={AlertBadge}
        selectedProps={['isIssue', 'withText']}
        propMatrix={props}
      />
      <Matrix
        render={AlertBadge}
        selectedProps={['isIssue', 'status']}
        propMatrix={props}
      />
    </Fragment>
  ));
});
