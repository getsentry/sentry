import {useEffect, useRef} from 'react';

import {Input} from '@sentry/scraps/input';
import {Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import type {AdminConfirmRenderProps} from 'admin/components/adminConfirmationModal';

/**
 * Rendered as part of a openAdminConfirmModal call
 */
export function SetContractPackageAction({
  onConfirm,
  setConfirmCallback,
  disableConfirmButton,
}: AdminConfirmRenderProps) {
  // Holds the latest value so the confirm callback (registered once on mount)
  // always reads the current input.
  const packageUidRef = useRef('');

  useEffect(() => {
    disableConfirmButton(true);
    setConfirmCallback(params => {
      onConfirm?.({...params, packageUid: packageUidRef.current});
    });
    // Only register the callback once on mount. setConfirmCallback is recreated
    // on every parent render and updates parent state, so depending on it would
    // cause an infinite render loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Stack gap="md">
      <Text>
        Point the current contract at another package immediately. This skips checkout, so
        there is no proration, invoice, or rollover. Clear any pending changes first.
      </Text>
      <Input
        aria-label="Package UID"
        placeholder="Package UID"
        onChange={e => {
          packageUidRef.current = e.target.value.trim();
          disableConfirmButton(packageUidRef.current === '');
        }}
      />
    </Stack>
  );
}
