import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Flex} from 'sentry/components/container/flex';
import {DowntimeDuration} from 'sentry/components/events/interfaces/uptime/uptimeDataSection';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Group} from 'sentry/types/group';
import {getConfigForIssueType} from 'sentry/utils/issueTypeConfig';

interface OccurrenceSummaryProps {
  group: Group;
  className?: string;
}

/**
 * This component summarizes the occurance of an issue when the event unit we display below is NOT
 * the occurence. For example, we display 'check-ins' in uptime issues, but the occrurence is a
 * status change from success to failure.
 */
export function OccurrenceSummary({group, className}: OccurrenceSummaryProps) {
  const issueTypeConfig = getConfigForIssueType(group, group.project);

  if (!issueTypeConfig.header.occurrenceSummary.enabled) {
    return null;
  }

  const items: React.ReactNode[] = [];

  if (issueTypeConfig.header.occurrenceSummary.duration) {
    items.push(
      <Flex column>
        <ItemTitle>{t('Duration')}</ItemTitle>
        <ItemValue>
          <DowntimeDuration group={group} />
        </ItemValue>
      </Flex>
    );
  }
  // TODO(Leander): Add last successful check-in when the data is available
  // TODO(Leander): Add Incident ID when the data is available

  return items.length > 0 ? (
    <Flex align="center" gap={space(4)} className={className}>
      {items.map((item, i) => (
        <Fragment key={i}>{item}</Fragment>
      ))}
    </Flex>
  ) : null;
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
