import {Flex} from '@sentry/scraps/layout';
import {Tooltip} from '@sentry/scraps/tooltip';

import {IconFlag, IconWarning} from 'sentry/icons';

interface StartupFlagsProps {
  flagCompanyAge: boolean;
  flagPossibleDuplicate: boolean;
}

export function StartupFlags({flagPossibleDuplicate, flagCompanyAge}: StartupFlagsProps) {
  return (
    <Flex gap="xs">
      {flagPossibleDuplicate && (
        <Tooltip title="Possible duplicate — org has an existing application">
          <IconWarning color="warning" size="sm" />
        </Tooltip>
      )}
      {flagCompanyAge && (
        <Tooltip title="Company founded over 2 years ago">
          <IconFlag color="danger" size="sm" />
        </Tooltip>
      )}
    </Flex>
  );
}
