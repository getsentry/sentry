import PropTypes from 'prop-types';
import React from 'react';
import Tooltip from 'app/components/tooltip';
import {t} from 'app/locale';
import GuideAnchor from 'app/components/assistant/guideAnchor';

class CrashHeader extends React.Component {
  static propTypes = {
    title: PropTypes.string,
    beforeTitle: PropTypes.any,
    platform: PropTypes.string,
    thread: PropTypes.object,
    exception: PropTypes.object,
    stacktrace: PropTypes.object,
    stackView: PropTypes.string.isRequired,
    newestFirst: PropTypes.bool.isRequired,
    stackType: PropTypes.string, // 'original', 'minified', or falsy (none)
    onChange: PropTypes.func,
    hideGuide: PropTypes.bool,
  };

  static defaultProps = {
    hideGuide: false,
  };

  hasSystemFrames() {
    const {stacktrace, thread, exception} = this.props;
    return (
      (stacktrace && stacktrace.hasSystemFrames) ||
      (thread && thread.stacktrace && thread.stacktrace.hasSystemFrames) ||
      (exception &&
        exception.values.find(x => !!(x.stacktrace && x.stacktrace.hasSystemFrames)))
    );
  }

  hasMinified() {
    if (!this.props.stackType) {
      return false;
    }
    const {exception, thread} = this.props;
    return (
      (exception && !!exception.values.find(x => x.rawStacktrace)) ||
      (thread && !!thread.rawStacktrace)
    );
  }

  getOriginalButtonLabel() {
    if (this.props.platform === 'javascript' || this.props.platform === 'node') {
      return t('Original');
    } else {
      return t('Symbolicated');
    }
  }

  getMinifiedButtonLabel() {
    if (this.props.platform === 'javascript' || this.props.platform === 'node') {
      return t('Minified');
    } else {
      return t('Unsymbolicated');
    }
  }

  handleToggleOrder = () => {
    this.notify({
      newestFirst: !this.props.newestFirst,
    });
  };

  setStackType(type) {
    this.notify({
      stackType: type,
    });
  }

  setStackView(view) {
    this.notify({
      stackView: view,
    });
  }

  notify(obj) {
    if (this.props.onChange) {
      this.props.onChange(obj);
    }
  }

  render() {
    const {title, beforeTitle, hideGuide, stackView, stackType, newestFirst} = this.props;

    let titleNode = (
      <h3 className="pull-left">
        {title}
        <small style={{marginLeft: 5}}>
          (
          <Tooltip title={t('Toggle stacktrace order')}>
            <a onClick={this.handleToggleOrder} style={{borderBottom: '1px dotted #aaa'}}>
              {newestFirst ? t('most recent call first') : t('most recent call last')}
            </a>
          </Tooltip>
          )
        </small>
      </h3>
    );

    if (!hideGuide) {
      titleNode = (
        <GuideAnchor target="exception" position="top">
          {titleNode}
        </GuideAnchor>
      );
    }

    return (
      <div className="crash-title">
        {beforeTitle}
        {titleNode}
        <div className="btn-group" style={{marginLeft: 10}}>
          {this.hasSystemFrames() && (
            <a
              className={
                (stackView === 'app' ? 'active' : '') + ' btn btn-default btn-sm'
              }
              onClick={() => this.setStackView('app')}
            >
              {t('App Only')}
            </a>
          )}
          <a
            className={(stackView === 'full' ? 'active' : '') + ' btn btn-default btn-sm'}
            onClick={() => this.setStackView('full')}
          >
            {t('Full')}
          </a>
          <a
            className={(stackView === 'raw' ? 'active' : '') + ' btn btn-default btn-sm'}
            onClick={() => this.setStackView('raw')}
          >
            {t('Raw')}
          </a>
        </div>
        <div className="btn-group">
          {this.hasMinified() && [
            <a
              key="original"
              className={
                (stackType === 'original' ? 'active' : '') + ' btn btn-default btn-sm'
              }
              onClick={() => this.setStackType('original')}
            >
              {this.getOriginalButtonLabel()}
            </a>,
            <a
              key="minified"
              className={
                (stackType === 'minified' ? 'active' : '') + ' btn btn-default btn-sm'
              }
              onClick={() => this.setStackType('minified')}
            >
              {this.getMinifiedButtonLabel()}
            </a>,
          ]}
        </div>
      </div>
    );
  }
}

export default CrashHeader;
