import type {CSSProperties} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

type Props = {
  children: React.ReactNode;
  className?: string;
  ['data-test-id']?: string;
  /**
   * Change which side of the text is elided.
   * Default: 'right'
   *
   * BROWSER COMPAT:
   * When set to `left` the intention is for something like: `...xample.com/foo/`
   * In Chrome & Firefox this is what happens.
   *
   * In Safari (July 2022) you will see this instead: `...https://example.co`.
   *
   * See: https://stackoverflow.com/a/24800788
   *
   * @default 'right'
   */
  ellipsisDirection?: 'left' | 'right';
  style?: CSSProperties;
};

export const TextOverflow = styled(
  ({
    children,
    className,
    ellipsisDirection = 'right',
    'data-test-id': dataTestId,
    style,
  }: Props) => {
    if (ellipsisDirection === 'left') {
      return (
        <div className={className} style={style} data-test-id={dataTestId}>
          <bdi>{children}</bdi>
        </div>
      );
    }
    return (
      <div className={className} style={style} data-test-id={dataTestId}>
        {children}
      </div>
    );
  }
)`
  display: block;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  ${p =>
    p.ellipsisDirection === 'left' &&
    css`
      direction: rtl;
      text-align: left;
    `}
  width: auto;
  line-height: 1.2;
`;
