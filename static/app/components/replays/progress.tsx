import styled from '@emotion/styled';

/**
 * A simple progress bar.
 * ```
 * <Meter>
 *   <Value percent={0.75} />
 * </Meter>
 * ```
 *
 * Extend the components to set a background color.
 *
 * Return multiple <Value /> components to render multiple bars directly on top
 * of each other with `position:absolute;`.
 */
export const Meter = styled('div')`
  position: relative;
  height: 100%;
  width: 100%;
  pointer-events: none;
`;

export const Value = styled('span')<{
  percent: number;
}>`
  position: absolute;
  height: 100%;
  width: ${p => p.percent * 100}%;
  pointer-events: none;
`;
