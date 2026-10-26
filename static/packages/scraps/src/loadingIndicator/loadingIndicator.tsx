import type * as React from 'react';
import {keyframes} from '@emotion/react';
import styled from '@emotion/styled';
import classNames from 'classnames';

export interface LoadingIndicatorProps {
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

export function LoadingIndicator(props: LoadingIndicatorProps) {
  return (
    <Container
      className={classNames('loading', props.className, {
        mini: props.mini,
      })}
      style={props.style}
      data-test-id={props['data-test-id'] ?? 'loading-indicator'}
    >
      <div
        className={classNames('loading-indicator-container', {
          relative: props.relative,
        })}
        style={{width: props.size, height: props.size}}
      >
        <div
          className="loading-indicator"
          style={
            props.size
              ? {
                  // Reserve 0.5px on each side for the container's antialiasing inset.
                  width: props.size - 1,
                  height: props.size - 1,
                  borderWidth: getLoadingIndicatorBorderWidth(props.size),
                }
              : undefined
          }
        />
      </div>
      {props.children && <div className="loading-message">{props.children}</div>}
    </Container>
  );
}

function getLoadingIndicatorBorderWidth(size: number | undefined): number | undefined {
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

  .loading-indicator-container {
    box-sizing: border-box;
    position: relative;
    width: fit-content;
    margin: 0 auto;
    padding: 0.5px;
    overflow: hidden;
  }

  .loading-indicator {
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

  .loading-indicator,
  .loading-indicator::after {
    border-radius: 50%;
    width: 63px;
    height: 63px;
  }

  .loading-message {
    margin-top: 20px;
    text-align: center;
  }

  &.mini {
    margin: 4px 0;
    font-size: 13px;
    height: 24px;
    width: 24px;

    .loading-indicator-container {
      position: absolute;
      left: 0;
      top: 0;
      width: 24px;
      height: 24px;

      &.relative {
        position: relative;
        left: auto;
        top: auto;
      }
    }

    .loading-indicator {
      margin: 0;
      width: 23px;
      height: 23px;
      border-width: 2px;
    }

    .loading-message {
      padding-left: 30px;
      margin-top: 1px;
      display: inline-block;
    }
  }

  @media (prefers-reduced-motion) {
    .loading-indicator {
      animation-delay: -1ms !important;
      animation-duration: 0ms !important;
      animation-iteration-count: 1 !important;
    }
  }
`;
