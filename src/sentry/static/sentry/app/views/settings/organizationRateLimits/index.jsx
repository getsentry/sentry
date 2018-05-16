import {Box} from 'grid-emotion';
import createReactClass from 'create-react-class';
import PropTypes from 'prop-types';
import React from 'react';

import {t, tct} from 'app/locale';
import Field from 'app/views/settings/components/forms/field';
import Form from 'app/views/settings/components/forms/form';
import {Panel, PanelAlert, PanelBody, PanelHeader} from 'app/components/panels';
import OrganizationState from 'app/mixins/organizationState';
import RangeField from 'app/views/settings/components/forms/rangeField';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import TextBlock from 'app/views/settings/components/text/textBlock';

const getRateLimitValues = () => {
  let steps = [];
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

class OrganizationRateLimits extends React.Component {
  static propTypes = {
    organization: PropTypes.object.isRequired,
  };

  handleSubmitSucces = () => {
    // TODO(billy): Update organization.quota in organizationStore with new values
  };

  render() {
    let {organization} = this.props;
    let {quota} = organization;
    let {maxRate, maxRateInterval, projectLimit, accountLimit} = quota;
    let initialData = {
      projectRateLimit: projectLimit || 100,
      accountRateLimit: accountLimit,
    };

    return (
      <div>
        <SettingsPageHeader title={t('Rate Limits')} />

        <Panel>
          <PanelHeader disablePadding>
            <Box px={2} flex="1">
              {t('Adjust Limits')}
            </Box>
          </PanelHeader>
          <PanelBody>
            <PanelAlert type="info">
              {t(`Rate limits allow you to control how much data is stored for this
                organization. When a rate is exceeded the system will begin discarding
                data until the next interval.`)}
            </PanelAlert>

            <Form
              className="ref-rate-limit-editor"
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
                  formatLabel={value => {
                    return !value
                      ? t('No Limit')
                      : tct('[number] per hour', {
                          number: value.toLocaleString(),
                        });
                  }}
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
                  'The maximum percentage of your account limit an individual project can consume.'
                )}
                step={5}
                min={50}
                max={100}
                formatLabel={value => {
                  return value !== 100 ? (
                    `${value}%`
                  ) : (
                    <span
                      dangerouslySetInnerHTML={{__html: `${t('No Limit')} &mdash; 100%`}}
                    />
                  );
                }}
              />
            </Form>
          </PanelBody>
        </Panel>
      </div>
    );
  }
}

const OrganizationRateLimitsContainer = createReactClass({
  displayName: 'OrganizationRateLimits',
  mixins: [OrganizationState],

  render() {
    if (!this.context.organization) return null;

    return (
      <OrganizationRateLimits {...this.props} organization={this.context.organization} />
    );
  },
});

export {OrganizationRateLimits};
export default OrganizationRateLimitsContainer;
