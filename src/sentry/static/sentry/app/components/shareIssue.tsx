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
import SpreadLayout from 'app/components/spreadLayout';
import Switch from 'app/components/switch';

type ContainerProps = {
  isBusy: boolean;
  isShared: boolean;
  shareUrl: string;
  onConfirming: () => void;
  onConfirm: () => void;
  onCancel: () => void;
};

class ShareUrlContainer extends React.Component<ContainerProps> {
  urlRef?: AutoSelectText | null;

  // Select URL when its container is clicked
  handleCopyClick = () => {
    this.urlRef?.selectText();
  };

  handleUrlMount = (ref: AutoSelectText | null) => {
    this.urlRef = ref;
    // Always select url if it's available
    this.urlRef?.selectText();
  };

  render() {
    const {isShared, isBusy, shareUrl, onConfirming, onCancel, onConfirm} = this.props;
    const url = !isBusy && isShared ? shareUrl : 'Not shared';

    return (
      <UrlContainer>
        <StyledTextContainer isShared={isShared}>
          <StyledAutoSelectText ref={ref => this.handleUrlMount(ref)}>
            {url}
          </StyledAutoSelectText>
        </StyledTextContainer>

        <Clipboard hideUnsupported value={url}>
          <ClipboardButton
            title={t('Copy to clipboard')}
            borderless
            size="xsmall"
            onClick={this.handleCopyClick}
          >
            <IconCopy />
          </ClipboardButton>
        </Clipboard>

        <Confirm
          message={t(
            'You are about to regenerate a new shared URL. Your previously shared URL will no longer work. Do you want to continue?'
          )}
          onCancel={onCancel}
          onConfirming={onConfirming}
          onConfirm={onConfirm}
        >
          <RegenerateButton title={t('Regenerate URL')} borderless size="xsmall">
            <IconRefresh />
          </RegenerateButton>
        </Confirm>
      </UrlContainer>
    );
  }
}

type Props = {
  isBusy: boolean;
  /**
   * Link is public
   */
  isShared?: boolean;
  shareUrl?: string | null;
  onToggle: () => void;
  /**
   * Called when refreshing an existing link
   */
  onReshare: () => void;
};

class ShareIssue extends React.Component<Props> {
  static propTypes = {
    isBusy: PropTypes.bool.isRequired,
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
    const {isBusy, isShared, onToggle} = this.props;
    if (!isBusy && !isShared) {
      // Starts sharing as soon as dropdown is opened
      onToggle();
    }
  };

  // State of confirm modal so we can keep dropdown menu opn
  handleConfirmCancel = () => (this.hasConfirmModal = false);
  handleConfirmReshare = () => (this.hasConfirmModal = true);

  render() {
    const {isBusy, isShared = false, shareUrl, onReshare} = this.props;

    return (
      <DropdownLink
        className="share-issue btn-sm btn btn-default"
        shouldIgnoreClickOutside={() => this.hasConfirmModal}
        title={
          <DropdownTitleContent>
            <IndicatorDot active={isShared} />
            {t('Share')}
          </DropdownTitleContent>
        }
        onOpen={this.handleOpen}
        keepMenuOpen
      >
        <StyledList>
          <SpreadLayout style={{marginBottom: isBusy || isShared ? 12 : undefined}}>
            <SmallHeading>{t('Enable public share link')}</SmallHeading>
            <Switch isActive={isShared} size="sm" toggle={this.handleToggleShare} />
          </SpreadLayout>

          {isBusy && (
            <LoadingContainer>
              <LoadingIndicator mini />
            </LoadingContainer>
          )}

          {!isBusy && isShared && shareUrl && (
            <ShareUrlContainer
              isBusy={isBusy}
              isShared={isShared}
              shareUrl={shareUrl}
              onCancel={this.handleConfirmCancel}
              onConfirming={this.handleConfirmReshare}
              onConfirm={onReshare}
            />
          )}
        </StyledList>
      </DropdownLink>
    );
  }
}

export default ShareIssue;

const UrlContainer = styled('div')`
  display: flex;
  align-items: stretch;
  border: 1px solid ${p => p.theme.borderDark};
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

const StyledList = styled('li')`
  padding: 12px 18px;
`;

const SmallHeading = styled('h6')`
  margin: 0;
  padding-right: 30px;
  white-space: nowrap;
`;

const IndicatorDot = styled('span')<{active: boolean}>`
  display: inline-block;
  margin-right: ${space(0.5)};
  border-radius: 50%;
  width: 10px;
  height: 10px;
  background: ${p => (p.active ? '#57be8c' : '#dfdbe4')};
`;

const StyledAutoSelectText = styled(AutoSelectText)<
  React.ComponentPropsWithRef<typeof AutoSelectText>
>`
  flex: 1;
  border: none;
  padding: 4px 6px 4px 10px;
  text-overflow: ellipsis;
  white-space: nowrap;
  overflow: hidden;
`;

const StyledTextContainer = styled('div')<{isShared: boolean}>`
  position: relative;
  display: flex;
  flex: 1;
  background-color: ${p => (!p.isShared ? '#f9f7f9' : 'transparent')};
  border-right: 1px solid ${p => p.theme.borderDark};
  max-width: 288px;
`;

const ClipboardButton = styled(Button)`
  border-radius: 0;
  border-right: 1px solid ${p => p.theme.borderDark};
  height: 100%;

  &:hover {
    border-right: 1px solid ${p => p.theme.borderDark};
  }
`;

const RegenerateButton = styled(Button)`
  height: 100%;
`;
