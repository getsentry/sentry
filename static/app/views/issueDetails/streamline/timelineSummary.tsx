import styled from '@emotion/styled';

import {Flex} from 'sentry/components/container/flex';
import {DowntimeDuration} from 'sentry/components/events/interfaces/uptime/uptimeDataSection';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Group} from 'sentry/types/group';

interface TimelineSummaryProps {
  group: Group;
  className?: string;
}

export function TimelineSummary({group, className}: TimelineSummaryProps) {
  return (
    <Flex align="center" gap={space(4)} className={className}>
      <Flex column>
        <ItemTitle>{t('Duration')}</ItemTitle>
        <ItemValue>
          <DowntimeDuration group={group} />
        </ItemValue>
      </Flex>
      {/* TODO(Leander): Add last successful check-in when the data is available */}
      {/* TODO(Leander): Add Incident ID when the data is available */}
    </Flex>
  );
}

const ItemTitle = styled('div')`
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.gray300};
  font-weight: ${p => p.theme.fontWeightBold};
`;

const ItemValue = styled('div')`
  font-size: ${p => p.theme.fontSizeLarge};
  font-weight: ${p => p.theme.fontWeightNormal};
`;
