import {Breadcrumbs} from 'sentry/components/breadcrumbs';
import {LinkButton} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import FeedbackWidgetButton from 'sentry/components/feedback/widget/feedbackWidgetButton';
import * as Layout from 'sentry/components/layouts/thirds';
import type {LinkProps} from 'sentry/components/links/link';
import {t} from 'sentry/locale';

import type {DashboardDetails} from '../types';

interface Props {
  dashboardTitle: DashboardDetails['title'];
  goBackLocation: LinkProps['to'];
  orgSlug: string;
}

export function Header({orgSlug, goBackLocation, dashboardTitle}: Props) {
  return (
    <Layout.Header>
      <Layout.HeaderContent>
        <Breadcrumbs
          crumbs={[
            {
              to: `/organizations/${orgSlug}/dashboards/`,
              label: t('Dashboards'),
            },
            {
              to: goBackLocation,
              label: dashboardTitle,
            },
            {label: t('Widget Builder')},
          ]}
        />
      </Layout.HeaderContent>

      <Layout.HeaderActions>
        <ButtonBar gap={1}>
          <FeedbackWidgetButton />
          <LinkButton
            external
            size="sm"
            href="https://docs.sentry.io/product/dashboards/custom-dashboards/#widget-builder"
          >
            {t('Read the docs')}
          </LinkButton>
        </ButtonBar>
      </Layout.HeaderActions>
    </Layout.Header>
  );
}
