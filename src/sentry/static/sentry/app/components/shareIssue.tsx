import PropTypes from 'prop-types';
import React from 'react';
import styled from '@emotion/styled';

import {t} from 'app/locale';
import {IconCopy, IconRefresh} from 'app/icons';
import space from 'app/styles/space';
import AutoSelectText from 'app/components/autoSelectText';
import Button from 'app/components/button';
import Clipboard from 'app/components/clipboard';
import Confirm from 'app/components/confirm';
import DropdownLink from 'app/components/dropdownLink';
import LoadingIndicator from 'app/components/loadingIndicator';
import Switch from 'app/components/switch';
import overflowEllipsis from 'app/styles/overflowEllipsis';

type ContainerProps = {
  shareUrl: string;
  onConfirming: () => void;
  onConfirm: () => void;
  onCancel: () => void;
};

type UrlRef = AutoSelectText | null;

class ShareUrlContainer extends React.Component<ContainerProps> {
  urlRef?: UrlRef;

  // Select URL when its container is clicked
  handleCopyClick = () => {
    this.urlRef?.selectText();
  };

  handleUrlMount = (ref: UrlRef) => {
    this.urlRef = ref;
    // Always select url if it's available
    this.urlRef?.selectText();
  };

  render() {
    const {shareUrl, onConfirming, onCancel, onConfirm} = this.props;

    return (
      <UrlContainer>
        <TextContainer>
          <StyledAutoSelectText ref={ref => this.handleUrlMount(ref)}>
            {shareUrl}
          </StyledAutoSelectText>
        </TextContainer>

        <Clipboard hideUnsupported value={shareUrl}>
          <ClipboardButton
            title={t('Copy to clipboard')}
            borderless
            size="xsmall"
            onClick={this.handleCopyClick}
            icon={<IconCopy />}
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
            borderless
            size="xsmall"
            icon={<IconRefresh />}
          />
        </Confirm>
      </UrlContainer>
    );
  }
}

type Props = {
  loading: boolean;
  onToggle: () => void;
  /**
   * Called when refreshing an existing link
   */
  onReshare: () => void;
  /**
   * Link is public
   */
  isShared?: boolean;
  shareUrl?: string | null;
};

class ShareIssue extends React.Component<Props> {
  static propTypes = {
    loading: PropTypes.bool.isRequired,
    isShared: PropTypes.bool,
    shareUrl: PropTypes.string,
    onToggle: PropTypes.func.isRequired,
    onReshare: PropTypes.func.isRequired,
  };

  hasConfirmModal = false;

  handleToggleShare = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    this.props.onToggle();
  };

  handleOpen = () => {
    const {loading, isShared, onToggle} = this.props;
    if (!loading && !isShared) {
      // Starts sharing as soon as dropdown is opened
      onToggle();
    }
  };

  // State of confirm modal so we can keep dropdown menu opn
  handleConfirmCancel = () => {
    this.hasConfirmModal = false;
  };
  handleConfirmReshare = () => {
    this.hasConfirmModal = true;
  };

  render() {
    const {loading, isShared, shareUrl, onReshare} = this.props;

    return (
      <DropdownLink
        className="share-issue btn-sm btn btn-default"
        shouldIgnoreClickOutside={() => this.hasConfirmModal}
        title={
          <DropdownTitleContent>
            <IndicatorDot isShared={isShared} />
            {t('Share')}
          </DropdownTitleContent>
        }
        onOpen={this.handleOpen}
        keepMenuOpen
      >
        <DropdownContent>
          <Header>
            <Title>{t('Enable public share link')}</Title>
            <Switch isActive={isShared} size="sm" toggle={this.handleToggleShare} />
          </Header>

          {loading && (
            <LoadingContainer>
              <LoadingIndicator mini />
            </LoadingContainer>
          )}

          {!loading && isShared && shareUrl && (
            <ShareUrlContainer
              shareUrl={shareUrl}
              onCancel={this.handleConfirmCancel}
              onConfirming={this.handleConfirmReshare}
              onConfirm={onReshare}
            />
          )}
        </DropdownContent>
      </DropdownLink>
    );
  }
}

export default ShareIssue;

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
`;

const Title = styled('h6')`
  margin: 0;
  padding-right: ${space(4)};
  white-space: nowrap;
`;

const IndicatorDot = styled('span')<{isShared?: boolean}>`
  display: inline-block;
  margin-right: ${space(0.5)};
  border-radius: 50%;
  width: 10px;
  height: 10px;
  background: ${p => (p.isShared ? p.theme.green300 : p.theme.border)};
`;

const StyledAutoSelectText = styled(AutoSelectText)<
  React.ComponentPropsWithRef<typeof AutoSelectText>
>`
  flex: 1;
  padding: ${space(0.5)} 0 ${space(0.5)} ${space(0.75)};
  ${overflowEllipsis}
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
