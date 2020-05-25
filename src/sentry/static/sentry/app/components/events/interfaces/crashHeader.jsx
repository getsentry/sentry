import PropTypes from 'prop-types';
import React from 'react';
import styled from '@emotion/styled';

import Button from 'app/components/button';
import ButtonBar from 'app/components/buttonBar';
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

    const titleNode = (
      <h3
        style={{
          marginBottom: 0,
          maxWidth: '100%',
          whiteSpace: 'nowrap',
        }}
      >
        <GuideAnchor target="exception" disabled={hideGuide} position="bottom">
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
        </GuideAnchor>
      </h3>
    );

    return (
      <Wrapper className="crash-title">
        <TitleWrapper>
          {beforeTitle}
          {titleNode}
        </TitleWrapper>
        <ButtonGroupWrapper>
          <ButtonGroup merged>
            {this.hasSystemFrames() && (
              <Button
                className={stackView === 'app' ? 'active' : ''}
                priority={stackView === 'app' ? 'primary' : 'default'}
                size="xsmall"
                onClick={() => this.setStackView('app')}
              >
                {t('App Only')}
              </Button>
            )}
            <Button
              className={stackView === 'full' ? 'active' : ''}
              priority={stackView === 'full' ? 'primary' : 'default'}
              size="xsmall"
              onClick={() => this.setStackView('full')}
            >
              {t('Full')}
            </Button>
            <Button
              className={stackView === 'raw' ? 'active' : ''}
              priority={stackView === 'raw' ? 'primary' : 'default'}
              onClick={() => this.setStackView('raw')}
              size="xsmall"
            >
              {t('Raw')}
            </Button>
          </ButtonGroup>
          {this.hasMinified() && (
            <ButtonGroup merged>
              {[
                <Button
                  key="original"
                  className={stackType === 'original' ? 'active' : ''}
                  priority={stackType === 'original' ? 'primary' : 'default'}
                  size="xsmall"
                  onClick={() => this.setStackType('original')}
                >
                  {this.getOriginalButtonLabel()}
                </Button>,
                <Button
                  key="minified"
                  className={stackType === 'minified' ? 'active' : ''}
                  priority={stackType === 'minified' ? 'primary' : 'default'}
                  size="xsmall"
                  onClick={() => this.setStackType('minified')}
                >
                  {this.getMinifiedButtonLabel()}
                </Button>,
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
  flex-wrap: wrap;
  width: 100%;
`;

const TitleWrapper = styled('div')`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  > * {
    margin-bottom: ${space(0.5)};
    :last-child {
      margin-bottom: 0;
    }
  }

  @media (min-width: ${props => props.theme.breakpoints[0]}) {
    > * {
      margin-right: ${space(0.5)};
      margin-bottom: 0;
      :last-child {
        margin-right: ${space(1)};
      }
    }
  }
`;

const ButtonGroup = styled(ButtonBar)`
  padding: ${space(1.5)} ${space(1)} ${space(1.5)} 0;
`;

const ButtonGroupWrapper = styled('div')`
  display: flex;
  flex-direction: column;
  flex-wrap: wrap;
  margin-right: -${space(1)};
  @media (min-width: ${props => props.theme.breakpoints[1]}) {
    flex-direction: row;
  }
`;
