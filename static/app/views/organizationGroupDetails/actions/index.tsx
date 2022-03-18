import {Component, Fragment, MouseEvent} from 'react';
import {browserHistory} from 'react-router';
import styled from '@emotion/styled';

import {bulkDelete, bulkUpdate} from 'sentry/actionCreators/group';
import {
  addErrorMessage,
  addLoadingMessage,
  clearIndicators,
} from 'sentry/actionCreators/indicator';
import {
  ModalRenderProps,
  openModal,
  openReprocessEventModal,
} from 'sentry/actionCreators/modal';
import GroupActions from 'sentry/actions/groupActions';
import {Client} from 'sentry/api';
import Access from 'sentry/components/acl/access';
import Feature from 'sentry/components/acl/feature';
import FeatureDisabled from 'sentry/components/acl/featureDisabled';
import ActionButton from 'sentry/components/actions/button';
import IgnoreActions from 'sentry/components/actions/ignore';
import ResolveActions from 'sentry/components/actions/resolve';
import GuideAnchor from 'sentry/components/assistant/guideAnchor';
import Button from 'sentry/components/button';
import DropdownMenuControlV2 from 'sentry/components/dropdownMenuControlV2';
import Tooltip from 'sentry/components/tooltip';
import {IconEllipsis} from 'sentry/icons';
import {IconRefresh} from 'sentry/icons/iconRefresh';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {
  Group,
  Organization,
  Project,
  SavedQueryVersions,
  UpdateResolutionStatus,
} from 'sentry/types';
import {Event} from 'sentry/types/event';
import {analytics} from 'sentry/utils/analytics';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import EventView from 'sentry/utils/discover/eventView';
import {displayReprocessEventAction} from 'sentry/utils/displayReprocessEventAction';
import {uniqueId} from 'sentry/utils/guid';
import withApi from 'sentry/utils/withApi';
import withOrganization from 'sentry/utils/withOrganization';
import ReviewAction from 'sentry/views/issueList/actions/reviewAction';
import ShareIssue from 'sentry/views/organizationGroupDetails/actions/shareIssue';

import SubscribeAction from './subscribeAction';

type Props = {
  api: Client;
  disabled: boolean;
  group: Group;
  organization: Organization;
  project: Project;
  event?: Event;
};

type State = {
  shareBusy: boolean;
};

class Actions extends Component<Props, State> {
  state: State = {
    shareBusy: false,
  };

  componentWillReceiveProps(nextProps: Props) {
    if (this.state.shareBusy && nextProps.group.shareId !== this.props.group.shareId) {
      this.setState({shareBusy: false});
    }
  }

  getShareUrl(shareId: string) {
    if (!shareId) {
      return '';
    }

    const path = `/share/issue/${shareId}/`;
    const {host, protocol} = window.location;
    return `${protocol}//${host}${path}`;
  }

  getDiscoverUrl() {
    const {group, project, organization} = this.props;
    const {title, id, type} = group;

    const discoverQuery = {
      id: undefined,
      name: title || type,
      fields: ['title', 'release', 'environment', 'user.display', 'timestamp'],
      orderby: '-timestamp',
      query: `issue.id:${id}`,
      projects: [Number(project.id)],
      version: 2 as SavedQueryVersions,
      range: '90d',
    };

    const discoverView = EventView.fromSavedQuery(discoverQuery);
    return discoverView.getResultsViewUrlTarget(organization.slug);
  }

  onDelete = () => {
    const {group, project, organization, api} = this.props;

    addLoadingMessage(t('Delete event\u2026'));

    bulkDelete(
      api,
      {
        orgId: organization.slug,
        projectId: project.slug,
        itemIds: [group.id],
      },
      {
        complete: () => {
          clearIndicators();

          browserHistory.push(`/${organization.slug}/${project.slug}/`);
        },
      }
    );
  };

  onUpdate = (
    data:
      | {isBookmarked: boolean}
      | {isSubscribed: boolean}
      | {inbox: boolean}
      | UpdateResolutionStatus
  ) => {
    const {group, project, organization, api} = this.props;

    addLoadingMessage(t('Saving changes\u2026'));

    bulkUpdate(
      api,
      {
        orgId: organization.slug,
        projectId: project.slug,
        itemIds: [group.id],
        data,
      },
      {
        complete: clearIndicators,
      }
    );
  };

