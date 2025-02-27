import {Fragment} from 'react';
import styled from '@emotion/styled';

import {addLoadingMessage, clearIndicators} from 'sentry/actionCreators/indicator';
import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {openModal} from 'sentry/actionCreators/modal';
import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import TextareaField from 'sentry/components/forms/fields/textareaField';
import TextField from 'sentry/components/forms/fields/textField';
import type {FormProps} from 'sentry/components/forms/form';
import Form from 'sentry/components/forms/form';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import PanelItem from 'sentry/components/panels/panelItem';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {isActiveSuperuser} from 'sentry/utils/isActiveSuperuser';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';

import SubscriptionStore from 'getsentry/stores/subscriptionStore';
import type {GDPRDetails, Subscription} from 'getsentry/types';

interface GDPREditModalProps extends ModalRenderProps {
  prefix: 'euRep' | 'dpo';
  subscription: Subscription;
}

function GDPREditModal({
  Header,
  Footer,
  closeModal,
  prefix,
  subscription,
}: GDPREditModalProps) {
  const api = useApi();
  const onSubmit: FormProps['onSubmit'] = (formData, success, failure) => {
    addLoadingMessage();
    api.request(`/customers/${subscription.slug}/`, {
      method: 'PUT',
      data: {gdprDetails: formData},
      success: data => {
        SubscriptionStore.set(subscription.slug, data);
        clearIndicators();
        success(data);
        closeModal();
      },
      error: error => {
        clearIndicators();
        failure(error);
      },
    });
  };

  const initialData: Partial<GDPRDetails> = subscription.gdprDetails ?? {};

  return (
    <Fragment>
      <Header>
        <h4>{sectionTitles[prefix]}</h4>
      </Header>
      <Form initialData={initialData} onSubmit={onSubmit} hideFooter>
        <FormWrapper>
          <TextField key="name" name={`${prefix}Name`} label={t('Full Name')} />
          <TextareaField
            key="address"
            name={`${prefix}Address`}
            label={t('Address')}
            rows={2}
            autosize
          />
          <TextField key="phone" name={`${prefix}Phone`} label={t('Phone Number')} />
          <TextField key="email" name={`${prefix}Email`} label={t('Email')} inline />
        </FormWrapper>
        <Footer>
          <ButtonBar gap={1}>
            <Button
              type="button"
              onClick={() => {
                closeModal();
              }}
            >
              {t('Cancel')}
            </Button>
            <Button type="submit" priority="primary">
              {t('Save Changes')}
            </Button>
          </ButtonBar>
        </Footer>
      </Form>
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
  gap: ${space(4)};
`;

const SubText = styled('div')`
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSizeSmall};
`;

/**
 * Allows the form to expand into the full width of the panel
 */
const FormWrapper = styled('div')`
  margin-left: -${space(4)};
  margin-right: -${space(4)};
  & > div {
    padding-left: ${space(4)};
    padding-right: ${space(4)} !important;
  }

  & > div > label {
    width: 35%;
  }
`;

const ContactDetailsWrapper = styled('div')`
  margin-bottom: ${space(0.75)};
  font-size: ${p => p.theme.fontSizeSmall};
`;
