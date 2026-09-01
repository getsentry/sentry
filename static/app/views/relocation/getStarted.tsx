import {useState} from 'react';
import styled from '@emotion/styled';
import {useQueryClient} from '@tanstack/react-query';
import {motion} from 'framer-motion';
import {z} from 'zod';

import {defaultFormOptions, useScrapsForm} from '@sentry/scraps/form';
import {Flex, Stack} from '@sentry/scraps/layout';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {t} from 'sentry/locale';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {getSignupLocalities} from 'sentry/utils/cells';
import {RequestError} from 'sentry/utils/requestError/requestError';
import {StepHeading} from 'sentry/views/relocation/components/stepHeading';

import type {StepProps} from './types';

const PROMO_CODE_ERROR_MSG = t(
  'That promotional code has already been claimed, does not have enough remaining uses, is no longer valid, or never existed.'
);
const PROMO_CODE_FALLBACK_ERROR_MSG = t(
  'Could not validate the promotional code. Try again.'
);

const getStartedSchema = z.object({
  orgSlugs: z.string().trim().min(3, t('Enter at least one organization slug')),
  localityName: z.string().min(1, t('Select a datacenter location')),
  promoCode: z.string(),
});

export function GetStarted({
  relocationState,
  onUpdateRelocationState,
  onComplete,
}: StepProps) {
  const queryClient = useQueryClient();
  const {orgSlugs, localityName, promoCode} = relocationState;
  const [showPromoCode, setShowPromoCode] = useState(!!promoCode);
  const localityOptions = getSignupLocalities();

  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: {orgSlugs, localityName, promoCode},
    validators: {onDynamic: getStartedSchema},
    onSubmit: ({value}) => {
      const parsedValue = getStartedSchema.parse(value);
      const completeStep = () => {
        if (parsedValue.orgSlugs !== value.orgSlugs) {
          onUpdateRelocationState({orgSlugs: parsedValue.orgSlugs});
        }
        onComplete();
      };

      return parsedValue.promoCode
        ? queryClient
            .fetchQuery(
              apiOptions.as<unknown>()('/promocodes-external/$code', {
                path: {code: parsedValue.promoCode},
                staleTime: 0,
              })
            )
            .then(completeStep)
            .catch(error => {
              addErrorMessage(
                error instanceof RequestError && error.status === 403
                  ? PROMO_CODE_ERROR_MSG
                  : PROMO_CODE_FALLBACK_ERROR_MSG
              );
            })
        : completeStep();
    },
  });

  return (
    <Wrapper data-test-id="get-started">
      <StepHeading step={1}>{t('Basic information needed to get started')}</StepHeading>
      <motion.div
        variants={{
          initial: {y: 30, opacity: 0},
          animate: {y: 0, opacity: 1},
          exit: {opacity: 0},
        }}
      >
        <form.AppForm form={form}>
          <p>
            {t(
              'In order to best facilitate the process some basic information will be required to ensure success with the relocation process of you self-hosted instance'
            )}
          </p>
          <Stack gap="xl">
            <form.AppField name="orgSlugs">
              {field => (
                <field.Layout.Stack
                  label={t('Organization slugs being relocated')}
                  required
                >
                  <field.Input
                    aria-label={t('org-slugs')}
                    value={field.state.value}
                    onChange={value => {
                      field.handleChange(value);
                      onUpdateRelocationState({orgSlugs: value});
                    }}
                    placeholder="org-slug-1, org-slug-2, ..."
                  />
                </field.Layout.Stack>
              )}
            </form.AppField>
            <form.AppField name="localityName">
              {field => (
                <field.Layout.Stack label={t('Choose a datacenter location')} required>
                  <field.Select
                    aria-label={t('region')}
                    value={field.state.value}
                    options={localityOptions}
                    placeholder={t('Select Location')}
                    onChange={value => {
                      field.handleChange(value);
                      onUpdateRelocationState({localityName: value});
                    }}
                  />
                </field.Layout.Stack>
              )}
            </form.AppField>
          </Stack>
          <form.Subscribe selector={state => state.values.localityName}>
            {selectedLocalityName =>
              selectedLocalityName ? (
                <p>{t('This is an important decision and cannot be changed.')}</p>
              ) : null
            }
          </form.Subscribe>
          <DatacenterTextBlock>
            {t(
              "Choose where to store your organization's data. Please note, you won't be able to change locations once your relocation has been initiated. "
            )}
            <a
              href="https://docs.sentry.io/product/accounts/choose-your-data-center"
              target="_blank"
              rel="noreferrer"
            >
              Learn more
            </a>
            .
          </DatacenterTextBlock>
          {showPromoCode ? (
            <form.AppField name="promoCode">
              {field => (
                <field.Layout.Stack label={t('Promo Code')}>
                  <field.Input
                    aria-label={t('promocode')}
                    value={field.state.value}
                    onChange={value => {
                      field.handleChange(value);
                      onUpdateRelocationState({promoCode: value});
                    }}
                  />
                </field.Layout.Stack>
              )}
            </form.AppField>
          ) : (
            <TogglePromoCode onClick={() => setShowPromoCode(true)}>
              Got a promo code? <u>Click here to redeem it!</u>
            </TogglePromoCode>
          )}
          <Flex justify="end">
            <form.SubmitButton>{t('Continue')}</form.SubmitButton>
          </Flex>
        </form.AppForm>
      </motion.div>
    </Wrapper>
  );
}

const Wrapper = styled('div')`
  box-sizing: border-box;
  margin-left: auto;
  margin-right: auto;
  padding: ${p => p.theme.space['3xl']};
  background-color: ${p => p.theme.tokens.background.primary};
  z-index: 100;
  box-shadow: 0 5px 10px rgba(0, 0, 0, 0.05);
  border-radius: 10px;
  width: 100%;
  max-width: 769px;
  color: ${p => p.theme.tokens.content.secondary};
  h2 {
    color: ${p => p.theme.colors.gray800};
  }
`;

const TogglePromoCode = styled('a')`
  display: block;
  cursor: pointer;
  padding-bottom: ${p => p.theme.space.xl};
`;

const DatacenterTextBlock = styled('p')`
  margin-top: ${p => p.theme.space.md};
`;
