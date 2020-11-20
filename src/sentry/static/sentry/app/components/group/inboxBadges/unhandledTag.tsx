import React from 'react';

import Feature from 'app/components/acl/feature';
import Tag from 'app/components/tag';
import {IconSubtract} from 'app/icons';
import {t} from 'app/locale';

/**
 * Used in new inbox
 * Renders the unhandled tag for the group
 */

// TODO(matej): remove "unhandled-issue-flag" feature flag once testing is over (otherwise this won't ever be rendered in a shared event)
const UnhandledTag = () => (
  <Feature features={['unhandled-issue-flag']}>
    <Tag
      icon={<IconSubtract isCircled />}
      tooltipText={t('An unhandled error was detected in this Issue.')}
      type="error"
    >
      {t('Unhandled')}
    </Tag>
  </Feature>
);

export default UnhandledTag;
