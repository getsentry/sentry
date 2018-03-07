import {Box} from 'grid-emotion';
import PropTypes from 'prop-types';
import React from 'react';

import {t, tct} from '../../../../locale';
import Form from '../../components/forms/form';
import Panel from '../../components/panel';
import PanelAlert from '../../components/panelAlert';
import PanelBody from '../../components/panelBody';
import PanelHeader from '../../components/panelHeader';
import RangeField from '../../components/forms/rangeField';
import SettingsPageHeader from '../../components/settingsPageHeader';
import TextBlock from '../../components/text/textBlock';

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

class RateLimitView extends React.Component {
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
          <PanelHeader disablePadding isFlex>
            <Box px={2} flex="1">
              {t('Adjust Limits')}
            </Box>
          </PanelHeader>
          <PanelBody>
            <PanelAlert m={0} mb={0} type="info" icon="icon-circle-exclamation">
              {t(`Rate limits allow you to control how much data is stored for this
                organization. When a rate is exceeded the system will begin discarding
                data until the next interval.`)}
            </PanelAlert>

            <Form
              className="ref-rate-limit-editor"
              saveOnBlur
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
                <TextBlock>
                  {tct(
                    'Your account is limited to a maximum of [maxRate] events per [maxRateInterval] seconds.',
                    {
                      maxRate,
                      maxRateInterval,
                    }
                  )}
                </TextBlock>
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
                    <span dangerouslySetInnerHTML={{__html: 'No Limit &mdash; 100%'}} />
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

export default RateLimitView;
