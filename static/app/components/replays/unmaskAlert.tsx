import {useTheme} from '@emotion/react';

import {Alert} from '@sentry/scraps/alert';
import {Button} from '@sentry/scraps/button';
import {Container} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';

import {useUserViewedReplays} from 'sentry/components/replays/useUserViewedReplays';
import {IconClose} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {useDismissAlert} from 'sentry/utils/useDismissAlert';

const LOCAL_STORAGE_KEY = 'replay-unmask-alert-dismissed';

export function UnmaskAlert() {
  const theme = useTheme();
  const {dismiss, isDismissed} = useDismissAlert({key: LOCAL_STORAGE_KEY});
  const {data, isError, isPending} = useUserViewedReplays();

  if (isDismissed || isError || isPending || (data && data.data.length > 3)) {
    return null;
  }

  return (
    <Container
      data-test-id="unmask-alert"
      position="absolute"
      bottom={theme.space.md}
      left={theme.space.md}
      right={theme.space.md}
    >
      <Alert
        variant="info"
        trailingItems={
          <Button
            aria-label={t('Close Alert')}
            icon={<IconClose />}
            onClick={dismiss}
            size="zero"
            variant="transparent"
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
    </Container>
  );
}
