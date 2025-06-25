import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button';
import ExternalLink from 'sentry/components/links/externalLink';
import useUserViewedReplays from 'sentry/components/replays/useUserViewedReplays';
import {IconClose, IconInfo} from 'sentry/icons';
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
      <Alert>
        <StyledIconInfo size="xs" />
        <div>
          {tct(
            'Unmask non-sensitive text (****) and media (img, svg, video). [link:Learn more].',
            {
              link: (
                <ExternalLink href="https://docs.sentry.io/platforms/javascript/session-replay/privacy/#privacy-configuration" />
              ),
            }
          )}
        </div>
        <DismissButton
          priority="link"
          size="sm"
          icon={<IconClose />}
          aria-label={t('Close Alert')}
          onClick={dismiss}
        />
      </Alert>
    </UnmaskAlertContainer>
  );
}

export default UnmaskAlert;

const UnmaskAlertContainer = styled('div')`
  position: absolute;
  bottom: ${space(1)};
  left: 0;
  width: 100%;
  text-align: center;
  font-size: ${p => p.theme.fontSize.md};
  pointer-events: none;
`;

const Alert = styled('div')`
  display: inline-flex;
  align-items: flex-start;
  justify-items: center;
  padding: ${space(1)} ${space(2)};
  margin: 0 ${space(1)};
  color: ${p => p.theme.white};
  background-color: ${p => p.theme.blue400};
  border-radius: ${p => p.theme.borderRadius};
  gap: 0 ${space(1)};
  line-height: 1em;
  a {
    color: ${p => p.theme.white};
    pointer-events: all;
    text-decoration: underline;
  }
  a:hover {
    color: ${p => p.theme.white};
    opacity: 0.5;
  }
`;

const StyledIconInfo = styled(IconInfo)`
  margin-top: 1px;
  min-width: 12px; /* Prevnt the icon from scaling down whenever text wraps */
`;

const DismissButton = styled(Button)`
  color: ${p => p.theme.white};
  pointer-events: all;
  &:hover {
    color: ${p => p.theme.white};
    opacity: 0.5;
  }
`;
