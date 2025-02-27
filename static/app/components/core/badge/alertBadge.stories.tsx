import {Fragment} from 'react';

import {AlertBadge} from 'sentry/components/core/badge/alertBadge';
import Matrix from 'sentry/components/stories/matrix';
import storyBook from 'sentry/stories/storyBook';
import {IncidentStatus} from 'sentry/views/alerts/types';

export default storyBook('AlertBadge', story => {
  story('Default', () => {
    const props = {
      status: [
        IncidentStatus.OPENED,
        IncidentStatus.CLOSED,
        IncidentStatus.WARNING,
        IncidentStatus.CRITICAL,
      ],
      withText: [false, true],
      isIssue: [false, true],
      isDisabled: [false, true],
    };

    return (
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
    );
  });
});
