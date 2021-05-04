import * as React from 'react';

import Breadcrumbs from 'app/components/breadcrumbs';
import Button from 'app/components/button';
import ButtonBar from 'app/components/buttonBar';
import Confirm from 'app/components/confirm';
import EditableText from 'app/components/editableText';
import * as Layout from 'app/components/layouts/thirds';
import Link from 'app/components/links/link';
import {t} from 'app/locale';

import {DashboardDetails} from '../types';

type Props = {
  title: string;
  orgSlug: string;
  goBackLocation: React.ComponentProps<typeof Link>['to'];
  dashboardTitle: DashboardDetails['title'];
  onChangeTitle: (title: string) => void;
  onSave?: (event: React.MouseEvent) => void;
  onDelete?: () => void;
  disabled?: boolean;
  isEditing?: boolean;
};

function Header({
  title,
  orgSlug,
  goBackLocation,
  dashboardTitle,
  onChangeTitle,
  onSave,
  onDelete,
  isEditing,
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
            value={title}
            onChange={onChangeTitle}
            errorMessage={t('Please set a title for this widget')}
            successMessage={t('Widget title updated successfully')}
          />
        </Layout.Title>
      </Layout.HeaderContent>

      <Layout.HeaderActions>
        <ButtonBar gap={1}>
          <Button
            title={t(
              "You’re seeing the metrics project because you have the feature flag 'organizations:metrics' enabled. Send us feedback via email."
            )}
            href="mailto:metrics-feedback@sentry.io?subject=Metrics Feedback"
          >
            {t('Give Feedback')}
          </Button>
          <Button to={goBackLocation}>{t('Cancel')}</Button>
          {isEditing && onDelete && (
            <Confirm
              priority="danger"
              message={t('Are you sure you want to delete this widget?')}
              onConfirm={onDelete}
            >
              <Button priority="danger">{t('Delete')}</Button>
            </Confirm>
          )}
          <Button
            priority="primary"
            onClick={onSave}
            disabled={!onSave}
            title={!onSave ? t('This feature is not yet available') : undefined}
          >
            {isEditing ? t('Update Widget') : t('Add Widget')}
          </Button>
        </ButtonBar>
      </Layout.HeaderActions>
    </Layout.Header>
  );
}

export default Header;
