import {css} from '@emotion/react';

import FieldGroup from 'sentry/components/forms/fieldGroup';
import RangeField from 'sentry/components/forms/fields/rangeField';
import Form from 'sentry/components/forms/form';
import Panel from 'sentry/components/panels/panel';
import PanelAlert from 'sentry/components/panels/panelAlert';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import {t, tct} from 'sentry/locale';
import type {RouteComponentProps} from 'sentry/types/legacyReactRouter';
import type {Organization} from 'sentry/types/organization';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import TextBlock from 'sentry/views/settings/components/text/textBlock';

export type OrganizationRateLimitProps = RouteComponentProps<{}, {}> & {
  organization: Organization;
};

const getRateLimitValues = () => {
  const steps: number[] = [];
  let i = 0;
  while (i <= 1_000_000) {
    steps.push(i);
    if (i < 10_000) {
      i += 1_000;
    } else if (i < 100_000) {
      i += 10_000;
    } else {
      i += 100_000;
    }
  }
  return steps;
};

// We can just generate this once
const ACCOUNT_RATE_LIMIT_VALUES = getRateLimitValues();

function OrganizationRateLimit({organization}: OrganizationRateLimitProps) {
  // TODO(billy): Update organization.quota in organizationStore with new values

  const {quota} = organization;
  const {maxRate, maxRateInterval, projectLimit, accountLimit} = quota;
  const initialData = {
    projectRateLimit: projectLimit || 100,
    accountRateLimit: accountLimit,
  };

  return (
    <div>
      <SettingsPageHeader title={t('Rate Limits')} />

      <Panel>
        <PanelHeader>{t('Adjust Limits')}</PanelHeader>
        <PanelBody>
          <PanelAlert margin={false} type="info">
            {t(`Rate limits allow you to control how much data is stored for this
                organization. When a rate is exceeded the system will begin discarding
                data until the next interval.`)}
          </PanelAlert>

          <Form
            data-test-id="rate-limit-editor"
            saveOnBlur
            allowUndo
            apiMethod="PUT"
            apiEndpoint={`/organizations/${organization.slug}/`}
            initialData={initialData}
          >
            {!maxRate ? (
              <RangeField
                name="accountRateLimit"
                label={t('Account Limit')}
                min={0}
                max={1000000}
                allowedValues={ACCOUNT_RATE_LIMIT_VALUES}
                help={t(
                  'The maximum number of events to accept across this entire organization.'
                )}
                placeholder="e.g. 500"
                formatLabel={value =>
                  !value
                    ? t('No Limit')
                    : tct('[number] per hour', {
                        number: value.toLocaleString(),
                      })
                }
              />
            ) : (
              <FieldGroup
                label={t('Account Limit')}
                help={t(
                  'The maximum number of events to accept across this entire organization.'
                )}
              >
                <TextBlock
                  css={css`
                    margin-bottom: 0;
                  `}
                >
                  {tct(
                    'Your account is limited to a maximum of [maxRate] events per [maxRateInterval] seconds.',
                    {
                      maxRate,
                      maxRateInterval,
                    }
                  )}
                </TextBlock>
              </FieldGroup>
            )}
            <RangeField
              name="projectRateLimit"
              label={t('Per-Project Limit')}
              help={t(
                'The maximum percentage of the account limit (set above) that an individual project can consume.'
              )}
              step={5}
              min={50}
              max={100}
              formatLabel={value =>
                value !== 100 ? `${value}%` : t('No Limit \u2014 100%')
              }
            />
          </Form>
        </PanelBody>
      </Panel>
    </div>
  );
}

export default OrganizationRateLimit;
