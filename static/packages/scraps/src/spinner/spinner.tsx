import type * as React from 'react';
import {keyframes} from '@emotion/react';
import styled from '@emotion/styled';
import classNames from 'classnames';

export interface SpinnerProps {
  children?: NonNullable<React.ReactNode>;
  className?: string;
  ['data-test-id']?: string;
  /**
   * @deprecated Use `size` instead.
   */
  mini?: boolean;
  relative?: boolean;
  size?: number;
  style?: React.CSSProperties;
}

export function Spinner(props: SpinnerProps) {
  return (
    <Container
      className={classNames('scraps-spinner', props.className, {
        'scraps-spinner-mini': props.mini,
      })}
      style={props.style}
      data-test-id={props['data-test-id'] ?? 'loading-indicator'}
    >
      <div
        className={classNames('scraps-spinner-container', {
          'scraps-spinner-relative': props.relative,
        })}
        style={{width: props.size, height: props.size}}
      >
        <div
          className="scraps-spinner-ring"
          style={
            props.size
              ? {
                  // Reserve 0.5px on each side for the container's antialiasing inset.
                  width: props.size - 1,
                  height: props.size - 1,
                  borderWidth: getSpinnerBorderWidth(props.size),
                }
              : undefined
          }
        />
      </div>
      {props.children && <div className="scraps-spinner-message">{props.children}</div>}
    </Container>
  );
}

function getSpinnerBorderWidth(size: number | undefined): number | undefined {
  if (!size) {
    return undefined;
  }
  if (size > 64) {
    return 6;
  }

  return 2 + ((size - 24) / 40) * (6 - 2);
}

const loading = keyframes`
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
`;

const Container = styled('div')`
  margin: 6em auto;
  position: relative;

  .scraps-spinner-container {
    box-sizing: border-box;
    position: relative;
    width: fit-content;
    margin: 0 auto;
    padding: 0.5px;
    overflow: hidden;
  }

  .scraps-spinner-ring {
    box-sizing: border-box;
    position: relative;
    background: transparent;
    /* oxlint-disable-next-line @sentry/scraps/use-semantic-token -- Preserve the existing light-theme loader colors. */
    border: 6px solid
      ${p => (p.theme.type === 'dark' ? p.theme.tokens.border.transparent.neutral.muted : '#e6e9ec')};
    /* oxlint-disable-next-line @sentry/scraps/use-semantic-token -- Preserve the existing light-theme loader colors. */
    border-left-color: ${p => (p.theme.type === 'dark' ? p.theme.tokens.border.accent.vibrant : '#6c5fc7')};
    animation: ${loading} 0.55s infinite linear;
    margin: 0 auto;
  }

  .scraps-spinner-ring,
  .scraps-spinner-ring::after {
    border-radius: 50%;
    width: 63px;
    height: 63px;
  }

  .scraps-spinner-message {
    margin-top: 20px;
    text-align: center;
  }

  &.scraps-spinner-mini {
    margin: 4px 0;
    font-size: 13px;
    height: 24px;
    width: 24px;

    .scraps-spinner-container {
      position: absolute;
      left: 0;
      top: 0;
      width: 24px;
      height: 24px;

      &.scraps-spinner-relative {
        position: relative;
        left: auto;
        top: auto;
      }
    }

    .scraps-spinner-ring {
      margin: 0;
      width: 23px;
      height: 23px;
      border-width: 2px;
    }

    .scraps-spinner-message {
      padding-left: 30px;
      margin-top: 1px;
      display: inline-block;
    }
  }

  @media (prefers-reduced-motion) {
    .scraps-spinner-ring {
      animation-delay: -1ms !important;
      animation-duration: 0ms !important;
      animation-iteration-count: 1 !important;
    }
  }
`;
