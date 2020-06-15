import PropTypes from 'prop-types';
import React from 'react';
import ReactDOM from 'react-dom';
import classNames from 'classnames';

import {selectText} from 'app/utils/selectText';
import {t} from 'app/locale';
import AutoSelectText from 'app/components/autoSelectText';
import Button from 'app/components/button';
import Clipboard from 'app/components/clipboard';
import Confirm from 'app/components/confirm';
import DropdownLink from 'app/components/dropdownLink';
import FlowLayout from 'app/components/flowLayout';
import LoadingIndicator from 'app/components/loadingIndicator';
import SpreadLayout from 'app/components/spreadLayout';
import Switch from 'app/components/switch';
import {IconCopy, IconRefresh} from 'app/icons';

const BORDER_COLOR = '#dad5df';

class ShareUrlContainer extends React.Component {
  static propTypes = {
    isSharing: PropTypes.bool,
    shareUrl: PropTypes.string,
    onShare: PropTypes.func,
    onConfirming: PropTypes.func,
    onCancel: PropTypes.func,
    busy: PropTypes.bool,
  };

  // Select URL when its container is clicked
  handleCopyClick = () => {
    if (!this.urlRef) {
      return;
    }
    // eslint-disable-next-line react/no-find-dom-node
    selectText(ReactDOM.findDOMNode(this.urlRef));
  };

  handleUrlMount = ref => {
    this.urlRef = ref;

    if (this.urlRef) {
      // Always select url if it's available
      // eslint-disable-next-line react/no-find-dom-node
      selectText(ReactDOM.findDOMNode(this.urlRef));
    }
  };

  render() {
    const {isSharing, busy, shareUrl, onConfirming, onCancel, onShare} = this.props;
    const url = !busy && isSharing ? shareUrl : 'Not shared';

    return (
      <FlowLayout
        style={{
          flex: 'none',
          alignItems: 'stretch',
          border: `1px solid ${BORDER_COLOR}`,
          borderRadius: 4,
        }}
      >
        <div
          style={{
            position: 'relative',
            display: 'flex',
            flex: 1,
            backgroundColor: !isSharing ? '#f9f7f9' : 'transparent',
            borderRight: `1px solid ${BORDER_COLOR}`,
            maxWidth: 288,
          }}
        >
          <AutoSelectText
            ref={this.handleUrlMount}
            style={{
              flex: 1,
              border: 'none',
              padding: '4px 6px 4px 10px',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
            }}
          >
            {url}
          </AutoSelectText>
        </div>

        <FlowLayout style={{alignItems: 'stretch'}}>
          <Clipboard hideUnsupported value={url}>
            <Button
              borderless
              size="xsmall"
              onClick={this.handleCopyClick}
              style={{borderRadius: 0, borderRight: `1px solid ${BORDER_COLOR}`}}
            >
              <IconCopy />
            </Button>
          </Clipboard>

          <Confirm
            message={t(
              'You are about to regenerate a new shared URL. Your previously shared URL will no longer work. Do you want to continue?'
            )}
            onCancel={onCancel}
            onConfirming={onConfirming}
            onConfirm={onShare}
          >
            <Button borderless size="xsmall">
              <IconRefresh />
            </Button>
          </Confirm>
        </FlowLayout>
      </FlowLayout>
    );
  }
}

const SmallHeading = ({children, ...props}) => (
  <h6
    {...props}
    style={{
      margin: 0,
      paddingRight: 30,
      whiteSpace: 'nowrap',
    }}
  >
    {children}
  </h6>
);

const IndicatorDot = ({active}) => (
  <span
    style={{
      display: 'inline-block',
      marginRight: 4,
      borderRadius: '50%',
      width: 10,
      height: 10,
      background: active ? '#57be8c' : '#dfdbe4',
    }}
  />
);
IndicatorDot.propTypes = {
  active: PropTypes.bool,
};

class ShareIssue extends React.Component {
  static propTypes = {
    isSharing: PropTypes.bool,
    shareUrl: PropTypes.string,
    busy: PropTypes.bool,
    onToggle: PropTypes.func.isRequired,
    onShare: PropTypes.func.isRequired,
  };

  constructor(props) {
    super(props);
    this.hasConfirmModal = false;
    this.state = {busy: false};
  }

  UNSAFE_componentWillReceiveProps(nextProps) {
    if (
      this.state.busy &&
      (this.props.shareUrl !== nextProps.shareUrl ||
        this.props.isSharing !== nextProps.isSharing)
    ) {
      this.setState({busy: false});
    }
  }

  handleToggleShare = e => {
    e.preventDefault();
    this.setState({busy: true}, () => this.props.onToggle());
  };

  handleShare = () => {
    const {onShare} = this.props;
    this.setState({busy: true}, () => onShare());
    this.hasConfirmModal = false;
  };

  // Should share URL if
  handleOpen = () => {
    if (!this.props.isSharing) {
      this.handleShare();
    }
  };

  // State of confirm modal so we can keep dropdown menu opn
  handleConfirmCancel = () => (this.hasConfirmModal = false);
  handleConfirmReshare = () => (this.hasConfirmModal = true);

  render() {
    const {className, isSharing} = this.props;
    const {busy} = this.state;
    const cx = classNames('share-issue btn-sm btn btn-default', className);

    const shareTitle = 'Share';

    // Needs to wrap in an inline block for DropdownLink,
    // or else dropdown icon gets wrapped?
    const title = (
      <div style={{marginRight: 4}}>
        <FlowLayout center>
          <IndicatorDot active={isSharing} />
          {shareTitle}
        </FlowLayout>
      </div>
    );

    return (
      <DropdownLink
        className={cx}
        shouldIgnoreClickOutside={() => this.hasConfirmModal}
        title={title}
        onOpen={this.handleOpen}
        keepMenuOpen
      >
        <li
          style={{
            padding: '12px 18px',
          }}
          ref={ref => (this.container = ref)}
        >
          <SpreadLayout style={{marginBottom: busy || isSharing ? 12 : undefined}}>
            <SmallHeading>{t('Enable public share link')}</SmallHeading>
            <Switch isActive={isSharing} size="sm" toggle={this.handleToggleShare} />
          </SpreadLayout>

          {busy && (
            <FlowLayout center>
              <LoadingIndicator mini />
            </FlowLayout>
          )}

          {!busy && isSharing && (
            <ShareUrlContainer
              {...this.props}
              onCancel={this.handleConfirmCancel}
              onConfirming={this.handleConfirmReshare}
              onShare={this.handleShare}
            />
          )}
        </li>
      </DropdownLink>
    );
  }
}

export default ShareIssue;
