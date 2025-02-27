import {css} from '@emotion/react';
import styled from '@emotion/styled';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import ErrorBoundary from 'sentry/components/errorBoundary';
import HighlightModalContainer from 'sentry/components/highlightModalContainer';
import ExternalLink from 'sentry/components/links/externalLink';
import List from 'sentry/components/list';
import ListItem from 'sentry/components/list/listItem';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';

import type {Plan, PreviewData, Subscription} from 'getsentry/types';
import type {AM2UpdateSurfaces} from 'getsentry/utils/trackGetsentryAnalytics';

import ActionButtons from './actionButtons';
import PlanTable from './planTable';
import type {Reservations} from './types';
import useLogUpgradeNowViewed from './useLogUpgradeNowViewed';

type Props = ModalRenderProps & {
  organization: Organization;
  plan: Plan;
  previewData: PreviewData;
  reservations: Reservations;
  subscription: Subscription;
  surface: AM2UpdateSurfaces;
  isActionDisabled?: boolean;
  onComplete?: () => void;
};

function UpgradeNowModal({
  isActionDisabled,
  onComplete,
  organization,
  plan,
  previewData,
  reservations,
  subscription,
  surface,
}: Props) {
  useLogUpgradeNowViewed({
    hasPriceChange: previewData.billedAmount !== 0,
    organization,
    subscription,
    surface,
  });

  return (
    <HighlightModalContainer>
      <ModalLayout>
        <UpsellContent>
          <SubheaderPrimary>{t('Updates to Sentry')}</SubheaderPrimary>
          <Header>{t('Performance that scales & Session Replay')}</Header>
          <p>
            {t(
              'Get full visibility into the performance and stability of your application'
            )}
          </p>
          <List symbol="bullet">
            <ListItem>
              <ExternalLink href="https://docs.sentry.io/product/performance/performance-at-scale/">
                {t('Dynamically sample performance events at scale*')}
              </ExternalLink>
            </ListItem>
            <ListItem>{t('Automatically discard health check transactions')}</ListItem>
            <ListItem>
              {t(
                'Video-like reproduction of user sessions to get to the root cause faster.'
              )}
            </ListItem>
          </List>
          <ActionButtons
            isActionDisabled={isActionDisabled}
            onComplete={onComplete}
            organization={organization}
            plan={plan}
            previewData={previewData}
            reservations={reservations}
            subscription={subscription}
            surface={surface}
          />
          <Note>
            {t(
              '* Dynamic sampling kicks in for customers reserving 1M or more performance units a month'
            )}
          </Note>
        </UpsellContent>

        <div>
          <Subheader>{t('Plan Volume')}</Subheader>
          <ErrorBoundary mini>
            <PlanTable
              organization={organization}
              previewData={previewData}
              reservations={reservations}
              subscription={subscription}
            />
          </ErrorBoundary>
        </div>
      </ModalLayout>
    </HighlightModalContainer>
  );
}

const Subheader = styled('h2')`
  text-transform: uppercase;
  font-weight: bold;

  font-size: ${p => p.theme.fontSizeSmall};
  margin-bottom: ${space(1)};
`;

const SubheaderPrimary = styled(Subheader)`
  color: ${p => p.theme.purple300};
`;

const Header = styled('h1')`
  font-size: ${p => p.theme.headerFontSize};
  font-weight: bold;
  margin: ${space(1)} 0;
`;

const ModalLayout = styled('div')`
  display: grid;
  font-size: ${p => p.theme.fontSizeMedium};
  margin-bottom: ${space(2)};

  @media (min-width: ${p => p.theme.breakpoints.small}) {
    grid-template-columns: 1fr auto;
    gap: ${space(3)};
  }
`;

const UpsellContent = styled('div')`
  grid-column: 1;
  grid-row: 1;
  font-size: ${p => p.theme.fontSizeLarge};
`;

const Note = styled('p')`
  color: ${p => p.theme.gray300};
  font-size: ${p => p.theme.fontSizeExtraSmall};
`;

export const modalCss = css`
  width: 100%;
  max-width: 980px;

  [role='document'] {
    position: relative;
    padding: 80px;
    overflow: hidden;
  }
`;

export default UpgradeNowModal;
