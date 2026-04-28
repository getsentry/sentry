import {Fragment} from 'react';
import styled from '@emotion/styled';
import {useMutation} from '@tanstack/react-query';
import {z} from 'zod';

import {Button} from '@sentry/scraps/button';
import {defaultFormOptions, useScrapsForm} from '@sentry/scraps/form';
import {Grid, Stack} from '@sentry/scraps/layout';
import {Heading} from '@sentry/scraps/text';

import {addLoadingMessage, clearIndicators} from 'sentry/actionCreators/indicator';
import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {openModal} from 'sentry/actionCreators/modal';
import {Panel} from 'sentry/components/panels/panel';
import {PanelBody} from 'sentry/components/panels/panelBody';
import {PanelHeader} from 'sentry/components/panels/panelHeader';
import {PanelItem} from 'sentry/components/panels/panelItem';
import {t} from 'sentry/locale';
import {isActiveSuperuser} from 'sentry/utils/isActiveSuperuser';
import {fetchMutation} from 'sentry/utils/queryClient';
import {useOrganization} from 'sentry/utils/useOrganization';

import {SubscriptionStore} from 'getsentry/stores/subscriptionStore';
import type {Subscription} from 'getsentry/types';

interface GDPREditModalProps extends ModalRenderProps {
  prefix: 'euRep' | 'dpo';
  subscription: Subscription;
}

const gdprSchema = z.object({
  name: z.string(),
  address: z.string(),
  phone: z.string(),
  email: z.string(),
});

type GDPRFormValues = z.infer<typeof gdprSchema>;

function GDPREditModal({
  Header,
  Footer,
  closeModal,
  prefix,
  subscription,
}: GDPREditModalProps) {
  const mutation = useMutation({
    mutationFn: (value: GDPRFormValues) => {
      addLoadingMessage();
      return fetchMutation<Subscription>({
        url: `/customers/${subscription.slug}/`,
        method: 'PUT',
        data: {
          gdprDetails: {
            [`${prefix}Name`]: value.name,
            [`${prefix}Address`]: value.address,
            [`${prefix}Phone`]: value.phone,
            [`${prefix}Email`]: value.email,
          },
        },
      });
    },
    onSuccess: data => {
      SubscriptionStore.set(subscription.slug, data);
      clearIndicators();
      closeModal();
    },
    onError: () => {
      clearIndicators();
    },
  });

  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: {
      name: subscription.gdprDetails?.[`${prefix}Name`] ?? '',
      address: subscription.gdprDetails?.[`${prefix}Address`] ?? '',
      phone: subscription.gdprDetails?.[`${prefix}Phone`] ?? '',
      email: subscription.gdprDetails?.[`${prefix}Email`] ?? '',
    } satisfies GDPRFormValues,
    validators: {onDynamic: gdprSchema},
    onSubmit: ({value}) => mutation.mutateAsync(value).catch(() => {}),
  });

  return (
    <Fragment>
      <Header>
        <Heading as="h4">{sectionTitles[prefix]}</Heading>
      </Header>
      <form.AppForm form={form}>
        <Stack gap="lg">
          <form.AppField name="name">
            {field => (
              <field.Layout.Row label={t('Full Name')}>
                <field.Input value={field.state.value} onChange={field.handleChange} />
              </field.Layout.Row>
            )}
          </form.AppField>
          <form.AppField name="address">
            {field => (
              <field.Layout.Row label={t('Address')}>
                <field.TextArea
                  value={field.state.value}
                  onChange={field.handleChange}
                  rows={2}
                  autosize
                />
              </field.Layout.Row>
            )}
          </form.AppField>
          <form.AppField name="phone">
            {field => (
              <field.Layout.Row label={t('Phone Number')}>
                <field.Input value={field.state.value} onChange={field.handleChange} />
              </field.Layout.Row>
            )}
          </form.AppField>
          <form.AppField name="email">
            {field => (
              <field.Layout.Row label={t('Email')}>
                <field.Input value={field.state.value} onChange={field.handleChange} />
              </field.Layout.Row>
            )}
          </form.AppField>
        </Stack>
        <Footer>
          <Grid flow="column" align="center" gap="md">
            <Button type="button" onClick={closeModal}>
              {t('Cancel')}
            </Button>
            <form.SubmitButton>{t('Save Changes')}</form.SubmitButton>
          </Grid>
        </Footer>
      </form.AppForm>
    </Fragment>
  );
}

interface GDPRPanelProps {
  subscription: Subscription;
}

const sectionTitles = {
  euRep: t('Your EU Representative'),
  dpo: t('Your Data Protection Officer (DPO)'),
} as const;

export function GDPRPanel({subscription}: GDPRPanelProps) {
  const organization = useOrganization();
  const activeSuperUser = isActiveSuperuser();
  const hasAccess = organization.access.includes('org:billing');

  function getAction(prefix: 'euRep' | 'dpo') {
    const hasInformation = subscription.gdprDetails
      ? Boolean(
          subscription.gdprDetails[`${prefix}Email`] ||
          subscription.gdprDetails[`${prefix}Name`] ||
          subscription.gdprDetails[`${prefix}Address`] ||
          subscription.gdprDetails[`${prefix}Email`]
        )
      : false;
    const contactDetails = subscription.gdprDetails ? (
      <ContactDetailsWrapper>
        <div>
          <strong>{subscription.gdprDetails[`${prefix}Name`]}</strong> (
          {subscription.gdprDetails[`${prefix}Email`]})
        </div>
        <div>
          <div>{subscription.gdprDetails[`${prefix}Address`]}</div>
          <div>{subscription.gdprDetails[`${prefix}Phone`]}</div>
        </div>
      </ContactDetailsWrapper>
    ) : null;

    return hasAccess ? (
      <div>
        {contactDetails}
        <Button
          size="xs"
          disabled={activeSuperUser}
          onClick={() => {
            if (activeSuperUser) {
              return;
            }

            openModal(modalRenderProps => (
              <GDPREditModal
                {...modalRenderProps}
                subscription={subscription}
                prefix={prefix}
              />
            ));
          }}
        >
          {hasInformation ? t('Update Details') : t('Add Contact Details')}
        </Button>
      </div>
    ) : (
      <div>
        {hasInformation
          ? contactDetails
          : t('There is no information on file for this contact.')}
      </div>
    );
  }

  return (
    <Panel>
      <PanelHeader>{t('Designated GDPR Contacts')}</PanelHeader>
      <PanelBody>
        <ItemLayout>
          <div>
            <div>{sectionTitles.euRep}</div>
            <SubText>
              {t(
                `Person designated, where applicable, to represent customers not
                 established in the EU with regard to their obligations under the
                 General Data Protection Regulation (GDPR).`
              )}
            </SubText>
          </div>
          {getAction('euRep')}
        </ItemLayout>
        <ItemLayout>
          <div>
            <div>{sectionTitles.dpo}</div>
            <SubText>
              {t(
                `Person designated, where applicable, to facilitate compliance with the
                 provisions of the GDPR, which defines the criteria and the conditions
                 under which a data protection officer shall be designated.`
              )}
            </SubText>
          </div>
          {getAction('dpo')}
        </ItemLayout>
      </PanelBody>
    </Panel>
  );
}

const ItemLayout = styled(PanelItem)`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: ${p => p.theme.space['3xl']};
`;

const SubText = styled('div')`
  color: ${p => p.theme.tokens.content.secondary};
  font-size: ${p => p.theme.font.size.sm};
`;

const ContactDetailsWrapper = styled('div')`
  margin-bottom: ${p => p.theme.space.sm};
  font-size: ${p => p.theme.font.size.sm};
`;
