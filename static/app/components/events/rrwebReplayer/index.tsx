import styled from '@emotion/styled';

import space from 'sentry/styles/space';

import BaseRRWebReplayer from './rrWebReplayer';

const RRWebReplayer = styled(BaseRRWebReplayer)`
  .rr-player {
    width: auto !important;
    height: auto !important;
  }
  .rr-player__frame {
    width: 100% !important;
    border-radius: 3px 3px 0 0;
    border: 1px solid ${p => p.theme.border};
    overflow: hidden;
  }

  .rr-player iframe {
    width: 100% !important;
    height: 100% !important;
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    left: 0;
    border: 0;
  }

  .replayer-wrapper {
    transform: scale(0.6) translate(0, 0) !important;
    transform-origin: top left;
    width: 166.66%;
    height: 166.66%;
    overflow: hidden;
    position: relative;
    box-shadow: inset 0 -1px 3px rgba(0, 0, 0, 0.08);
  }

  .replayer-mouse,
  .replayer-mouse:after {
    z-index: ${p => p.theme.zIndex.tooltip};
  }

  .rr-controller {
    width: 100%;
    display: block;
    padding: ${space(2)} 0;
    background: ${p => p.theme.background};
    border-radius: 0 0 3px 3px;
    border: 1px solid ${p => p.theme.border};
    border-top: none;
    position: relative;
    color: ${p => p.theme.textColor};
  }

  .rr-timeline {
    width: 100%;
    display: grid;
    grid-template-columns: 90px 1fr 90px;
    align-items: center;
  }

  .rr-timeline__time {
    text-align: center;
    color: ${p => p.theme.textColor};
  }

  .rr-progress {
    width: 100%;
    height: 12px;
    position: relative;
    cursor: pointer;

    &:before {
      content: '';
      background: ${p => p.theme.innerBorder};
      border-radius: 3px;
      display: block;
      height: 6px;
      position: absolute;
      left: 0;
      right: 0;
      top: 3px;
    }
  }

  .rr-progress.disabled {
    cursor: not-allowed;
  }

  .rr-progress__step {
    height: 6px;
    position: absolute;
    left: 0;
    top: 3px;
    border-radius: 3px;
    background: ${p => p.theme.purple200};
  }

  .rr-progress__handler {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    position: absolute;
    top: 6px;
    transform: translate(-50%, -50%);
    background: ${p => p.theme.purple300};
  }

  .rr-controller__btns {
    display: grid;
    grid-auto-flow: column;
    grid-auto-columns: max-content;
    grid-gap: ${space(0.75)};
    align-items: center;
    justify-content: center;
    font-size: ${p => p.theme.fontSizeSmall};
  }

  .rr-controller__btns button {
    color: ${p => p.theme.textColor};
    width: 28px;
    height: 28px;
    display: flex;
    padding: 0;
    align-items: center;
    justify-content: center;
    background: none;
    border: none;
    border-radius: 50%;
    cursor: pointer;
    transition: background 200ms ease;

    > svg {
      fill: ${p => p.theme.textColor};
    }
  }

  .rr-controller__btns button:active {
    background: ${p => p.theme.innerBorder};
  }

  .rr-controller__btns button.active {
    color: ${p => p.theme.white};
    background: ${p => p.theme.active};
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
    visibility: hidden;
  }

  .switch label {
    width: 32px;
    height: 16px;
    position: relative;
    cursor: pointer;
    display: flex;
    align-items: center;
    margin: 0;
    padding: 2px 3px;
  }

  .switch.disabled label {
    cursor: not-allowed;
  }

  .switch label:before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    border: 1px solid ${p => p.theme.border};
    border-radius: 16px;
  }

  .switch label:after {
    content: '';
    width: 10px;
    height: 10px;
    border-radius: 50%;
    transition: all 200ms ease;
    background: ${p => p.theme.border};
    z-index: 2;
  }

  .switch input[type='checkbox']:checked + label:after {
    background: ${p => p.theme.active};
    transform: translateX(16px);
  }
`;

export default RRWebReplayer;
