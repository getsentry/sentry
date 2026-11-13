import {Container} from '@sentry/scraps/layout';

import {ChartLegend} from './chartLegend';

describe('ChartLegend', () => {
  it.snapshot.each([false, true])('transformed-long-label-%s', longLabel => (
    <Container padding="md" width="720px" background="primary">
      <ChartLegend
        items={[
          {name: 'original', label: 'avg(span.duration)', color: '#7553ff'},
          {
            name: 'transformed',
            label: longLabel
              ? 'Average duration for database operations grouped by transaction'
              : 'avg(span.duration)',
            suffix: 'fill(linear) → smooth(sma,5)',
            color: '#069fba',
          },
        ]}
        selected={{}}
        onSelectionChange={() => {}}
      />
    </Container>
  ));
});
