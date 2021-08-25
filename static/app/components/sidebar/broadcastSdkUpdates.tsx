import styled from '@emotion/styled';
import groupBy from 'lodash/groupBy';
import partition from 'lodash/partition';

import ProjectBadge from 'app/components/idBadge/projectBadge';
import Tag from 'app/components/tag';
import {IconWarning} from 'app/icons/iconWarning';
import {t, tct, tn} from 'app/locale';
import space from 'app/styles/space';
import {Organization, Project, ProjectSdkUpdates, SDKUpdatesSuggestion} from 'app/types';
import getSdkUpdateSuggestion from 'app/utils/getSdkUpdateSuggestion';
import withOrganization from 'app/utils/withOrganization';
import withProjects from 'app/utils/withProjects';
import withSdkUpdates from 'app/utils/withSdkUpdates';

import Alert from '../alert';
import Collapsible from '../collapsible';
import List from '../list';
import ListItem from '../list/listItem';

import SidebarPanelItem from './sidebarPanelItem';

type Props = {
  projects: Project[];
  organization: Organization;
  sdkUpdates?: ProjectSdkUpdates[] | null;
};

const flattenSuggestions = (list: ProjectSdkUpdates[]) =>
  list.reduce<SDKUpdatesSuggestion[]>(
    (suggestions, sdk) => [...suggestions, ...sdk.suggestions],
    []
  );

function BroadcastSdkUpdates({projects, sdkUpdates, organization}: Props) {
  if (!sdkUpdates) {
    return null;
  }

  // Are there any updates?
  if (!flattenSuggestions(sdkUpdates).length) {
    return null;
  }

  function renderUpdates(projectSdkUpdates: ProjectSdkUpdates[]) {
    // Group SDK updates by project
    const items = Object.entries(groupBy(projectSdkUpdates, 'projectId'));

    return items
      .map(([projectId, updates]) => {
        const project = projects.find(p => p.id === projectId);

        if (!project) {
          return null;
        }

        // Updates should only be shown to users who are project members or users who have open membership or org write permission
        const hasPermissionToSeeUpdates =
          project.isMember ||
          organization.features.includes('open-membership') ||
          organization.access.includes('org:write');

        if (!hasPermissionToSeeUpdates) {
          return null;
        }

        return updates.map(({sdkName, sdkVersion, suggestions}) => {
          const isDeprecated = suggestions.some(
            suggestion => suggestion.type === 'changeSdk'
          );
          return (
            <div key={sdkName}>
              <Header>
                <SdkProjectBadge project={project} />
                {isDeprecated && <Tag type="warning">{t('Deprecated')}</Tag>}
              </Header>
              <SdkOutdatedVersion>
                {tct('This project is on [current-version]', {
                  ['current-version']: (
                    <OutdatedVersion>{`${sdkName}@v${sdkVersion}`}</OutdatedVersion>
                  ),
                })}
              </SdkOutdatedVersion>
              <StyledList>
                {suggestions.map((suggestion, i) => (
                  <ListItem key={i}>
                    {getSdkUpdateSuggestion({
                      sdk: {
                        name: sdkName,
                        version: sdkVersion,
                      },
                      suggestion,
                      shortStyle: true,
                      capitalized: true,
                    })}
                  </ListItem>
                ))}
              </StyledList>
            </div>
          );
        });
      })
      .filter(item => !!item);
  }

  const [deprecatedRavenSdkUpdates, otherSdkUpdates] = partition(
    sdkUpdates,
    sdkUpdate =>
      sdkUpdate.sdkName.includes('raven') &&
      sdkUpdate.suggestions.some(suggestion => suggestion.type === 'changeSdk')
  );

  return (
    <SidebarPanelItem
      hasSeen
      title={t('Update your SDKs')}
      message={t(
        'We recommend updating the following SDKs to make sure you’re getting all the data you need.'
      )}
    >
      {!!deprecatedRavenSdkUpdates.length && (
        <StyledAlert type="warning" icon={<IconWarning />}>
          {tct(
            `[first-sentence]. Any SDK that has the package name ‘raven’ may be missing data. Migrate to the latest SDK version.`,
            {
              ['first-sentence']: tn(
                'You have %s project using a deprecated version of the Sentry client',
                'You have %s projects using a deprecated version of the Sentry client',
                deprecatedRavenSdkUpdates.length
              ),
            }
          )}
        </StyledAlert>
      )}
      <UpdatesList>
        <Collapsible>
          {renderUpdates(deprecatedRavenSdkUpdates)}
          {renderUpdates(otherSdkUpdates)}
        </Collapsible>
      </UpdatesList>
    </SidebarPanelItem>
  );
}

export default withSdkUpdates(withProjects(withOrganization(BroadcastSdkUpdates)));

const UpdatesList = styled('div')`
  margin-top: ${space(3)};
  display: grid;
  grid-auto-flow: row;
  grid-gap: ${space(3)};
`;

const Header = styled('div')`
  display: grid;
  grid-template-columns: 1fr auto;
  grid-gap: ${space(0.5)};
  margin-bottom: ${space(0.25)};
  align-items: center;
`;

const SdkOutdatedVersion = styled('div')`
  /* 24px + 8px to be aligned with the SdkProjectBadge data */
  padding-left: calc(24px + ${space(1)});
`;

const OutdatedVersion = styled('span')`
  color: ${p => p.theme.gray400};
`;

const SdkProjectBadge = styled(ProjectBadge)`
  font-size: ${p => p.theme.fontSizeExtraLarge};
  line-height: 1;
`;

const StyledAlert = styled(Alert)`
  margin-top: ${space(2)};
`;

const StyledList = styled(List)`
  /* 24px + 8px to be aligned with the project name
  * displayed by the SdkProjectBadge component */
  padding-left: calc(24px + ${space(1)});
`;
