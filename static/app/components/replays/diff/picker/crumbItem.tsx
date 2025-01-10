import styled from '@emotion/styled';

import {Flex} from 'sentry/components/container/flex';
import ReplayTooltipTime from 'sentry/components/replays/replayTooltipTime';
import {Tooltip} from 'sentry/components/tooltip';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import formatDuration from 'sentry/utils/duration/formatDuration';
import getFrameDetails from 'sentry/utils/replays/getFrameDetails';
import type {BreadcrumbFrame} from 'sentry/utils/replays/types';

export default function CrumbItem({
  crumb,
  startTimestampMs,
}: {
  crumb: BreadcrumbFrame;
  startTimestampMs: number;
}) {
  const {title, icon} = getFrameDetails(crumb);

  const formattedDuration = formatDuration({
    duration: [crumb.offsetMs, 'ms'],
    precision: 'ms',
    style: 'hh:mm:ss.sss',
  });

  return (
    <CenterRelative>
      <ErrorLine />
      <ErrorLabel>
        <Tooltip
          skipWrapper
          title={
            <LeftAligned>
              {t('Detected: %s', title)}
              <div>
                <ReplayTooltipTime
                  timestampMs={crumb.timestampMs}
                  startTimestampMs={startTimestampMs}
                />
              </div>
            </LeftAligned>
          }
        >
          <Flex column gap={space(0.5)}>
            <Flex gap={space(0.75)} align="center">
              {icon}
              {formattedDuration}
            </Flex>
          </Flex>
        </Tooltip>
      </ErrorLabel>
    </CenterRelative>
  );
}

const CenterRelative = styled('div')`
  position: relative;
  justify-self: center;
`;

const ErrorLine = styled('div')`
  border: 1px solid ${p => p.theme.purple400};
  height: 100%;
`;

const ErrorLabel = styled('div')`
  color: ${p => p.theme.purple400};
  position: absolute;
  top: 0;
  transform: translate(-50%, -100%);
  padding-bottom: ${space(0.5)};
`;

const LeftAligned = styled('div')`
  text-align: left;
  display: flex;
  gap: ${space(1)};
  flex-direction: column;
`;
