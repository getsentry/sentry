import {Fragment} from 'react';

import {AlertBadge} from 'sentry/components/core/badge/alertBadge';
import * as Storybook from 'sentry/stories';
import {IncidentStatus} from 'sentry/views/alerts/types';

export default Storybook.story('AlertBadge', story => {
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
        <Storybook.PropMatrix
          render={AlertBadge}
          selectedProps={['withText', 'status']}
          propMatrix={props}
        />
        <Storybook.PropMatrix
          render={AlertBadge}
          selectedProps={['isIssue', 'withText']}
          propMatrix={props}
        />
        <Storybook.PropMatrix
          render={AlertBadge}
          selectedProps={['isIssue', 'status']}
          propMatrix={props}
        />
      </Fragment>
    );
  });
});
