import styled from '@emotion/styled';

import AsyncComponent from 'sentry/components/asyncComponent';
import Placeholder from 'sentry/components/placeholder';
import Version from 'sentry/components/version';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import type {Group, Release} from 'sentry/types';

import AvatarList from '../avatar/avatarList';
import TimeSince from '../timeSince';

import SidebarSection from './sidebarSection';

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
      <SidebarSection data-test-id="linked-issues" title={t('Linked Issues')}>
        <Placeholder height="60px" />
      </SidebarSection>
    );
  }

  renderBody() {
    if (!this.state.suspectReleases) {
      return null;
    }

    return (
      <SidebarSection secondary title={t('Suspect Releases')}>
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
      </SidebarSection>
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
