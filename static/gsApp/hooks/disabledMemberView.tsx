import {Fragment, useEffect, useState} from 'react';
import styled from '@emotion/styled';

import {addErrorMessage, addLoadingMessage} from 'sentry/actionCreators/indicator';
import {redirectToRemainingOrganization} from 'sentry/actionCreators/organizations';
import Confirm from 'sentry/components/confirm';
import {Button} from 'sentry/components/core/button';
import {ButtonBar} from 'sentry/components/core/button/buttonBar';
import Footer from 'sentry/components/footer';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import PageOverlay from 'sentry/components/pageOverlay';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import {useApiQuery, useMutation} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';
import {useParams} from 'sentry/utils/useParams';
import {OrgDropdown} from 'sentry/views/nav/orgDropdown';
import {UserDropdown} from 'sentry/views/nav/userDropdown';

import {sendUpgradeRequest} from 'getsentry/actionCreators/upsell';
import DeactivatedMember from 'getsentry/components/features/illustrations/deactivatedMember';
import withSubscription from 'getsentry/components/withSubscription';
import type {Subscription} from 'getsentry/types';
import trackGetsentryAnalytics from 'getsentry/utils/trackGetsentryAnalytics';

type Props = {
  subscription: Subscription;
};

function DisabledMemberView(props: Props) {
  const {orgId} = useParams<{orgId: string}>();
  const api = useApi({persistInFlight: true});
  const [requested, setRequested] = useState(false);

  const {subscription} = props;
  const orgSlug = subscription.slug;

  const {
    data: organization,
    isPending,
    isError,
    refetch,
  } = useApiQuery<Organization>(
    [`/organizations/${orgSlug}/`, {query: {detailed: '0', include_feature_flags: '1'}}],
    {
      staleTime: 0,
    }
  );

  useEffect(() => {
    if (organization) {
      trackGetsentryAnalytics('disabled_member_view.loaded', {
        organization,
        subscription,
      });
    }
  }, [organization, subscription]);

  const handleUpgradeRequestMutation = useMutation({
    mutationFn: () =>
      sendUpgradeRequest({
        api,
        organization: organization!,
        type: 'disabledMember',
      }),
    onSuccess: () => {
      setRequested(true);
      trackGetsentryAnalytics('disabled_member_view.clicked_upgrade_request', {
        organization: organization!,
        subscription,
      });
    },
  });

  const handleLeaveMutation = useMutation({
    mutationFn: () => {
      return api.requestPromise(`/organizations/${organization?.slug}/members/me/`, {
        method: 'DELETE',
        data: {},
      });
    },
    onMutate: () => {
      addLoadingMessage(t('Requesting\u2026'));
    },
    onSuccess: () => {
      trackGetsentryAnalytics('disabled_member_view.clicked_leave_org', {
        organization: organization!,
        subscription,
      });
      redirectToRemainingOrganization({orgId, removeOrg: true});
    },
    onError: () => {
      addErrorMessage(t('Unable to leave organization'));
    },
  });

  if (isPending) {
    return <LoadingIndicator />;
  }

  if (isError) {
    return <LoadingError onRetry={refetch} />;
  }

  const totalLicenses = subscription.totalLicenses;
  const orgName = organization?.name;
  const requestButton = requested ? (
    <strong>{t('Requested!')}</strong>
  ) : (
    <Button
      onClick={() => handleUpgradeRequestMutation.mutate()}
      size="sm"
      priority="primary"
    >
      {t('Request Upgrade')}
    </Button>
  );
  return (
    <PageContainer>
      <MinimalistSidebar>
        {organization ? <OrgDropdown hideOrgLinks /> : null}
        {<UserDropdown />}
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
                <DisabledMemberButtonBar gap="xl">
                  {requestButton}
                  <Confirm
                    onConfirm={() => handleLeaveMutation.mutate()}
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

export default withSubscription(DisabledMemberView);

const MinimalistSidebar = styled('div')`
  height: 60px;
  border-bottom: 1px solid ${p => p.theme.tokens.border.primary};
  background: ${p => p.theme.tokens.background.primary};
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 ${space(2)};
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

const TextWrapper = styled('div')`
  max-width: 500px;
  margin-right: 20px;
`;
