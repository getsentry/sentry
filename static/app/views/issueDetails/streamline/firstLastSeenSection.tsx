import styled from '@emotion/styled';

import TimeSince from 'sentry/components/timeSince';
import Version from 'sentry/components/version';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Group} from 'sentry/types/group';
import type {Release} from 'sentry/types/release';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

export interface GroupRelease {
  firstRelease: Release;
  lastRelease: Release;
}

export default function FirstLastSeenSection({group}: {group: Group}) {
  const organization = useOrganization();

  const {data: groupReleaseData} = useApiQuery<GroupRelease>(
    [`/organizations/${organization.slug}/issues/${group.id}/first-last-release/`],
    {
      staleTime: 30000,
      gcTime: 30000,
    }
  );

  return (
    <FirstLastSeen>
      <div>
        <Title>
          {tct('Last seen [timeSince]', {
            timeSince: group.lastSeen ? (
              <StyledTimeSince date={group.lastSeen} />
            ) : (
              <NoTimeSince>{t('N/A')}</NoTimeSince>
            ),
          })}
        </Title>
        {groupReleaseData?.firstRelease && (
          <SubtitleWrapper>
            {tct('in release [release]', {
              release: (
                <ReleaseWrapper>
                  <Version
                    version={groupReleaseData.firstRelease.version}
                    projectId={group.project.id}
                    tooltipRawVersion
                  />
                </ReleaseWrapper>
              ),
            })}
          </SubtitleWrapper>
        )}
      </div>
      <div>
        <Title>
          {tct('First seen [timeSince]', {
            timeSince: group.firstSeen ? (
              <StyledTimeSince date={group.firstSeen} />
            ) : (
              <NoTimeSince>{t('N/A')}</NoTimeSince>
            ),
          })}
        </Title>
        {groupReleaseData?.lastRelease && (
          <SubtitleWrapper>
            {tct('in release [release]', {
              release: (
                <ReleaseWrapper>
                  <Version
                    version={groupReleaseData.lastRelease.version}
                    projectId={group.project.id}
                    tooltipRawVersion
                  />
                </ReleaseWrapper>
              ),
            })}
          </SubtitleWrapper>
        )}
      </div>
    </FirstLastSeen>
  );
}

const ReleaseWrapper = styled('span')`
  a {
    color: ${p => p.theme.gray300};
    text-decoration: underline;
    text-decoration-style: dotted;
  }
`;
const Title = styled('div')`
  font-weight: ${p => p.theme.fontWeightBold};
`;

const SubtitleWrapper = styled('div')`
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.subText};
`;

const FirstLastSeen = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(0.75)};
`;

const StyledTimeSince = styled(TimeSince)`
  font-weight: normal;
`;

const NoTimeSince = styled('span')`
  font-weight: normal;
`;
