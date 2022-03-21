import * as React from 'react';
import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';
import sortBy from 'lodash/sortBy';

import Feature from 'sentry/components/acl/feature';
import FeatureDisabled from 'sentry/components/acl/featureDisabled';
import InputControl from 'sentry/components/forms/controls/input';
import RangeSlider from 'sentry/components/forms/controls/rangeSlider';
import Form from 'sentry/components/forms/form';
import FormField from 'sentry/components/forms/formField';
import {Panel, PanelAlert, PanelBody, PanelHeader} from 'sentry/components/panels';
import {IconFlag} from 'sentry/icons';
import {t, tct, tn} from 'sentry/locale';
import space from 'sentry/styles/space';
import {defined} from 'sentry/utils';
import {getExactDuration} from 'sentry/utils/formatters';
import {ProjectKey} from 'sentry/views/settings/project/projectKeys/types';

const PREDEFINED_RATE_LIMIT_VALUES = [
  0, 60, 300, 900, 3600, 7200, 14400, 21600, 43200, 86400,
];

type RateLimitValue = {
  count: number;
  window: number;
};

type Props = {
  data: ProjectKey;
  disabled: boolean;
} & Pick<
  RouteComponentProps<
    {
      keyId: string;
      orgId: string;
      projectId: string;
    },
    {}
  >,
  'params'
>;

function KeyRateLimitsForm({data, disabled, params}: Props) {
  function handleChangeWindow(
    onChange: (value: RateLimitValue, event: React.ChangeEvent<HTMLInputElement>) => void,
    onBlur: (value: RateLimitValue, event: React.ChangeEvent<HTMLInputElement>) => void,
    currentValueObj: RateLimitValue,
    value: number,
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const valueObj = {...currentValueObj, window: value};

    onChange(valueObj, event);
    onBlur(valueObj, event);
  }

  function handleChangeCount(
    callback: (value: RateLimitValue, event: React.ChangeEvent<HTMLInputElement>) => void,
    value: RateLimitValue,
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const valueObj = {
      ...value,
      count: Number(event.target.value),
    };

    callback(valueObj, event);
  }

  function getAllowedRateLimitValues(currentRateLimit?: number) {
    const {rateLimit} = data;
    const {window} = rateLimit ?? {};

    // The slider should display other values if they are set via the API, but still offer to select only the predefined values
    if (defined(window)) {
      // If the API returns a value not found in the predefined values and the user selects another value through the UI,
      // he will no longer be able to reselect the "custom" value in the slider
      if (currentRateLimit !== window) {
        return PREDEFINED_RATE_LIMIT_VALUES;
      }

      // If the API returns a value not found in the predefined values, that value will be added to the slider
      if (!PREDEFINED_RATE_LIMIT_VALUES.includes(window)) {
        return sortBy([...PREDEFINED_RATE_LIMIT_VALUES, window]);
      }
    }

    return PREDEFINED_RATE_LIMIT_VALUES;
  }

  const {keyId, orgId, projectId} = params;
  const apiEndpoint = `/projects/${orgId}/${projectId}/keys/${keyId}/`;

  const disabledAlert = ({features}) => (
    <FeatureDisabled
      alert={PanelAlert}
      features={features}
      featureName={t('Key Rate Limits')}
    />
  );

  return (
    <Form saveOnBlur apiEndpoint={apiEndpoint} apiMethod="PUT" initialData={data}>
      <Feature
        features={['projects:rate-limits']}
        hookName="feature-disabled:rate-limits"
        renderDisabled={({children, ...props}) =>
          typeof children === 'function' &&
          children({...props, renderDisabled: disabledAlert})
        }
      >
        {({hasFeature, features, organization, project, renderDisabled}) => (
          <Panel>
            <PanelHeader>{t('Rate Limits')}</PanelHeader>

            <PanelBody>
              <PanelAlert type="info" icon={<IconFlag size="md" />}>
                {t(
                  `Rate limits provide a flexible way to manage your error
                    volume. If you have a noisy project or environment you
                    can configure a rate limit for this key to reduce the
                    number of errors processed. To manage your transaction
                    volume, we recommend adjusting your sample rate in your
                    SDK configuration.`
                )}
              </PanelAlert>
              {!hasFeature &&
                typeof renderDisabled === 'function' &&
                renderDisabled({
                  organization,
                  project,
                  features,
                  hasFeature,
                  children: null,
                })}
              <FormField
                name="rateLimit"
                label={t('Rate Limit')}
                disabled={disabled || !hasFeature}
                validate={({form}) => {
                  // TODO(TS): is validate actually doing anything because it's an unexpected prop
                  const isValid =
                    form &&
                    form.rateLimit &&
                    typeof form.rateLimit.count !== 'undefined' &&
                    typeof form.rateLimit.window !== 'undefined';

                  if (isValid) {
                    return [];
                  }

                  return [['rateLimit', t('Fill in both fields first')]];
                }}
                formatMessageValue={({count, window}: RateLimitValue) =>
                  tct('[errors] in [timeWindow]', {
                    errors: tn('%s error ', '%s errors ', count),
                    timeWindow:
                      window === 0 ? t('no time window') : getExactDuration(window),
                  })
                }
                help={t(
                  'Apply a rate limit to this credential to cap the amount of errors accepted during a time window.'
                )}
                inline={false}
              >
                {({onChange, onBlur, value}) => {
                  const window = typeof value === 'object' ? value.window : undefined;
                  return (
                    <RateLimitRow>
                      <InputControl
                        type="number"
                        name="rateLimit.count"
                        min={0}
                        value={typeof value === 'object' ? value.count : undefined}
                        placeholder={t('Count')}
                        disabled={disabled || !hasFeature}
                        onChange={event => handleChangeCount(onChange, value, event)}
                        onBlur={event => handleChangeCount(onBlur, value, event)}
                      />
                      <EventsIn>{t('event(s) in')}</EventsIn>
                      <RangeSlider
                        name="rateLimit.window"
                        allowedValues={getAllowedRateLimitValues(window)}
                        value={window}
                        placeholder={t('Window')}
                        formatLabel={rangeValue => {
                          if (typeof rangeValue === 'number') {
                            if (rangeValue === 0) {
                              return t('None');
                            }
                            return getExactDuration(rangeValue);
                          }
                          return undefined;
                        }}
                        disabled={disabled || !hasFeature}
                        onChange={(rangeValue, event) =>
                          handleChangeWindow(
                            onChange,
                            onBlur,
                            value,
                            Number(rangeValue),
                            event
                          )
                        }
                      />
                    </RateLimitRow>
                  );
                }}
              </FormField>
            </PanelBody>
          </Panel>
        )}
      </Feature>
    </Form>
  );
}

export default KeyRateLimitsForm;

const RateLimitRow = styled('div')`
  display: grid;
  grid-template-columns: 2fr 1fr 2fr;
  align-items: center;
  gap: ${space(1)};
`;

const EventsIn = styled('small')`
  font-size: ${p => p.theme.fontSizeRelativeSmall};
  text-align: center;
  white-space: nowrap;
`;
