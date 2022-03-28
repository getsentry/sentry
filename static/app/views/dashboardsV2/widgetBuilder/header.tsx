import * as React from 'react';

import Breadcrumbs from 'sentry/components/breadcrumbs';
import Button from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import EditableText from 'sentry/components/editableText';
import * as Layout from 'sentry/components/layouts/thirds';
import Link from 'sentry/components/links/link';
import {t} from 'sentry/locale';

import {DashboardDetails} from '../types';

interface Props {
  dashboardTitle: DashboardDetails['title'];
  goBackLocation: React.ComponentProps<typeof Link>['to'];
  onChangeTitle: (title: string) => void;
  orgSlug: string;
  title: string;
}

export function Header({
  title,
  orgSlug,
  goBackLocation,
  dashboardTitle,
  onChangeTitle,
}: Props) {
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
        <Layout.Title>
          <EditableText
            aria-label={t('Widget title')}
            value={title}
            onChange={onChangeTitle}
            errorMessage={t('Widget title is required')}
            maxLength={255}
          />
        </Layout.Title>
      </Layout.HeaderContent>

      <Layout.HeaderActions>
        <ButtonBar gap={1}>
          <Button
            external
            href="https://docs.sentry.io/product/dashboards/custom-dashboards/#widget-builder"
          >
            {t('Read the docs')}
          </Button>
        </ButtonBar>
      </Layout.HeaderActions>
    </Layout.Header>
  );
}