  onReprocessEvent = () => {
    const {group, organization} = this.props;
    openReprocessEventModal({organization, groupId: group.id});
  };

  onShare(shared: boolean) {
    const {group, project, organization, api} = this.props;
    this.setState({shareBusy: true});

    // not sure why this is a bulkUpdate
    bulkUpdate(
      api,
      {
        orgId: organization.slug,
        projectId: project.slug,
        itemIds: [group.id],
        data: {
          isPublic: shared,
        },
      },
      {
        error: () => {
          addErrorMessage(t('Error sharing'));
        },
        complete: () => {
          // shareBusy marked false in componentWillReceiveProps to sync
          // busy state update with shareId update
        },
      }
    );
  }

  onToggleShare = () => {
    const newIsPublic = !this.props.group.isPublic;
    if (newIsPublic) {
      trackAdvancedAnalyticsEvent('issue.shared_publicly', {
        organization: this.props.organization,
      });
    }
    this.onShare(newIsPublic);
  };

  onToggleBookmark = () => {
    this.onUpdate({isBookmarked: !this.props.group.isBookmarked});
  };

  onToggleSubscribe = () => {
    this.onUpdate({isSubscribed: !this.props.group.isSubscribed});
  };

  onRedirectDiscover = () => {
    const {organization} = this.props;
    trackAdvancedAnalyticsEvent('growth.issue_open_in_discover_btn_clicked', {
      organization,
    });
    browserHistory.push(this.getDiscoverUrl());
  };

  onDiscard = () => {
    const {group, project, organization, api} = this.props;
    const id = uniqueId();
    addLoadingMessage(t('Discarding event\u2026'));

    GroupActions.discard(id, group.id);

    api.request(`/issues/${group.id}/`, {
      method: 'PUT',
      data: {discard: true},
      success: response => {
        GroupActions.discardSuccess(id, group.id, response);
        browserHistory.push(`/${organization.slug}/${project.slug}/`);
      },
      error: error => {
        GroupActions.discardError(id, group.id, error);
      },
      complete: clearIndicators,
    });
  };

  renderDiscardModal = ({Body, Footer, closeModal}: ModalRenderProps) => {
    const {organization, project} = this.props;

    function renderDiscardDisabled({children, ...props}) {
      return children({
        ...props,
        renderDisabled: ({features}: {features: string[]}) => (
          <FeatureDisabled alert featureName="Discard and Delete" features={features} />
        ),
      });
    }

    return (
      <Feature
        features={['projects:discard-groups']}
        hookName="feature-disabled:discard-groups"
        organization={organization}
        project={project}
        renderDisabled={renderDiscardDisabled}
      >
        {({hasFeature, renderDisabled, ...props}) => (
          <Fragment>
            <Body>
              {!hasFeature &&
                typeof renderDisabled === 'function' &&
                renderDisabled({...props, hasFeature, children: null})}
              {t(
                `Discarding this event will result in the deletion of most data associated with this issue and future events being discarded before reaching your stream. Are you sure you wish to continue?`
              )}
            </Body>
            <Footer>
              <Button onClick={closeModal}>{t('Cancel')}</Button>
              <Button
                style={{marginLeft: space(1)}}
                priority="primary"
                onClick={this.onDiscard}
                disabled={!hasFeature}
              >
                {t('Discard Future Events')}
              </Button>
            </Footer>
          </Fragment>
        )}
      </Feature>
    );
  };

  openDiscardModal = () => {
    const {organization} = this.props;

    openModal(this.renderDiscardModal);
    analytics('feature.discard_group.modal_opened', {
      org_id: parseInt(organization.id, 10),
    });
  };

  handleClick(disabled: boolean, onClick: (event?: MouseEvent) => void) {
    return function (event: MouseEvent) {
      if (disabled) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      onClick(event);
    };
  }

