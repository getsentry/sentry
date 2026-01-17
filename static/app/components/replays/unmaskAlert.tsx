import styled from '@emotion/styled';

import {Alert} from 'sentry/components/core/alert';
import {Button} from 'sentry/components/core/button';
import {ExternalLink} from 'sentry/components/core/link';
import useUserViewedReplays from 'sentry/components/replays/useUserViewedReplays';
import {IconClose} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import useDismissAlert from 'sentry/utils/useDismissAlert';

const LOCAL_STORAGE_KEY = 'replay-unmask-alert-dismissed';

function UnmaskAlert() {
  const {dismiss, isDismissed} = useDismissAlert({key: LOCAL_STORAGE_KEY});
  const {data, isError, isPending} = useUserViewedReplays();

  if (isDismissed || isError || isPending || (data && data.data.length > 3)) {
    return null;
  }

  return (
    <UnmaskAlertContainer data-test-id="unmask-alert">
      <Alert
        variant="info"
        trailingItems={
          <Button
            aria-label={t('Close Alert')}
            icon={<IconClose />}
            onClick={dismiss}
            size="zero"
            borderless
          />
        }
      >
        {tct(
          'Unmask non-sensitive text (****) and media (img, svg, video). [link:Learn more].',
          {
            link: (
              <ExternalLink href="https://docs.sentry.io/platforms/javascript/session-replay/privacy/#privacy-configuration" />
            ),
          }
        )}
      </Alert>
    </UnmaskAlertContainer>
  );
}

export default UnmaskAlert;

const UnmaskAlertContainer = styled('div')`
  position: absolute;
  bottom: ${space(1)};
`;
