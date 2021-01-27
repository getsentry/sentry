import React from 'react';
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
  sdkUpdates?: ProjectSdkUpdates[];
  loadingSdkUpdates: boolean;
};

const flattenSuggestions = (list: ProjectSdkUpdates[]) =>
  list.reduce<SDKUpdatesSuggestion[]>(
    (suggestions, sdk) => [...suggestions, ...sdk.suggestions],
    []
  );

const BroadcastSdkUpdates = ({projects, sdkUpdates, loadingSdkUpdates}: Props) => {
  if (sdkUpdates === undefined || loadingSdkUpdates) {
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
        'There are %s SDK update suggestions for your projects. You may be missing out on data.',
        sdkUpdates.length
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
  grid-gap: ${space(2)};
`;

const Suggestions = styled('div')`
  margin-top: ${space(1)};
  margin-left: calc(${space(4)} + ${space(0.25)});
  display: grid;
  grid-auto-flow: row;
  grid-gap: ${space(1.5)};
`;

const SdkProjectBadge = styled(ProjectBadge)`
  font-size: ${p => p.theme.fontSizeLarge};
`;

const SdkName = styled('div')`
  margin-bottom: ${space(0.5)};
  font-family: ${p => p.theme.text.familyMono};
  font-size: ${p => p.theme.fontSizeSmall};
  font-weight: bold;
`;

const SdkOutdatedVersion = styled('span')`
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSizeExtraSmall};
`;

export default withSdkUpdates(withProjects(BroadcastSdkUpdates));
