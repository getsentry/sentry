import React, {Component} from 'react';
import PropTypes from 'prop-types';
import styled from '@emotion/styled';

import rrwebPlayer from 'rrweb-player';

class RRWebReplayer extends Component {
  static propTypes = {
    url: PropTypes.string.isRequired,
  };

  async componentDidMount() {
    const resp = await fetch(this.props.url);
    const payload = await resp.json();
    const _ = new rrwebPlayer({
      target: this.ref.current,
      autoplay: false,
      data: {
        ...payload,
      },
    });
  }

  ref = React.createRef();

  render() {
    return <div ref={this.ref} className={this.props.className} />;
  }
}

export default styled(RRWebReplayer)`
  display: flex;
  flex: 1;
  align-items: center;

  .rr-player {
    position: relative;
  }

  .rr-player__frame {
    overflow: hidden;
  }

  .replayer-wrapper {
    float: left;
    clear: both;
    transform-origin: top left;
    left: 50%;
    top: 50%;
  }

  .replayer-wrapper > iframe {
    border: none;
  }

  .rr-controller {
    width: 100%;
    height: 80px;
    background: #fff;
    display: flex;
    flex-direction: column;
    justify-content: space-around;
    align-items: center;
    border-radius: 0 0 5px 5px;
  }

  .rr-timeline {
    width: 80%;
    display: flex;
    align-items: center;
  }

  .rr-timeline__time {
    padding: 0 20px;
    color: #11103e;
  }

  .rr-progress {
    width: 100%;
    height: 12px;
    background: #eee;
    position: relative;
    border-radius: 3px;
    cursor: pointer;
    box-sizing: border-box;
    border-top: solid 4px #fff;
    border-bottom: solid 4px #fff;
  }

  .rr-progress.disabled {
    cursor: not-allowed;
  }

  .rr-progress__step {
    height: 100%;
    position: absolute;
    left: 0;
    top: 0;
    background: #e0e1fe;
  }

  .rr-progress__handler {
    width: 20px;
    height: 20px;
    border-radius: 10px;
    position: absolute;
    top: 2px;
    transform: translate(-50%, -50%);
    background: ${p => p.theme.purple};
  }

  .rr-controller__btns {
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 13px;
  }

  .rr-controller__btns button {
    width: 32px;
    height: 32px;
    display: flex;
    padding: 0;
    align-items: center;
    justify-content: center;
    background: none;
    border: none;
    border-radius: 50%;
    cursor: pointer;
  }

  .rr-controller__btns button:active {
    background: #e0e1fe;
  }

  .rr-controller__btns button.active {
    color: #fff;
    background: ${p => p.theme.purple};
  }

  .rr-controller__btns button:disabled {
    cursor: not-allowed;
  }

  .switch {
    height: 1em;
    display: flex;
    align-items: center;
  }

  .switch.disabled {
    opacity: 0.5;
  }

  .label {
    margin: 0 8px;
  }

  .switch input[type='checkbox'] {
    position: absolute;
    opacity: 0;
  }

  .switch label {
    width: 2em;
    height: 1em;
    position: relative;
    cursor: pointer;
    display: block;
  }

  .switch.disabled label {
    cursor: not-allowed;
  }

  .switch label:before {
    content: '';
    position: absolute;
    width: 2em;
    height: 1em;
    left: 0.1em;
    transition: background 0.1s ease;
    background: ${p => p.theme.purple};
    border-radius: 50px;
  }

  .switch label:after {
    content: '';
    position: absolute;
    width: 1em;
    height: 1em;
    border-radius: 50px;
    left: 0;
    transition: all 0.2s ease;
    box-shadow: 0px 2px 5px 0px rgba(0, 0, 0, 0.3);
    background: #fcfff4;
    animation: switch-off 0.2s ease-out;
    z-index: 2;
  }

  .switch input[type='checkbox']:checked + label:before {
    background: ${p => p.theme.purple};
  }

  .switch input[type='checkbox']:checked + label:after {
    animation: switch-on 0.2s ease-out;
    left: 1.1em;
  }
`;
