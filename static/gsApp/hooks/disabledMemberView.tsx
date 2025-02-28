import {Fragment} from 'react';
import styled from '@emotion/styled';

import {addErrorMessage, addLoadingMessage} from 'sentry/actionCreators/indicator';
import {redirectToRemainingOrganization} from 'sentry/actionCreators/organizations';
import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import Confirm from 'sentry/components/confirm';
import DeprecatedAsyncComponent from 'sentry/components/deprecatedAsyncComponent';
import Footer from 'sentry/components/footer';
import PageOverlay from 'sentry/components/pageOverlay';
import {SidebarWrapper} from 'sentry/components/sidebar';
import SidebarDropdown from 'sentry/components/sidebar/sidebarDropdown';
import {t, tct} from 'sentry/locale';
import type {RouteComponentProps} from 'sentry/types/legacyReactRouter';
import type {Organization} from 'sentry/types/organization';

import {sendUpgradeRequest} from 'getsentry/actionCreators/upsell';
import DeactivatedMember from 'getsentry/components/features/illustrations/deactivatedMember';
import withSubscription from 'getsentry/components/withSubscription';
import type {Subscription} from 'getsentry/types';
import trackGetsentryAnalytics from 'getsentry/utils/trackGetsentryAnalytics';

type Props = RouteComponentProps<
  {orgId: string},
  Record<PropertyKey, string | undefined>
> & {
  subscription: Subscription;
};
type State = DeprecatedAsyncComponent['state'] & {
  organization: Organization | null;
  requested?: boolean;
};

const TextWrapper = styled('div')`
  max-width: 500px;
  margin-right: 20px;
`;

class DisabledMemberView extends DeprecatedAsyncComponent<Props, State> {
  get orgSlug() {
    return this.props.subscription.slug;
  }
  getEndpoints(): ReturnType<DeprecatedAsyncComponent['getEndpoints']> {
    return [
      [
        'organization',
        `/organizations/${this.orgSlug}/?detailed=0&include_feature_flags=1`,
      ],
    ];
  }

  componentDidMount() {
    super.componentDidMount();
    // needed to make the left margin work as expected
    document.body.classList.add('body-sidebar');
  }

  onLoadAllEndpointsSuccess() {
    const {organization, subscription} = this.state;
    if (organization) {
      trackGetsentryAnalytics('disabled_member_view.loaded', {
        organization,
        subscription,
      });
    }
  }

  handleUpgradeRequest = async () => {
    const {organization, subscription} = this.state;
    if (!organization) {
      return;
    }
    await sendUpgradeRequest({
      api: this.api,
      organization,
      type: 'disabledMember',
      handleSuccess: () => this.setState({requested: true}),
    });

    trackGetsentryAnalytics('disabled_member_view.clicked_upgrade_request', {
      organization,
      subscription,
    });
  };

  handleLeave = async () => {
    const {organization, subscription} = this.state;
    if (!organization) {
      return;
    }
    addLoadingMessage(t('Requesting\u2026'));
    try {
      await this.api.requestPromise(`/organizations/${organization.slug}/members/me/`, {
        method: 'DELETE',
        data: {},
      });
    } catch (err) {
      addErrorMessage(t('Unable to leave organization'));
      return;
    }
    trackGetsentryAnalytics('disabled_member_view.clicked_leave_org', {
      organization,
      subscription,
    });
    redirectToRemainingOrganization({orgId: organization.slug, removeOrg: true});
  };

  renderBody() {
    const {organization, requested} = this.state;
    const {subscription} = this.props;
    const totalLicenses = subscription.totalLicenses;
    const orgName = organization?.name;
    const requestButton = requested ? (
      <strong>{t('Requested!')}</strong>
    ) : (
      <Button onClick={this.handleUpgradeRequest} size="sm" priority="primary">
        {t('Request Upgrade')}
      </Button>
    );
    return (
      <PageContainer>
        <MinimalistSidebar collapsed={false}>
          {organization && (
            <SidebarDropdown orientation="left" collapsed={false} hideOrgLinks />
          )}
        </MinimalistSidebar>
        {organization && (
          <PageOverlay
            background={DeactivatedMember}
            customWrapper={TextWrapper}
            text={({Header, Body}) => (
              <Fragment>
                <Header>{t('Member Deactivated')}</Header>
                <Body>
                  <p>
                    {tct(
                      '[firstSentence] Request an upgrade to our Team or Business Plan to get back to making software less bad.',
                      {
                        firstSentence:
                          totalLicenses > 1
                            ? tct(
                                '[orgName] is on a plan that supports only [totalLicenses] members.',
                                {
                                  orgName: <strong>{organization.name}</strong>,
                                  totalLicenses,
                                }
                              )
                            : tct('[orgName] is on a plan that supports only 1 member.', {
                                orgName: <strong>{organization.name}</strong>,
                              }),
                      }
                    )}
                  </p>
                  <DisabledMemberButtonBar gap={2}>
                    {requestButton}
                    <Confirm
                      onConfirm={this.handleLeave}
                      message={tct('Are you sure you want to leave [orgName]?', {
                        orgName,
                      })}
                    >
                      <Button size="sm" priority="danger">
                        {t('Leave')}
                      </Button>
                    </Confirm>
                  </DisabledMemberButtonBar>
                </Body>
              </Fragment>
            )}
            positioningStrategy={({mainRect, anchorRect, wrapperRect}) => {
              // Vertically center within the anchor
              let y =
                (anchorRect.height - wrapperRect.height + 40) / 2 +
                anchorRect.y -
                mainRect.y;

              // move up text on mobile
              if (mainRect.width < 480) {
                y = y - 100;
              }

              // Align to the right of the anchor, avoid overflowing outside of the
              // page, the best we can do is start to overlap the illustration at
              // this point.
              let x = anchorRect.x - mainRect.x - wrapperRect.width;
              x = Math.max(30, x);

              return {x, y};
            }}
          />
        )}
        <Footer />
      </PageContainer>
    );
  }
}

export default withSubscription(DisabledMemberView);

const MinimalistSidebar = styled(SidebarWrapper)`
  padding: 12px 19px;
`;

const PageContainer = styled('div')`
  display: flex;
  flex-direction: column;
  flex-grow: 1;
  min-height: 100vh;
`;

const DisabledMemberButtonBar = styled(ButtonBar)`
  max-width: fit-content;
`;
