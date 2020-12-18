import React from 'react';
import styled from '@emotion/styled';

import {addLoadingMessage, clearIndicators} from 'app/actionCreators/indicator';
import {Client} from 'app/api';
import DropdownLink from 'app/components/dropdownLink';
import ActionLink from 'app/components/issueActions/actionLink';
import ResolveActions from 'app/components/issueActions/resolve';
import MenuItem from 'app/components/menuItem';
import Tooltip from 'app/components/tooltip';
import {IconEllipsis, IconIssues} from 'app/icons';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {GlobalSelection, Group, Project, Release, ResolutionStatus} from 'app/types';
import Projects from 'app/utils/projects';
import withApi from 'app/utils/withApi';

import ActionButton from '../issueActions/button';
import MenuItemActionLink from '../issueActions/menuItemActionLink';

type Props = {
  api: Client;
  orgId: string;
  group: Group;
  selection: GlobalSelection;
  query?: string;
};

class GroupRowActions extends React.Component<Props> {
  handleUpdate = (data?: any) => {
    const {api, group, orgId, query, selection} = this.props;

    addLoadingMessage(t('Saving changes\u2026'));

    api.bulkUpdate(
      {
        orgId,
        itemIds: [group.id],
        data,
        query,
        project: selection.projects,
        environment: selection.environments,
        ...selection.datetime,
      },
      {
        complete: () => {
          clearIndicators();
        },
      }
    );
  };

  handleDelete = () => {
    const {api, group, orgId, query, selection} = this.props;

    addLoadingMessage(t('Removing events\u2026'));

    api.bulkDelete(
      {
        orgId,
        itemIds: [group.id],
        query,
        project: selection.projects,
        environment: selection.environments,
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
      <Wrapper>
        <Tooltip title={group.inbox ? t('Mark Reviewed') : null}>
          <ActionLink
            type="button"
            onAction={() => this.handleUpdate({inbox: false})}
            shouldConfirm={false}
            disabled={!group.inbox}
            title={t('Mark Reviewed')}
            icon={<IconIssues size="sm" color="gray300" />}
          />
        </Tooltip>

        <StyledDropdownLink
          caret={false}
          customTitle={
            <ActionButton
              label={t('More issue actions')}
              icon={<IconEllipsis size="sm" color="gray300" />}
            />
          }
          anchorRight
        >
          <MenuItemActionLink
            className="action-resolve"
            onAction={() => this.handleUpdate({status: ResolutionStatus.RESOLVED})}
            shouldConfirm={false}
            title={t('Resolve')}
          >
            {t('Resolve')}
          </MenuItemActionLink>

          <StyledMenuItem noAnchor>
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
                    hasInbox
                    disabled={!!fetchError}
                    disableDropdown={!initiallyLoaded || !!fetchError}
                    projectFetchError={!!fetchError}
                  />
                );
              }}
            </Projects>
          </StyledMenuItem>

          <MenuItemActionLink
            className="action-delete"
            onAction={this.handleDelete}
            shouldConfirm={false}
            title={t('Delete')}
          >
            {t('Delete')}
          </MenuItemActionLink>
        </StyledDropdownLink>
      </Wrapper>
    );
  }
}

const StyledMenuItem = styled(MenuItem)`
  border-bottom: 1px solid ${p => p.theme.innerBorder};

  & .dropdown-submenu {
    & > .dropdown {
      & > .dropdown-menu-right.dropdown-toggle {
        color: ${p => p.theme.textColor};
        padding: ${space(1)};
      }
      .dropdown-menu {
        left: -150%;
      }
    }
  }
`;

const Wrapper = styled('div')`
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
`;

const StyledDropdownLink = styled(DropdownLink)`
  display: flex;
  align-items: center;
  transition: none;
`;

export default withApi(GroupRowActions);
