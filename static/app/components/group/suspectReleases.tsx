import styled from '@emotion/styled';

import AsyncComponent from 'sentry/components/asyncComponent';
import Placeholder from 'sentry/components/placeholder';
import * as SidebarSection from 'sentry/components/sidebarSection';
import Version from 'sentry/components/version';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import type {Group, Release} from 'sentry/types';

import AvatarList from '../avatar/avatarList';
import TimeSince from '../timeSince';

type Props = AsyncComponent['props'] & {
  group: Group;
};

type State = AsyncComponent['state'] & {
  suspectReleases: Release[] | null;
};

class SuspectReleases extends AsyncComponent<Props, State> {
  getEndpoints(): ReturnType<AsyncComponent['getEndpoints']> {
    const {group} = this.props;
    return [['suspectReleases', `/issues/${group.id}/suspect-releases/`]];
  }

  renderLoading() {
    return (
      <SidebarSection.Wrap data-test-id="linked-issues">
        <SidebarSection.Title>{t('Linked Issues')}</SidebarSection.Title>
        <SidebarSection.Content>
          <Placeholder height="60px" />
        </SidebarSection.Content>
      </SidebarSection.Wrap>
    );
  }

  renderBody() {
    if (!this.state.suspectReleases?.length) {
      return null;
    }

    return (
      <SidebarSection.Wrap>
        <SidebarSection.Title>{t('Suspect Releases')}</SidebarSection.Title>
        <SidebarSection.Content>
          {this.state.suspectReleases?.map(release => (
            <SuspectReleaseWrapper key={release.version}>
              <div>
                <StyledVersion version={release.version} />
                {release.lastDeploy && (
                  <ReleaseDeployedDate>
                    {release.lastDeploy.environment
                      ? t('Deployed to %s ', release.lastDeploy.environment)
                      : t('Deployed ')}
                    <TimeSince date={release.lastDeploy.dateFinished} />
                  </ReleaseDeployedDate>
                )}
              </div>
              <AvatarList
                users={release.authors}
                avatarSize={25}
                tooltipOptions={{container: 'body'} as any}
                typeMembers="authors"
              />
            </SuspectReleaseWrapper>
          ))}
        </SidebarSection.Content>
      </SidebarSection.Wrap>
    );
  }
}

const SuspectReleaseWrapper = styled('div')`
  display: flex;
  gap: ${space(1)};
  justify-content: space-between;
  align-items: center;
  line-height: 1.2;
  margin: ${space(1.5)} 0;
`;

const StyledVersion = styled(Version)`
  margin-bottom: ${space(0.75)};
`;

const ReleaseDeployedDate = styled('div')`
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.subText};
`;

export default SuspectReleases;
