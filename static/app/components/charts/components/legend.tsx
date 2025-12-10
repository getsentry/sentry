import 'echarts/lib/component/legend';
import 'echarts/lib/component/legendScroll';

import type {Theme} from '@emotion/react';
import type {LegendComponentOption} from 'echarts';
import merge from 'lodash/merge';

import type BaseChart from 'sentry/components/charts/baseChart';
import {truncationFormatter} from 'sentry/components/charts/utils';

type ChartProps = React.ComponentProps<typeof BaseChart>;

export default function Legend(
  props: ChartProps['legend'] & {theme: Theme}
): LegendComponentOption {
  const {truncate, theme, ...rest} = props ?? {};
  const formatter = (value: string) =>
    truncationFormatter(
      value,
      truncate ?? 0,
      // Escaping the legend string will cause some special
      // characters to render as their HTML equivalents.
      // So disable it here.
      false
    );

  return merge(
    {
      show: true,
      type: 'scroll' as const,
      padding: 0,
      formatter,
      icon: 'path://M11 0C12.6569 1.28851e-07 14 1.34315 14 3V11C14 12.6569 12.6569 14 11 14H3C1.34315 14 1.61067e-08 12.6569 0 11V3C1.28853e-07 1.34315 1.34315 1.61064e-08 3 0H11ZM11.1699 3.72559C10.8255 3.4246 10.3181 3.42474 9.97363 3.72559L9.90234 3.79492L5.85645 8.15137L4.09766 6.25684L4.02637 6.1875C3.68183 5.88652 3.1745 5.88631 2.83008 6.1875L2.75879 6.25684C2.41366 6.62886 2.41342 7.21781 2.75879 7.58984L5.1875 10.2051H5.18848C5.55339 10.5974 6.16103 10.5984 6.52637 10.2051L11.2412 5.12793C11.5651 4.77888 11.5847 4.23951 11.3018 3.86719L11.2412 3.79492L11.1699 3.72559Z',
      itemHeight: 14,
      itemWidth: 14,
      itemGap: 12,
      align: 'left' as const,
      textStyle: {
        color: theme.tokens.content.primary,
        verticalAlign: 'top',
        fontSize: 11,
        fontFamily: theme.text.family,
        lineHeight: 14,
      },
      inactiveColor: theme.subText,
      pageTextStyle: {
        color: theme.tokens.content.primary,
      },
      pageIconColor: theme.tokens.content.primary,
      pageIconInactiveColor: theme.disabled,
      pageIconSize: 8.75,
      pageIcons: {
        horizontal: [
          'path://M4.375 7.00027C4.375 6.81977 4.44973 6.64743 4.58093 6.52346L8.51843 2.80473C8.78194 2.55588 9.19669 2.56769 9.44554 2.83124C9.69421 3.0947 9.68249 3.50954 9.41902 3.7583L5.98572 7.00027L9.41903 10.2422C9.6824 10.4911 9.69439 10.9059 9.44554 11.1693C9.19678 11.4327 8.78194 11.4445 8.51843 11.1958L4.58093 7.47708C4.44973 7.35316 4.37507 7.18072 4.375 7.00027Z',
          'path://M9.625 6.99973C9.625 7.18023 9.55027 7.35257 9.41907 7.47654L5.48157 11.1953C5.21806 11.4441 4.80331 11.4323 4.55446 11.1688C4.30579 10.9053 4.31751 10.4905 4.58098 10.2417L8.01428 6.99973L4.58098 3.75779C4.3176 3.50892 4.30561 3.0941 4.55446 2.83067C4.80323 2.56734 5.21806 2.55552 5.48157 2.80417L9.41907 6.52292C9.55027 6.64684 9.62493 6.81928 9.625 6.99973Z',
        ],
      },
    } satisfies LegendComponentOption,
    rest
  );
}
