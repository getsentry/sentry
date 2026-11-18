import {Fragment} from 'react';
import styled from '@emotion/styled';
import moment from 'moment-timezone';

import {Container, Flex} from '@sentry/scraps/layout';
import {Separator} from '@sentry/scraps/separator';
import {Text} from '@sentry/scraps/text';

import {getFormat} from 'sentry/utils/dates';

import type {BandBucket} from './bandShapes';

function formatBucketRange(start: number, end: number, timezone: string): string {
  const startMoment = moment.tz(start, timezone);
  const endMoment = moment.tz(end, timezone);
  const showYear = startMoment.year() !== moment().year();

  const endFormat = startMoment.isSame(endMoment, 'day')
    ? getFormat({timeOnly: true, timeZone: true})
    : getFormat({year: showYear, timeZone: true});

  return `${startMoment.format(getFormat({year: showYear}))} - ${endMoment.format(endFormat)}`;
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
