import {RouteComponentProps} from 'react-router';

import Field from 'sentry/components/forms/field';
import Form from 'sentry/components/forms/form';
import RangeField from 'sentry/components/forms/rangeField';
import {Panel, PanelAlert, PanelBody, PanelHeader} from 'sentry/components/panels';
import {t, tct} from 'sentry/locale';
import {Organization} from 'sentry/types';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import TextBlock from 'sentry/views/settings/components/text/textBlock';

type Props = RouteComponentProps<{}, {}> & {
  organization: Organization;
};

const getRateLimitValues = () => {
  const steps: number[] = [];
  let i = 0;
  while (i <= 1000000) {
    steps.push(i);
    if (i < 10000) {
      i += 1000;
    } else if (i < 100000) {
      i += 10000;
    } else {
      i += 100000;
    }
  }
  return steps;
};

// We can just generate this once
const ACCOUNT_RATE_LIMIT_VALUES = getRateLimitValues();

const OrganizationRateLimit = ({organization}: Props) => {
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
          <PanelAlert type="info">
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
              <Field
                label={t('Account Limit')}
                help={t(
                  'The maximum number of events to accept across this entire organization.'
                )}
              >
                <TextBlock css={{marginBottom: 0}}>
                  {tct(
                    'Your account is limited to a maximum of [maxRate] events per [maxRateInterval] seconds.',
                    {
                      maxRate,
                      maxRateInterval,
                    }
                  )}
                </TextBlock>
              </Field>
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
                value !== 100 ? (
                  `${value}%`
                ) : (
                  <span
                    dangerouslySetInnerHTML={{__html: `${t('No Limit')} &mdash; 100%`}}
                  />
                )
              }
            />
          </Form>
        </PanelBody>
      </Panel>
    </div>
  );
};

export default OrganizationRateLimit;
