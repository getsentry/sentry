import {Fragment} from 'react';

import {Grid} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import type {AggregateSummary} from 'sentry/views/detectors/datasetConfig/base';

/**
 * Explains what each reference label (A, B, …) of a compact expression refers to.
 */
export function AggregateSummaryTable({summary}: {summary: AggregateSummary}) {
  return (
    <Grid columns={`auto repeat(${summary.headers.length}, auto)`} gap="xs md">
      <div />
      {summary.headers.map(header => (
        <Text key={header} size="sm" bold align="left" textWrap="nowrap">
          {header}
        </Text>
      ))}
      {summary.components.map(component => (
        <Fragment key={component.label}>
          <Text size="sm" bold align="left">
            {component.label}
          </Text>
          {component.values.map((value, index) => (
            <Text
              key={summary.headers[index]}
              size="sm"
              align="left"
              wordBreak="break-all"
            >
              {value || '—'}
            </Text>
          ))}
        </Fragment>
      ))}
    </Grid>
  );
}
