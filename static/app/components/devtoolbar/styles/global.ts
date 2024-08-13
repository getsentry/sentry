import {css} from '@emotion/react';

const SPACES = {
  0: '0',
  25: '2px',
  50: '4px',
  75: '6px',
  100: '8px',
  150: '12px',
  200: '16px',
  300: '20px',
  400: '30px',
} as const;

export const globalCss = css`
  :host {
    ${Object.entries(SPACES)
      .map(([size, px]) => `--space${size}: ${px};`)
      .join('\n')}

    --gray500: #2b2233;
    --gray400: #3e3446;
    --gray300: #80708f;
    --gray200: #e0dce5;
    --gray100: #f0ecf3;

    --purple400: #6559c5;
    --purple300: #6c5fc7;
    --purple200: rgba(108, 95, 199, 0.5);
    --purple100: rgba(108, 95, 199, 0.09);

    --blue400: #2562d4;
    --blue300: #3c74dd;
    --blue200: rgba(60, 116, 221, 0.5);
    --blue100: rgba(60, 116, 221, 0.09);

    --green400: #207964;
    --green300: #2ba185;
    --green200: rgba(43, 161, 133, 0.55);
    --green100: rgba(43, 161, 133, 0.11);

    --yellow400: #856c00;
    --yellow300: #ebc000;
    --yellow200: rgba(235, 192, 0, 0.7);
    --yellow100: rgba(235, 192, 0, 0.14);

    --red400: #cf2126;
    --red300: #f55459;
    --red200: rgba(245, 84, 89, 0.5);
    --red100: rgba(245, 84, 89, 0.1);

    --pink400: #d1056b;
    --pink300: #f14499;
    --pink200: rgba(249, 26, 138, 0.5);
    --pink100: rgba(249, 26, 138, 0.09);

    --surface200: #faf9fb;

    --z-index: 100000;

    color: var(--gray400);
    font-family: system-ui, 'Helvetica Neue', Arial, sans-serif;
    font-size: 16px;
    line-height: 1.4;

    *::selection {
      background: var(--blue200);
    }

    dialog {
      color: inherit;
    }
  }

  @media (prefers-reduced-motion) {
    *,
    *::before,
    *::after {
      animation-duration: 0s !important;
      transition: none !important;
      scroll-behavior: auto !important;
    }
  }

  *,
  *::before,
  *::after {
    box-sizing: border-box;
  }

  div {
    display: flex;
    flex-direction: column;
  }

  div.flex-row div {
    flex-direction: row;
  }

  .ReactQueryDevtools,
  .ReactQueryDevtools div {
    display: initial;
    flex-direction: initial;
  }
`;

export const avatarCss = css`
  .avatar {
    width: 20px;
    height: 20px;
    vertical-align: middle;
    position: relative;
    display: inline-block;
  }

  .avatar img {
    vertical-align: middle;
    max-width: 100%;
  }
`;

export const loadingIndicatorCss = css`
  .loading {
    --loader-size-big: 64px;

    margin: 6em auto;
    position: relative;

    &.overlay {
      position: absolute;
      top: 0;
      bottom: 0;
      left: 0;
      right: 0;
      background-color: rgba(255, 255, 255, 0.8);
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0;

      &.dark {
        background-color: rgba(0, 0, 0, 0.6);
      }
    }

    .loading-indicator {
      position: relative;
      border: 6px solid var(--gray100);
      border-left-color: var(--purple300);
      -webkit-animation: loading 0.5s infinite linear;
      animation: loading 0.55s infinite linear;
      margin: 0 auto;
    }

    .loading-indicator,
    .loading-indicator:after {
      border-radius: 50%;
      width: var(--loader-size-big);
      height: var(--loader-size-big);
    }

    .loading-message {
      margin-top: 20px;
      text-align: center;
    }
  }

  @-webkit-keyframes loading {
    0% {
      -webkit-transform: rotate(0deg);
      transform: rotate(0deg);
    }

    100% {
      -webkit-transform: rotate(360deg);
      transform: rotate(360deg);
    }
  }

  @keyframes loading {
    0% {
      -webkit-transform: rotate(0deg);
      transform: rotate(0deg);
    }

    100% {
      -webkit-transform: rotate(360deg);
      transform: rotate(360deg);
    }
  }

  /**
   * mini
   */

  .loading.mini {
    --loader-size-mini: 24px;

    margin: 4px 0;
    font-size: 13px;
    height: var(--loader-size-mini);

    .loading-indicator {
      margin: 0;
      border-radius: 50%;
      width: var(--loader-size-mini);
      height: var(--loader-size-mini);
      border-width: 2px;
      position: absolute;
      left: 0;
      top: 0;

      &.relative {
        position: relative;
        left: auto;
        top: auto;
      }
    }

    .loading-message {
      padding-left: 30px;
      margin-top: 1px;
      display: inline-block;
    }
  }

  /* Spinning logo icon loader */
  .loading.triangle {
    position: absolute;
    top: 50%;
    left: 50%;
    width: 500px;
    margin-top: -200px;
    margin-left: -250px;

    /* Nerf the styles of other loading indicators */
    .loading-indicator {
      height: 150px;
      width: 150px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #fff;

      animation: none;
      -webkit-animation: none;
      border: 0;
      overflow: hidden;
      border-radius: 50%;
    }
  }
`;
