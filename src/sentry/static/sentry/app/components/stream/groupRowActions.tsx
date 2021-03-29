import React from 'react';
import styled from '@emotion/styled';

import {bulkDelete, bulkUpdate} from 'app/actionCreators/group';
import {addLoadingMessage, clearIndicators} from 'app/actionCreators/indicator';
import {Client} from 'app/api';
import ResolveActions from 'app/components/actions/resolve';
import DropdownLink from 'app/components/dropdownLink';
import MenuItem from 'app/components/menuItem';
import {IconEllipsis, IconIssues} from 'app/icons';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {GlobalSelection, Group, Project, Release, ResolutionStatus} from 'app/types';
import Projects from 'app/utils/projects';
import withApi from 'app/utils/withApi';

import ActionButton from '../actions/button';
import MenuItemActionLink from '../actions/menuItemActionLink';

type Props = {
  api: Client;
  orgSlug: string;
  group: Group;
  selection: GlobalSelection;
  query?: string;
  onMarkReviewed?: (itemIds: string[]) => void;
  onDelete?: () => void;
};

class GroupRowActions extends React.Component<Props> {
  handleUpdate = (data?: any, event?: React.MouseEvent) => {
    event?.stopPropagation();
    const {api, group, orgSlug, query, selection, onMarkReviewed} = this.props;

    addLoadingMessage(t('Saving changes\u2026'));

    if (data.inbox === false) {
      onMarkReviewed?.([group.id]);
    }

    bulkUpdate(
      api,
      {
        orgId: orgSlug,
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
    const {api, group, orgSlug, query, selection, onDelete} = this.props;

    addLoadingMessage(t('Removing events\u2026'));

    bulkDelete(
      api,
      {
        orgId: orgSlug,
        itemIds: [group.id],
        query,
        project: selection.projects,
        environment: selection.environments,
        ...selection.datetime,
      },
      {
        complete: () => {
          clearIndicators();
          onDelete?.();
        },
      }
    );
  };

  render() {
    const {orgSlug, group} = this.props;

    return (
      <Wrapper>
        <ActionButton
          type="button"
          disabled={!group.inbox}
          title={t('Mark Reviewed')}
          tooltipProps={{disabled: !group.inbox}}
          icon={<IconIssues size="sm" />}
          onClick={event => this.handleUpdate({inbox: false}, event)}
        />

        <StyledDropdownLink
          caret={false}
          customTitle={
            <ActionButton
              label={t('More issue actions')}
              icon={<IconEllipsis size="sm" />}
            />
          }
          anchorRight
        >
          <MenuItemActionLink
            onAction={() => this.handleUpdate({status: ResolutionStatus.RESOLVED})}
            shouldConfirm={false}
            title={t('Resolve')}
          >
            {t('Resolve')}
          </MenuItemActionLink>

          <StyledMenuItem noAnchor>
            <Projects orgId={orgSlug} slugs={[group.project.slug]}>
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
                    orgSlug={orgSlug}
                    projectSlug={group.project.slug}
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
