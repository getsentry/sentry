import React from 'react';

import Breadcrumbs from 'app/components/breadcrumbs';
import Button from 'app/components/button';
import ButtonBar from 'app/components/buttonBar';
import EditableText from 'app/components/editableText';
import * as Layout from 'app/components/layouts/thirds';
import {t} from 'app/locale';

type Props = {
  title: string;
  orgSlug: string;
  disabled: boolean;
  onChangeTitle: (title: string) => void;
  onSave: (event: React.MouseEvent) => void;
};

function Header({title, orgSlug, disabled, onChangeTitle, onSave}: Props) {
  return (
    <Layout.Header>
      <Layout.HeaderContent>
        <Breadcrumbs
          crumbs={[
            {
              to: `/organizations/${orgSlug}/dashboards/`,
              label: t('Dashboards'),
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
          <Button
            priority="primary"
            onClick={onSave}
            disabled={disabled}
            title={disabled ? t('This feature is not yet available') : undefined}
          >
            {t('Save Widget')}
          </Button>
        </ButtonBar>
      </Layout.HeaderActions>
    </Layout.Header>
  );
}

export default Header;
