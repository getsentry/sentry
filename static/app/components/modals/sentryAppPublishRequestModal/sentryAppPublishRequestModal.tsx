import {Fragment, useState} from 'react';
import styled from '@emotion/styled';
import intersection from 'lodash/intersection';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import Form from 'sentry/components/forms/form';
import JsonForm from 'sentry/components/forms/jsonForm';
import FormModel from 'sentry/components/forms/model';
import {INTEGRATION_CATEGORIES} from 'sentry/components/modals/sentryAppPublishRequestModal/sentryAppUtils';
import type {PermissionChoice} from 'sentry/constants';
import {SENTRY_APP_PERMISSIONS} from 'sentry/constants';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Scope} from 'sentry/types/core';
import type {SentryApp} from 'sentry/types/integrations';
import type {Organization} from 'sentry/types/organization';

/**
 * Given an array of scopes, return the choices the user has picked for each option
 * @param scopes {Array}
 */
export const getPermissionSelectionsFromScopes = (scopes: Scope[]) => {
  const permissions: string[] = [];
  for (const permObj of SENTRY_APP_PERMISSIONS) {
    let highestChoice: PermissionChoice | undefined;
    for (const perm in permObj.choices) {
      // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
      const choice = permObj.choices[perm];
      const scopesIntersection = intersection(choice.scopes, scopes);
      if (
        scopesIntersection.length > 0 &&
        scopesIntersection.length === choice.scopes.length
      ) {
        if (!highestChoice || scopesIntersection.length > highestChoice.scopes.length) {
          highestChoice = choice;
        }
      }
    }
    if (highestChoice) {
      // we can remove the read part of "Read & Write"
      const label = highestChoice.label.replace('Read & Write', 'Write');
      permissions.push(`${permObj.resource} ${label}`);
    }
  }
  return permissions;
};

function transformData(data: Record<string, any>, model: FormModel) {
  // map object to list of questions
  const questionnaire = Array.from(model.fieldDescriptor.values()).map(field =>
    // we read the meta for the question that has a react node for the label
    ({
      question: field.meta || field.label,
      answer: data[field.name],
    })
  );
  return {questionnaire};
}

type Props = ModalRenderProps & {
  app: SentryApp;
  onPublishSubmission: () => void;
  organization: Organization;
};

