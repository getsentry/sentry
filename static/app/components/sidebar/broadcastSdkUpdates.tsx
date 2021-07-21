import styled from '@emotion/styled';
import groupBy from 'lodash/groupBy';

import ProjectBadge from 'app/components/idBadge/projectBadge';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {Project, ProjectSdkUpdates, SDKUpdatesSuggestion} from 'app/types';
import getSdkUpdateSuggestion from 'app/utils/getSdkUpdateSuggestion';
import withProjects from 'app/utils/withProjects';
import withSdkUpdates from 'app/utils/withSdkUpdates';

import Collapsible from '../collapsible';
import List from '../list';
import ListItem from '../list/listItem';

import SidebarPanelItem from './sidebarPanelItem';

type Props = {
  projects: Project[];
  sdkUpdates?: ProjectSdkUpdates[] | null;
};

const flattenSuggestions = (list: ProjectSdkUpdates[]) =>
  list.reduce<SDKUpdatesSuggestion[]>(
    (suggestions, sdk) => [...suggestions, ...sdk.suggestions],
    []
  );

const BroadcastSdkUpdates = ({projects, sdkUpdates}: Props) => {
  if (!sdkUpdates) {
    return null;
  }

  // Are there any updates?
  if (flattenSuggestions(sdkUpdates).length === 0) {
    return null;
  }

  // Group SDK updates by project
  const items = Object.entries(groupBy(sdkUpdates, 'projectId'));

  return (
    <SidebarPanelItem
      hasSeen
      title={t('Update your SDKs')}
      message={t(
        'We recommend updating the following SDKs to make sure you’re getting all the data you need.'
      )}
    >
      <UpdatesList>
        <Collapsible>
          {items.map(([projectId, updates]) => {
            const project = projects.find(p => p.id === projectId);
            if (project === undefined) {
              return null;
            }

            return (
              <div key={project.id}>
                <SdkProjectBadge project={project} />
                <Suggestions>
                  {updates.map(sdkUpdate => (
                    <div key={sdkUpdate.sdkName}>
                      <SdkName>
                        {sdkUpdate.sdkName}{' '}
                        <SdkOutdatedVersion>@v{sdkUpdate.sdkVersion}</SdkOutdatedVersion>
                      </SdkName>
                      <List>
                        {sdkUpdate.suggestions.map((suggestion, i) => (
                          <ListItem key={i}>
                            {getSdkUpdateSuggestion({
                              sdk: {
                                name: sdkUpdate.sdkName,
                                version: sdkUpdate.sdkVersion,
                              },
                              suggestion,
                              shortStyle: true,
                              capitalized: true,
                            })}
                          </ListItem>
                        ))}
                      </List>
                    </div>
                  ))}
                </Suggestions>
              </div>
            );
          })}
        </Collapsible>
      </UpdatesList>
    </SidebarPanelItem>
  );
};

const UpdatesList = styled('div')`
  margin-top: ${space(3)};
  display: grid;
  grid-auto-flow: row;
  grid-gap: ${space(3)};
`;

const Suggestions = styled('div')`
  margin-left: calc(${space(4)} + ${space(0.25)});
  display: grid;
  grid-auto-flow: row;
  grid-gap: ${space(0.5)};
`;

const SdkProjectBadge = styled(ProjectBadge)`
  font-size: ${p => p.theme.fontSizeLarge};
`;

const SdkName = styled('div')`
  font-family: ${p => p.theme.text.familyMono};
  font-weight: bold;
`;

const SdkOutdatedVersion = styled('span')`
  color: ${p => p.theme.subText};
`;

export default withSdkUpdates(withProjects(BroadcastSdkUpdates));
