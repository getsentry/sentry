import PropTypes from 'prop-types';
import React from 'react';
import styled from '@emotion/styled';

import Tooltip from 'app/components/tooltip';
import {t} from 'app/locale';
import GuideAnchor from 'app/components/assistant/guideAnchor';
import space from 'app/styles/space';

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
      <h3
        style={{
          marginBottom: 0,
          maxWidth: '100%',
          whiteSpace: 'nowrap',
        }}
      >
        {title}
        <small>
          (
          <Tooltip title={t('Toggle stacktrace order')}>
            <a onClick={this.handleToggleOrder}>
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
      <Wrapper className="crash-title">
        <TitleInfo>
          {beforeTitle}
          {titleNode}
        </TitleInfo>
        <ButtonGroupWrapper>
          <ButtonGroup className="btn-group">
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
              className={
                (stackView === 'full' ? 'active' : '') + ' btn btn-default btn-sm'
              }
              onClick={() => this.setStackView('full')}
            >
              {t('Full')}
            </a>
            <a
              className={
                (stackView === 'raw' ? 'active' : '') + ' btn btn-default btn-sm'
              }
              onClick={() => this.setStackView('raw')}
            >
              {t('Raw')}
            </a>
          </ButtonGroup>
          {this.hasMinified() && (
            <ButtonGroup className="btn-group">
              {[
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
            </ButtonGroup>
          )}
        </ButtonGroupWrapper>
      </Wrapper>
    );
  }
}

export default CrashHeader;

const Wrapper = styled('div')`
  display: flex;
  justify-content: space-between;
  margin-bottom: ${space(3)};
  flex-direction: column;
  flex-wrap: wrap;
  width: 100%;
  @media (min-width: ${props => props.theme.breakpoints[2]}) {
    align-items: center;
    flex-direction: row;
  }
`;

const TitleInfo = styled('div')`
  display: flex;
  flex: 1;
  max-width: 100%;
  flex-direction: column;
  @media (min-width: ${props => props.theme.breakpoints[2]}) {
    flex-direction: row;
    flex-shrink: 2;
    align-items: center;
  }
`;

const ButtonGroup = styled('div')`
  padding-top: ${space(1.5)};
  padding-bottom: ${space(1.5)};
`;

const ButtonGroupWrapper = styled('div')`
  display: flex;
  flex-direction: column;
  flex-wrap: wrap;
  margin-right: -${space(1)};
  > .btn-group {
    padding-right: ${space(1)};
  }
  @media (min-width: ${props => props.theme.breakpoints[1]}) {
    flex-direction: row;
  }
`;
