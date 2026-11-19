import {Fragment} from 'react';
import styled from '@emotion/styled';

import {formatDateTime, type DateTimeOptions} from '@sentry/scraps/dateTime';
import {Container, Flex} from '@sentry/scraps/layout';
import {Separator} from '@sentry/scraps/separator';
import {Text} from '@sentry/scraps/text';

import {parseChartDateTime} from 'sentry/components/charts/formatChartDateTime';

import type {BandBucket} from './bandShapes';

function formatBucketRange(start: number, end: number, timezone: string): string {
  const startDate = parseChartDateTime(start, timezone);
  const endDate = parseChartDateTime(end, timezone);
  const now = parseChartDateTime(Date.now(), timezone);
  if (!startDate || !endDate || !now) {
    return 'Invalid date';
  }
  const showYear = startDate.year !== now.year;

  const year = showYear ? 'always' : 'never';
  const endOptions = startDate.toPlainDate().equals(endDate.toPlainDate())
    ? ({mode: 'time', showTimezone: true, timezone} satisfies DateTimeOptions)
    : ({year, showTimezone: true, timezone} satisfies DateTimeOptions);
  return `${formatDateTime(start, {year, showTimezone: false, timezone})} - ${formatDateTime(end, endOptions)}`;
}

interface ChartBandTooltipHeadingProps {
  label: React.ReactNode;
  value: React.ReactNode;
}

export function ChartBandTooltipHeading({label, value}: ChartBandTooltipHeadingProps) {
  return (
    <Flex justify="between" gap="2xl" padding="lg xl">
      <Text bold>{label}</Text>
      <Text bold tabular>
        {value}
      </Text>
    </Flex>
  );
}

interface ChartBandTooltipProps {
  bucket: BandBucket;
  sections: React.ReactElement[];
  timezone: string;
}

export function ChartBandTooltip({bucket, sections, timezone}: ChartBandTooltipProps) {
  return (
    <Fragment>
      <TooltipBody className="tooltip-series">
        {sections.map((section, index) => (
          <Fragment key={index}>
            {index > 0 && <Separator orientation="horizontal" />}
            {section}
          </Fragment>
        ))}
      </TooltipBody>
      <Container className="tooltip-footer tooltip-footer-centered">
        <Text size="xs" variant="muted">
          {formatBucketRange(bucket.start, bucket.end, timezone)}
        </Text>
      </Container>
      <div className="tooltip-arrow arrow-top" />
    </Fragment>
  );
}

const TooltipBody = styled(Container)`
  &&& {
    padding: 0;
  }
`;
