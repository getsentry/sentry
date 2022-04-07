import {Component, Fragment} from 'react';
import styled from '@emotion/styled';
import intersection from 'lodash/intersection';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {ModalRenderProps} from 'sentry/actionCreators/modal';
import Form from 'sentry/components/forms/form';
import JsonForm from 'sentry/components/forms/jsonForm';
import FormModel from 'sentry/components/forms/model';
import {PermissionChoice, SENTRY_APP_PERMISSIONS} from 'sentry/constants';
import {t, tct} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Scope, SentryApp} from 'sentry/types';

/**
 * Given an array of scopes, return the choices the user has picked for each option
 * @param scopes {Array}
 */
const getPermissionSelectionsFromScopes = (scopes: Scope[]) => {
  const permissions: string[] = [];
  for (const permObj of SENTRY_APP_PERMISSIONS) {
    let highestChoice: PermissionChoice | undefined;
    for (const perm in permObj.choices) {
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

class PublishRequestFormModel extends FormModel {
  getTransformedData() {
    const data = this.getData();
    // map object to list of questions
    const questionnaire = Array.from(this.fieldDescriptor.values()).map(field =>
      // we read the meta for the question that has a react node for the label
      ({
        question: field.meta || field.label,
        answer: data[field.name],
      })
    );
    return {questionnaire};
  }
}

type Props = ModalRenderProps & {
  app: SentryApp;
};

export default class SentryAppPublishRequestModal extends Component<Props> {
  form = new PublishRequestFormModel();

  get formFields() {
    const {app} = this.props;
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
            {i > 0 && ', '} <Permission>{permission}</Permission>
          </Fragment>
        ))}
        .
      </Fragment>
    );

    // No translations since we need to be able to read this email :)
    const baseFields: React.ComponentProps<typeof JsonForm>['fields'] = [
      {
        type: 'textarea',
        required: true,
        label: 'What does your integration do? Please be as detailed as possible.',
        autosize: true,
        rows: 1,
        inline: false,
        name: 'question0',
      },
      {
        type: 'textarea',
        required: true,
        label: 'What value does it offer customers?',
        autosize: true,
        rows: 1,
        inline: false,
        name: 'question1',
      },
      {
        type: 'textarea',
        required: true,
        label: 'Do you operate the web service your integration communicates with?',
        autosize: true,
        rows: 1,
        inline: false,
        name: 'question2',
      },
    ];

    // Only add the permissions question if there are perms to add
    if (permissions.length > 0) {
      baseFields.push({
        type: 'textarea',
        required: true,
        label: permissionLabel,
        autosize: true,
        rows: 1,
        inline: false,
        meta: permissionQuestionPlainText,
        name: 'question3',
      });
    }

    return baseFields;
  }

  handleSubmitSuccess = () => {
    addSuccessMessage(t('Request to publish %s successful.', this.props.app.slug));
    this.props.closeModal();
  };

  handleSubmitError = err => {
    addErrorMessage(
      tct('Request to publish [app] fails. [detail]', {
        app: this.props.app.slug,
        detail: err?.responseJSON?.detail,
      })
    );
  };

  render() {
    const {app, Header, Body} = this.props;
    const endpoint = `/sentry-apps/${app.slug}/publish-request/`;
    const forms = [
      {
        title: t('Questions to answer'),
        fields: this.formFields,
      },
    ];
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
            onSubmitSuccess={this.handleSubmitSuccess}
            onSubmitError={this.handleSubmitError}
            model={this.form}
            submitLabel={t('Request Publication')}
            onCancel={() => this.props.closeModal()}
          >
            <JsonForm forms={forms} />
          </Form>
        </Body>
      </Fragment>
    );
  }
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
