import {Fragment} from 'react';

import {LinkButton} from '@sentry/scraps/button';

import {navigateTo} from 'sentry/actionCreators/navigation';
import {FeedbackButton} from 'sentry/components/feedbackButton/feedbackButton';
import * as Layout from 'sentry/components/layouts/thirds';
import {PageHeadingQuestionTooltip} from 'sentry/components/pageHeadingQuestionTooltip';
import {IconSettings} from 'sentry/icons';
import {t} from 'sentry/locale';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {TopBar} from 'sentry/views/navigation/topBar';

export function AlertHeader() {
  const navigate = useNavigate();
  const location = useLocation();
  const organization = useOrganization();
  /**
   * Incidents list is currently at the organization level, but the link needs to
   * go down to a specific project scope.
   */
  const handleNavigateToSettings = (e: React.MouseEvent) => {
    e.preventDefault();
    navigateTo(
      `/settings/${organization.slug}/projects/:projectId/alerts/`,
      navigate,
      location
    );
  };

  return (
    <Fragment>
      <Layout.Title>
        {t('Alerts')}
        <PageHeadingQuestionTooltip
          docsUrl="https://docs.sentry.io/product/alerts/"
          title={t(
            'Real-time visibility into problems with your code and the impact on your users.'
          )}
        />
      </Layout.Title>
      <TopBar.Slot name="actions">
        <LinkButton
          onClick={handleNavigateToSettings}
          href="#"
          icon={<IconSettings size="sm" />}
          tooltipProps={{title: t('Settings')}}
          aria-label={t('Settings')}
        />
      </TopBar.Slot>
      <TopBar.Slot name="feedback">
        <FeedbackButton
          aria-label={t('Give Feedback')}
          tooltipProps={{title: t('Give Feedback')}}
        >
          {null}
        </FeedbackButton>
      </TopBar.Slot>
    </Fragment>
  );
}
