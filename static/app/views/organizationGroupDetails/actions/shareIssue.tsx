import {useRef, useState} from 'react';
import styled from '@emotion/styled';

import ActionButton from 'sentry/components/actions/button';
import AutoSelectText from 'sentry/components/autoSelectText';
import Button from 'sentry/components/button';
import Clipboard from 'sentry/components/clipboard';
import Confirm from 'sentry/components/confirm';
import DropdownLink from 'sentry/components/dropdownLink';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Switch from 'sentry/components/switchButton';
import {IconChevron, IconCopy, IconRefresh} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';

type ContainerProps = {
  onCancel: () => void;
  onConfirm: () => void;
  onConfirming: () => void;
  shareUrl: string;
};

type Props = {
  loading: boolean;
  /**
   * Called when refreshing an existing link
   */
  onReshare: () => void;
  onToggle: () => void;
  disabled?: boolean;
  /**
   * Link is public
   */
  isShared?: boolean;
  shareUrl?: string | null;
};

function ShareIssue({loading, onReshare, onToggle, disabled, isShared, shareUrl}: Props) {
  const [hasConfirmModal, setHasConfirmModal] = useState(false);

  // State of confirm modal so we can keep dropdown menu opn
  const handleConfirmCancel = () => {
    setHasConfirmModal(false);
  };

  const handleConfirmReshare = () => {
    setHasConfirmModal(true);
  };

  const handleToggleShare = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    onToggle();
  };

  const handleOpen = () => {
    // Starts sharing as soon as dropdown is opened
    if (!loading && !isShared) {
      onToggle();
    }
  };

  return (
    <DropdownLink
      shouldIgnoreClickOutside={() => hasConfirmModal}
      customTitle={
        <ActionButton disabled={disabled}>
          <DropdownTitleContent>
            <IndicatorDot isShared={isShared} />
            {t('Share')}
          </DropdownTitleContent>

          <IconChevron direction="down" size="xs" />
        </ActionButton>
      }
      onOpen={handleOpen}
      disabled={disabled}
      keepMenuOpen
    >
      <DropdownContent>
        <Header>
          <Title>{t('Enable public share link')}</Title>
          <Switch isActive={isShared} size="sm" toggle={handleToggleShare} />
        </Header>

        {loading && (
          <LoadingContainer>
            <LoadingIndicator mini />
          </LoadingContainer>
        )}

        {!loading && isShared && shareUrl && (
          <ShareUrlContainer
            shareUrl={shareUrl}
            onCancel={handleConfirmCancel}
            onConfirming={handleConfirmReshare}
            onConfirm={onReshare}
          />
        )}
      </DropdownContent>
    </DropdownLink>
  );
}

export default ShareIssue;

type UrlRef = React.ElementRef<typeof AutoSelectText>;

function ShareUrlContainer({
  shareUrl,
  onConfirming,
  onCancel,
  onConfirm,
}: ContainerProps) {
  const urlRef = useRef<UrlRef>(null);

  return (
    <UrlContainer>
      <TextContainer>
        <StyledAutoSelectText ref={urlRef}>{shareUrl}</StyledAutoSelectText>
      </TextContainer>

      <Clipboard hideUnsupported value={shareUrl}>
        <ClipboardButton
          title={t('Copy to clipboard')}
          borderless
          size="xs"
          onClick={() => urlRef.current?.selectText()}
          icon={<IconCopy />}
          aria-label={t('Copy to clipboard')}
        />
      </Clipboard>

      <Confirm
        message={t(
          'You are about to regenerate a new shared URL. Your previously shared URL will no longer work. Do you want to continue?'
        )}
        onCancel={onCancel}
        onConfirming={onConfirming}
        onConfirm={onConfirm}
      >
        <ReshareButton
          title={t('Generate new URL')}
          aria-label={t('Generate new URL')}
          borderless
          size="xs"
          icon={<IconRefresh />}
        />
      </Confirm>
    </UrlContainer>
  );
}

const UrlContainer = styled('div')`
  display: flex;
  align-items: stretch;
  border: 1px solid ${p => p.theme.border};
  border-radius: ${space(0.5)};
`;

const LoadingContainer = styled('div')`
  display: flex;
  justify-content: center;
`;

const DropdownTitleContent = styled('div')`
  display: flex;
  align-items: center;
  margin-right: ${space(0.5)};
`;

const DropdownContent = styled('li')`
  padding: ${space(1.5)} ${space(2)};

  > div:not(:last-of-type) {
    margin-bottom: ${space(1.5)};
  }
`;

const Header = styled('div')`
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const Title = styled('div')`
  padding-right: ${space(4)};
  white-space: nowrap;
  font-size: ${p => p.theme.fontSizeMedium};
  font-weight: 600;
`;

const IndicatorDot = styled('span')<{isShared?: boolean}>`
  display: inline-block;
  margin-right: ${space(0.5)};
  border-radius: 50%;
  width: 10px;
  height: 10px;
  background: ${p => (p.isShared ? p.theme.active : p.theme.border)};
`;

const StyledAutoSelectText = styled(AutoSelectText)`
  flex: 1;
  padding: ${space(0.5)} 0 ${space(0.5)} ${space(0.75)};
  ${p => p.theme.overflowEllipsis}
`;

const TextContainer = styled('div')`
  position: relative;
  display: flex;
  flex: 1;
  background-color: transparent;
  border-right: 1px solid ${p => p.theme.border};
  max-width: 288px;
`;

const ClipboardButton = styled(Button)`
  border-radius: 0;
  border-right: 1px solid ${p => p.theme.border};
  height: 100%;

  &:hover {
    border-right: 1px solid ${p => p.theme.border};
  }
`;

const ReshareButton = styled(Button)`
  height: 100%;
`;
