import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import {t} from 'app/locale';
import InlineSvg from 'app/components/inlineSvg';
import {injectGlobal} from 'emotion';

const sameType = function(a, b) {
  const r = /^[0-9]+$/;
  return r.test(a) === r.test(b);
};

export default styled(
  class NotFoundMachine extends React.Component {
    static propTypes = {
      title: PropTypes.node,
      message: PropTypes.node,
    };

    static defaultProps = {
      title: t('404 Error'),
    };

    componentDidMount() {
      this.firstValue = null;
      this.timer = null;
      this.led = document.getElementById('vending-machine_led-content');
      this.buttons = document.getElementsByClassName('button');

      Array.from(this.buttons).forEach(button =>
        button.addEventListener('click', this.handleButtonPress)
      );
      const candy = document.querySelector(
        `.candy[data-val="${Math.floor(Math.random() * (2 - 0 + 1))}"]`
      );
      candy.style.cssText = 'opacity: 1;';
    }

    componentWillUnmount() {
      Array.from(this.buttons).forEach(button =>
        button.removeEventListener('click', this.handleButtonPress)
      );
    }

    inputSelection = str => {
      if (this.firstValue) {
        if (sameType(this.firstValue, str)) {
          return '';
        } else {
          const val = [this.firstValue, str];
          this.firstValue = null;
          return val;
        }
      } else {
        if (sameType(str, '')) {
          this.firstValue = str;
          return [this.firstValue];
        } else {
          return '';
        }
      }
    };

    updateDisplay = str => {
      this.led.textContent = str;
    };

    handleButtonPress = e => {
      const buttonValue = e.currentTarget.dataset.val;
      const res = this.inputSelection(buttonValue);

      clearTimeout(this.timer);
      if (res) {
        this.updateDisplay(res.join(''));
        if (res.length === 2) {
          this.timer = setTimeout(() => {
            this.updateDisplay('Not found');
          }, 500);
        }
      } else {
        if (this.firstValue) {
          this.updateDisplay('Error');
          this.timer = setTimeout(() => {
            this.updateDisplay(this.firstValue);
          }, 500);
        }
      }
    };
    render() {
      let {className, message, title} = this.props;
      return (
        <div className={className} data-candy={Math.floor(Math.random() * (2 - 0 + 1))}>
          <Main role="main">
            <Illustration>
              <StyledVendingMachine src="vending-machine" />
            </Illustration>

            <Content>
              <Perspective>
                <Title>{title}</Title>
                <p>{message}</p>
              </Perspective>
            </Content>
          </Main>
        </div>
      );
    }
  }
)`
  background-color: #16111c;
  margin: 0;
  color: #ffffff;
  height: 100%;
  font-family: 'Maison', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica,
    sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol';
  font-size: 1rem;
  font-weight: 400;
  line-height: 1.5;
  text-align: left;
  overflow: hidden;
`;

const Main = styled('main')`
  height: 100%;
`;

const StyledVendingMachine = styled(InlineSvg)`
  height: 100%;
  position: absolute;
  top: 0;
  left: 0;
  bottom: 0;
  right: 0;
  width: 100%;
  overflow: hidden;
  max-width: 50%;
  max-height: 100%;
  transform: translateY(0%);
`;

const Content = styled('div')`
  position: absolute;
  font-family: 'Lucida Console', 'Lucida Sans Typewriter', monaco,
    'Bitstream Vera Sans Mono', monospace;
  width: 30%;
  height: 100%;
  right: 15%;
  top: 0;
  display: flex;
  align-items: center;
  color: ${p => p.theme.purple2};
`;

const Illustration = styled('div')`
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  min-width: 100vh;
  width: 100%;

  &:before {
    display: block;
    content: ' ';
    width: 100%;
    padding-top: 100%;
  }
`;

const Perspective = styled('div')`
  @media screen and (orientation: portrait) {
    transform: matrix(0.87, -0.5, 0, 1, 0, 0);
    width: 70%;
    font-size: 6vw;
    margin-left: 15%;
  }
  @media screen and (orientation: landscape) {
    transform: matrix(0.87, 0.5, 0, 1, 0, 0);
    font-size: 3vw;
  }
`;

const Title = styled('h1')`
  font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
  @media screen and (orientation: portrait) {
    font-size: 14vw;
  }
  @media screen and (orientation: landscape) {
    font-size: 6vw;
  }
`;

injectGlobal`
  .candy {
    opacity: 0;
  }

  [data-candy="0"] .candy[data-val="0"],
  [data-candy="1"] .candy[data-val="1"],
  [data-candy="2"] .candy[data-val="2"] {
    opacity: 1;
  }
`;
