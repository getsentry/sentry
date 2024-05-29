import {Fragment} from 'react';

import Access from 'sentry/components/acl/access';
import FeatureBadge from 'sentry/components/badge/featureBadge';
import BooleanField from 'sentry/components/forms/fields/booleanField';
import Form from 'sentry/components/forms/form';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import {t, tct} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';

const CONFIRM_MESSAGE_TRUE = tct(
  '[bold:This change will affect all projects.] Enabling percentiles may slow down metric queries and increase costs in the future. Are you sure you want to proceed?',
  {bold: <strong />}
);

const CONFIRM_MESSAGE_FALSE = tct(
  '[bold:This change will affect all projects.] Are you sure you want to proceed?',
  {bold: <strong />}
);

export function Percentiles() {
  const organization = useOrganization();

  const endpoint = `/organizations/${organization.slug}/`;

  return (
    <Form
      apiEndpoint={endpoint}
      apiMethod="PUT"
      saveOnBlur
      initialData={{
        metricsActivatePercentiles: organization.metricsActivatePercentiles ?? false,
      }}
    >
      <Panel>
        <PanelHeader>{t('Features')}</PanelHeader>
        <PanelBody>
          <Access access={['org:write']}>
            {({hasAccess}) => (
              <BooleanField
                disabledReason={
                  !hasAccess ? t('You do not have permission to change') : undefined
                }
                disabled={!hasAccess}
                name="metricsActivatePercentiles"
                confirm={{
                  false: CONFIRM_MESSAGE_FALSE,
                  true: CONFIRM_MESSAGE_TRUE,
                }}
                label={
                  <span>
                    {t('Enable Percentiles')} <FeatureBadge type="beta" />
                  </span>
                }
                help={
                  <Fragment>
                    <div>
                      {t(
                        'Activates percentiles (p50, p75, p90, p99) for distribution metrics.'
                      )}
                    </div>
                    {tct(
                      '[bold:Note: This may slow down metric queries and may increase the cost of distributions in the future.] This setting applies across all projects.',
                      {bold: <strong />}
                    )}
                  </Fragment>
                }
                labelText={t('Enable Percentiles')}
                saveOnBlur
                flexibleControlStateSize
              />
            )}
          </Access>
        </PanelBody>
      </Panel>
    </Form>
  );
}
