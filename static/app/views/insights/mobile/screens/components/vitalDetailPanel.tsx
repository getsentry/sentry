import React from 'react';
import styled from '@emotion/styled';

import ExternalLink from 'sentry/components/links/externalLink';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {PageAlert, PageAlertProvider} from 'sentry/utils/performance/contexts/pageAlert';
import {PERFORMANCE_SCORE_COLORS} from 'sentry/views/insights/browser/webVitals/utils/performanceScoreColors';
import DetailPanel from 'sentry/views/insights/common/components/detailPanel';
import useCrossPlatformProject from 'sentry/views/insights/mobile/common/queries/useCrossPlatformProject';
import {
  PerformanceScore,
  type VitalItem,
  type VitalStatus,
} from 'sentry/views/insights/mobile/screens/utils';

export function VitalDetailPanel({
  vital,
  status,
  onClose,
}: {
  onClose: () => void;
  status: VitalStatus | undefined;
  vital: VitalItem | undefined;
}) {
  const {selectedPlatform} = useCrossPlatformProject();

  const platformDocsLink = vital?.platformDocLinks[selectedPlatform];
  const sdkDocsLink = vital?.sdkDocLinks[selectedPlatform];

  return (
    <PageAlertProvider>
      <DetailPanel detailKey={vital?.field} onClose={onClose}>
        {vital && (
          <React.Fragment>
            <VitalDetailTitle>{vital.title}</VitalDetailTitle>
            {status && (
              <h2>
                {status.formattedValue ?? '-'}{' '}
                {status.score !== PerformanceScore.NONE && (
                  <Badge status={status.score}>{status.description}</Badge>
                )}
              </h2>
            )}
            <p>{vital.docs}</p>
            {vital.setup && <p>{vital.setup}</p>}
            {(platformDocsLink || sdkDocsLink) && (
              <React.Fragment>
                <SubHeading>{t('Learn more')}</SubHeading>
                <ul>
                  {sdkDocsLink && (
                    <li>
                      <ExternalLink href={sdkDocsLink}>
                        {t('Sentry SDK documentation')}
                      </ExternalLink>
                    </li>
                  )}
                  {platformDocsLink && (
                    <li>
                      <ExternalLink href={platformDocsLink}>
                        {t('Platform documentation')}
                      </ExternalLink>
                    </li>
                  )}
                </ul>
              </React.Fragment>
            )}
          </React.Fragment>
        )}
        <PageAlert />
      </DetailPanel>
    </PageAlertProvider>
  );
}

const VitalDetailTitle = styled('h4')`
  margin-bottom: ${space(1)};
  margin-top: 40px;
`;

const Badge = styled('div')<{status: string}>`
  white-space: nowrap;
  border-radius: 12px;
  color: ${p => p.theme[PERFORMANCE_SCORE_COLORS[p.status].normal]};
  background-color: ${p => p.theme[PERFORMANCE_SCORE_COLORS[p.status].light]};
  border: solid 1px ${p => p.theme[PERFORMANCE_SCORE_COLORS[p.status].light]};
  font-size: ${p => p.theme.fontSizeSmall};
  padding: 0 ${space(1)};
  display: inline-block;
  height: 17px;
  vertical-align: middle;
`;

const SubHeading = styled('div')`
  font-weight: ${p => p.theme.fontWeightBold};
  margin-bottom: ${space(1)};
`;