export function SentryAppPublishRequestModal(props: Props) {
  const [form] = useState<FormModel>(() => new FormModel({transformData}));
  const {app, closeModal, Header, Body, organization, onPublishSubmission} = props;
  const isNewModalVisible = organization.features.includes(`streamlined-publishing-flow`);

  const formFields = () => {
    const permissions = getPermissionSelectionsFromScopes(app.scopes);

    const permissionQuestionBaseText =
      'Please justify why you are requesting each of the following permissions: ';
    const permissionQuestionPlainText = `${permissionQuestionBaseText}${permissions.join(
      ', '
    )}.`;

    const permissionLabel = (
      <Fragment>
        <PermissionLabel>{permissionQuestionBaseText}</PermissionLabel>
        {permissions.map((permission, i) => (
          <Fragment key={permission}>
            {i > 0 && ', '}
            <Permission>{permission}</Permission>
          </Fragment>
        ))}
        .
      </Fragment>
    );

    const newModalFields: React.ComponentProps<typeof JsonForm>['fields'] = [
      {
        type: 'textarea',
        required: true,
        label: t(
          'Provide a description about your integration, how this benefits developers using Sentry along with what’s needed to set up this integration.'
        ),
        meta: 'Provide a description about your integration, how this benefits developers using Sentry along with what’s needed to set up this integration.',
        autosize: true,
        rows: 1,
        inline: false,
        name: 'question0',
      },
      {
        type: 'textarea',
        required: true,
        meta: 'Provide a one-liner describing your integration. Subject to approval, we’ll use this to describe your integration on Sentry Integrations.',
        label: (
          <Fragment>
            {t(
              'Provide a one-liner describing your integration. Subject to approval, we’ll use this to describe your integration on '
            )}
            <a target="_blank" href="https://sentry.io/integrations/" rel="noreferrer">
              {t('Sentry Integrations')}
            </a>
            .
          </Fragment>
        ),
        autosize: true,
        rows: 1,
        inline: false,
        name: 'question1',
      },
      {
        type: 'select',
        required: true,
        meta: 'Select what category best describes your integration.',
        label: (
          <Fragment>
            {t('Select what category best describes your integration. ')}
            <a
              target="_blank"
              href="https://docs.sentry.io/organization/integrations/"
              rel="noreferrer"
            >
              {t('Documentation for reference.')}
            </a>
          </Fragment>
        ),
        autosize: true,
        choices: INTEGRATION_CATEGORIES,
        rows: 1,
        inline: false,
        name: 'question2',
      },
      {
        type: 'string',
        required: true,
        label: t('Link to your documentation page.'),
        meta: 'Link to your documentation page.',
        autosize: true,
        rows: 1,
        inline: false,
        name: 'question3',
      },
      {
        type: 'string',
        required: true,
        label: t(
          'Link to a video showing installation, setup and user flow for your submission. Examples include: Google Drive & Youtube'
        ),
        meta: 'Link to a video showing installation, setup and user flow for your submission. Examples include: Google Drive & Youtube',
        autosize: true,
        rows: 1,
        inline: false,
        name: 'question4',
      },
    ];

    const oldModalFields: React.ComponentProps<typeof JsonForm>['fields'] = [
      {
        type: 'textarea',
        required: true,
        label: t('What does your integration do? Please be as detailed as possible.'),
        meta: 'What does your integration do? Please be as detailed as possible.',
        autosize: true,
        rows: 1,
        inline: false,
        name: 'question5',
      },
      {
        type: 'textarea',
        required: true,
        label: t('What value does it offer customers?'),
        meta: 'What value does it offer customers?',
        autosize: true,
        rows: 1,
        inline: false,
        name: 'question6',
      },
      {
        type: 'textarea',
        required: true,
        label: t('Do you operate the web service your integration communicates with?'),
        meta: 'Do you operate the web service your integration communicates with?',
        autosize: true,
        rows: 1,
        inline: false,
        name: 'question7',
      },
    ];

    // Only add the permissions question if there are perms to add
    if (permissions.length > 0) {
      oldModalFields.push({
        type: 'textarea',
        required: true,
        label: permissionLabel,
        labelText: permissionQuestionPlainText,
        autosize: true,
        rows: 1,
        inline: false,
        meta: permissionQuestionPlainText,
        name: 'question8',
      });
    }

    // No translations since we need to be able to read this email :)
    const baseFields: React.ComponentProps<typeof JsonForm>['fields'] = isNewModalVisible
      ? newModalFields
      : oldModalFields;

    return baseFields;
  };

  const handleSubmitSuccess = () => {
    addSuccessMessage(t('Request to publish %s successful.', app.slug));
    closeModal();
    if (isNewModalVisible) {
      onPublishSubmission();
    }
  };

  const handleSubmitError = (err: any) => {
    addErrorMessage(
      tct('Request to publish [app] fails. [detail]', {
        app: app.slug,
        detail: err?.responseJSON?.detail,
      })
    );
  };

  const endpoint = `/sentry-apps/${app.slug}/publish-request/`;
  const forms = [
    {
      title: t('Questions to answer'),
      fields: formFields(),
    },
  ];

  const renderFooter = () => {
    return (
      <Footer>
        {t(
          'By submitting your integration, you acknowledge and agree that Sentry reserves the right to remove it at any time in its sole discretion.'
        )}
      </Footer>
    );
  };
  return (
    <Fragment>
      <Header>{t('Publish Request Questionnaire')}</Header>
      <Body>
        <Explanation>
          {t(
            `Please fill out this questionnaire in order to get your integration evaluated for publication.
              Once your integration has been approved, users outside of your organization will be able to install it.`
          )}
        </Explanation>
        <Form
          allowUndo
          apiMethod="POST"
          apiEndpoint={endpoint}
          onSubmitSuccess={handleSubmitSuccess}
          onSubmitError={handleSubmitError}
          model={form}
          submitLabel={t('Request Publication')}
          onCancel={closeModal}
        >
          <JsonForm
            forms={forms}
            renderFooter={isNewModalVisible ? renderFooter : () => <Fragment />}
          />
        </Form>
      </Body>
    </Fragment>
  );
}

const Explanation = styled('div')`
  margin: ${space(1.5)} 0px;
  font-size: 18px;
`;

const PermissionLabel = styled('span')`
  line-height: 24px;
`;

const Permission = styled('code')`
  line-height: 24px;
`;

const Footer = styled('div')`
  padding: ${space(2)};
`;