  render() {
    const {group, project, organization, disabled, event} = this.props;
    const {status, isBookmarked} = group;

    const orgFeatures = new Set(organization.features);

    const bookmarkTitle = isBookmarked ? t('Remove bookmark') : t('Bookmark');
    const hasRelease = !!project.features?.includes('releases');

    const isResolved = status === 'resolved';
    const isIgnored = status === 'ignored';

    return (
      <Wrapper>
        <GuideAnchor target="resolve" position="bottom" offset={space(3)}>
          <ResolveActions
            disabled={disabled}
            disableDropdown={disabled}
            hasRelease={hasRelease}
            latestRelease={project.latestRelease}
            onUpdate={this.onUpdate}
            orgSlug={organization.slug}
            projectSlug={project.slug}
            isResolved={isResolved}
            isAutoResolved={
              group.status === 'resolved' ? group.statusDetails.autoResolved : undefined
            }
          />
        </GuideAnchor>
        <GuideAnchor target="ignore_delete_discard" position="bottom" offset={space(3)}>
          <IgnoreActions
            isIgnored={isIgnored}
            onUpdate={this.onUpdate}
            disabled={disabled}
          />
        </GuideAnchor>
        <Tooltip
          disabled={!!group.inbox || disabled}
          title={t('Issue has been reviewed')}
          delay={300}
        >
          <ReviewAction onUpdate={this.onUpdate} disabled={!group.inbox || disabled} />
        </Tooltip>
        {orgFeatures.has('shared-issues') && (
          <ShareIssue
            disabled={disabled}
            loading={this.state.shareBusy}
            isShared={group.isPublic}
            shareUrl={this.getShareUrl(group.shareId)}
            onToggle={this.onToggleShare}
            onReshare={() => this.onShare(true)}
          />
        )}

        <SubscribeAction
          disabled={disabled}
          group={group}
          onClick={this.handleClick(disabled, this.onToggleSubscribe)}
        />

        {displayReprocessEventAction(organization.features, event) && (
          <ReprocessAction
            disabled={disabled}
            icon={<IconRefresh size="xs" />}
            title={t('Reprocess this issue')}
            aria-label={t('Reprocess this issue')}
            onClick={this.handleClick(disabled, this.onReprocessEvent)}
          />
        )}

        <Access organization={organization} access={['event:admin']}>
          {({hasAccess}) => (
            <Feature
              hookName="feature-disabled:open-in-discover"
              features={['discover-basic']}
              organization={organization}
            >
              {({hasFeature}) => (
                <GuideAnchor target="open_in_discover">
                  <DropdownMenuControlV2
                    triggerProps={{
                      'aria-label': t('More actions'),
                      icon: <IconEllipsis size="xs" />,
                      showChevron: false,
                      size: 'xsmall',
                    }}
                    items={[
                      {
                        key: 'bookmark',
                        label: bookmarkTitle,
                        hidden: false,
                        onAction: this.onToggleBookmark,
                      },
                      {
                        key: 'open-in-discover',
                        label: t('Open in Discover'),
                        hidden: !hasFeature,
                        onAction: this.onRedirectDiscover,
                      },
                      {
                        key: 'delete',
                        label: t('Delete'),
                        hidden: !hasAccess,
                        isSubmenu: true,
                        children: [
                          {
                            key: 'delete-issue',
                            label: t('Delete issue'),
                            onAction: () =>
                              openModal(
                                ({Body, Footer, closeModal}: ModalRenderProps) => (
                                  <Fragment>
                                    <Body>
                                      {t(
                                        'Deleting this issue is permanent. Are you sure you wish to continue?'
                                      )}
                                    </Body>
                                    <Footer>
                                      <Button onClick={closeModal}>{t('Cancel')}</Button>
                                      <Button
                                        style={{marginLeft: space(1)}}
                                        priority="primary"
                                        onClick={this.onDelete}
                                      >
                                        {t('Delete')}
                                      </Button>
                                    </Footer>
                                  </Fragment>
                                )
                              ),
                          },
                          {
                            key: 'delete-and-discard',
                            label: t('Delete and discard future events'),
                            onAction: () => this.openDiscardModal(),
                          },
                        ],
                      },
                    ]}
                  />
                </GuideAnchor>
              )}
            </Feature>
          )}
        </Access>
      </Wrapper>
    );
  }
}

const ReprocessAction = styled(ActionButton)``;

const Wrapper = styled('div')`
  display: grid;
  justify-content: flex-start;
  align-items: center;
  grid-auto-flow: column;
  gap: ${space(0.5)};
  margin-top: ${space(2)};
  white-space: nowrap;
`;

export {Actions};

export default withApi(withOrganization(Actions));
