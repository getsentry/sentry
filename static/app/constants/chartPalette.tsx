/**
 * Common constants here
 */

// palette generated via: https://gka.github.io/palettes/#colors=444674,69519A,E1567C,FB7D46,F2B712|steps=20|bez=1|coL=1
export const CHART_PALETTE = [
  ['#444674'],
  ['#444674', '#f2b712'],
  ['#444674', '#d6567f', '#f2b712'],
  ['#444674', '#a35488', '#ef7061', '#f2b712'],
  ['#444674', '#895289', '#d6567f', '#f38150', '#f2b712'],
  ['#444674', '#7a5088', '#b85586', '#e9626e', '#f58c46', '#f2b712'],
  ['#444674', '#704f87', '#a35488', '#d6567f', '#ef7061', '#f59340', '#f2b712'],
  [
    '#444674',
    '#694e86',
    '#955389',
    '#c15584',
    '#e65d73',
    '#f27a58',
    '#f6983b',
    '#f2b712',
  ],
  [
    '#444674',
    '#644d85',
    '#895289',
    '#b05587',
    '#d6567f',
    '#ec6868',
    '#f38150',
    '#f69b38',
    '#f2b712',
  ],
  [
    '#444674',
    '#614c84',
    '#815189',
    '#a35488',
    '#c65683',
    '#e35a78',
    '#ef7061',
    '#f4884b',
    '#f59f34',
    '#f2b712',
  ],
  [
    '#444674',
    '#5c4c82',
    '#7a5088',
    '#9a5389',
    '#b85586',
    '#d7567f',
    '#e9626e',
    '#f1785a',
    '#f58c46',
    '#f5a132',
    '#f2b712',
  ],
  [
    '#444674',
    '#5b4b82',
    '#764f88',
    '#925289',
    '#ae5487',
    '#c85682',
    '#e2587a',
    '#ec6b66',
    '#f37d54',
    '#f59143',
    '#f5a42f',
    '#f2b712',
  ],
  [
    '#444674',
    '#584b80',
    '#704f87',
    '#895289',
    '#a35488',
    '#bd5585',
    '#d6567f',
    '#e75f71',
    '#ef7061',
    '#f38150',
    '#f59340',
    '#f5a52d',
    '#f2b712',
  ],
  [
    '#444674',
    '#574b80',
    '#6d4e87',
    '#855189',
    '#9d5389',
    '#b35586',
    '#ca5682',
    '#e2577b',
    '#eb666a',
    '#f0765b',
    '#f4854d',
    '#f6953e',
    '#f5a62c',
    '#f2b712',
  ],
  [
    '#444674',
    '#564a7f',
    '#694e86',
    '#805089',
    '#955389',
    '#ab5487',
    '#c15584',
    '#d6567f',
    '#e65d73',
    '#ed6c65',
    '#f27a58',
    '#f5894a',
    '#f6983b',
    '#f5a72b',
    '#f2b712',
  ],
  [
    '#444674',
    '#544a7f',
    '#674d85',
    '#7a5088',
    '#8f5289',
    '#a35488',
    '#b85586',
    '#cd5681',
    '#e1567c',
    '#e9626e',
    '#ef7061',
    '#f37d54',
    '#f58c46',
    '#f69a39',
    '#f5a829',
    '#f2b712',
  ],
  [
    '#444674',
    '#524a7e',
    '#644d85',
    '#784f88',
    '#895289',
    '#9e5389',
    '#b05587',
    '#c45683',
    '#d6567f',
    '#e55b76',
    '#ec6868',
    '#f0745c',
    '#f38150',
    '#f58e44',
    '#f69b38',
    '#f4a928',
    '#f2b712',
  ],
  [
    '#444674',
    '#524a7e',
    '#624d84',
    '#744f88',
    '#865189',
    '#985389',
    '#aa5488',
    '#bc5585',
    '#cd5681',
    '#df567c',
    '#e86070',
    '#ed6c64',
    '#f17959',
    '#f4854e',
    '#f59242',
    '#f59e35',
    '#f4aa27',
    '#f2b712',
  ],
] as const;

export type ChartColorPalette = typeof CHART_PALETTE;

// eslint-disable-next-line @typescript-eslint/no-restricted-types
type GetRange<N extends number, A extends unknown[] = []> = A['length'] extends N
  ? A[number]
  : GetRange<N, [...A, A['length']]>;

type ValidLengthArgument = GetRange<ChartColorPalette['length']>;

// @TODO(jonasbadalic) I hate this, but iirc it is the only way to the type to the next index
type LengthPlusOne<T extends ValidLengthArgument> = T extends 0
  ? 1
  : T extends 1
    ? 2
    : T extends 2
      ? 3
      : T extends 3
        ? 4
        : T extends 4
          ? 5
          : T extends 5
            ? 6
            : T extends 6
              ? 7
              : T extends 7
                ? 8
                : T extends 8
                  ? 9
                  : T extends 9
                    ? 10
                    : T extends 10
                      ? 11
                      : T extends 11
                        ? 12
                        : T extends 12
                          ? 13
                          : T extends 13
                            ? 14
                            : T extends 14
                              ? 15
                              : T extends 15
                                ? 16
                                : T extends 16
                                  ? 17
                                  : T extends 17
                                    ? 18
                                    : never;
/**
 * Returns the color palette for a given number of series.
 * If length argument is statically analyzable, the return type will be narrowed
 * to the specific color palette index.
 * @TODO(jonasbadalic) Clarify why we return length+1. For a given length of 1, we should
 * return a single color, not two colors. It smells like either a bug or off by one error.
 * @param length - The number of series to return a color palette for?
 */
export function getChartColorPalette<Length extends ValidLengthArgument>(
  length: Length | number
): Exclude<ChartColorPalette[LengthPlusOne<Length>], undefined> {
  // @TODO(jonasbadalic) we guarantee type safety and sort of guarantee runtime safety by clamping and
  // the palette is not sparse, but we should probably add a runtime check here as well.
  const index = Math.max(0, Math.min(CHART_PALETTE.length - 1, length + 1));
  return CHART_PALETTE[index] as Exclude<
    ChartColorPalette[LengthPlusOne<Length>],
    undefined
  >;
}
