import React from 'react';
import styled from '@emotion/styled';

import space from 'app/styles/space';
import {t} from 'app/locale';
import {IconIssues} from 'app/icons';
import Tooltip from 'app/components/tooltip';
import ActionLink from 'app/components/actions/actionLink';
import {addLoadingMessage, clearIndicators} from 'app/actionCreators/indicator';
import {Client} from 'app/api';
import {GlobalSelection, Group, Project, Release} from 'app/types';
import withApi from 'app/utils/withApi';
import IgnoreActions from 'app/components/actions/ignore';
import ResolveActions from 'app/components/actions/resolve';
import Projects from 'app/utils/projects';

type Props = {
  api: Client;
  orgId: string;
  group: Group;
  selection: GlobalSelection;
  query?: string;
};

type State = {
  showHoverActions: boolean;
};

class GroupHoverActions extends React.Component<Props, State> {
  state: State = {
    showHoverActions: false,
  };

  onMouseEnter = () => {
    this.setState({showHoverActions: true});
  };

  onMouseLeave = () => {
    this.setState({showHoverActions: false});
  };

  handleUpdate = (data?: any) => {
    const {api, group, orgId, query, selection} = this.props;

    addLoadingMessage(t('Saving changes\u2026'));

    const projectConstraints = {project: selection.projects};

    api.bulkUpdate(
      {
        orgId,
        itemIds: [group.id],
        data,
        query,
        environment: selection.environments,
        ...projectConstraints,
        ...selection.datetime,
      },
      {
        complete: () => {
          clearIndicators();
        },
      }
    );
  };

  render() {
    const {orgId, group} = this.props;

    return (
      <Wrapper onMouseEnter={this.onMouseEnter} onMouseLeave={this.onMouseLeave}>
        {this.state.showHoverActions && (
          <HoverActionsWrapper>
            <ActionWrapper>
              <Tooltip title={t('Move to Backlog')}>
                <ActionLink
                  className="btn btn-default btn-sm"
                  onAction={() => this.handleUpdate({inbox: false})}
                  shouldConfirm={false}
                  title={t('Move to backlog')}
                >
                  <IconIssues size="xs" color="gray200" />
                </ActionLink>
              </Tooltip>
            </ActionWrapper>

            <ActionWrapper>
              <Tooltip title={t('Ignore')}>
                <IgnoreActions
                  onUpdate={this.handleUpdate}
                  shouldConfirm={false}
                  inboxHoverAction
                />
              </Tooltip>
            </ActionWrapper>

            <ActionWrapper>
              <Tooltip title={t('Resolve')}>
                <Projects orgId={orgId} slugs={[group.project.slug]}>
                  {({projects, initiallyLoaded, fetchError}) => {
                    const project = projects[0];
                    return (
                      <ResolveActions
                        hasRelease={
                          project.hasOwnProperty('features')
                            ? (project as Project).features.includes('releases')
                            : false
                        }
                        latestRelease={
                          project.hasOwnProperty('latestRelease')
                            ? ((project as Project).latestRelease as Release)
                            : undefined
                        }
                        orgId={orgId}
                        projectId={group.project.id}
                        onUpdate={this.handleUpdate}
                        shouldConfirm={false}
                        inboxHoverAction
                        disabled={!!fetchError}
                        disableDropdown={!initiallyLoaded || !!fetchError}
                        projectFetchError={!!fetchError}
                      />
                    );
                  }}
                </Projects>
              </Tooltip>
            </ActionWrapper>
          </HoverActionsWrapper>
        )}
      </Wrapper>
    );
  }
}

const Wrapper = styled('div')`
  position: absolute;
  background: transparent;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: flex-end;
`;

const HoverActionsWrapper = styled('div')`
  background: linear-gradient(270deg, ${p => p.theme.background}DF 75%, transparent 100%);
  width: 200px;
  height: 100%;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: flex-end;
`;

const ActionWrapper = styled('div')`
  margin-right: ${space(2)};
  display: flex;
  align-items: center;
  justify-content: center;
`;

export default withApi(GroupHoverActions);
