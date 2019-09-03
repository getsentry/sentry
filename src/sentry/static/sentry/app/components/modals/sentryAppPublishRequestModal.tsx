import {Body, Header} from 'react-bootstrap/lib/Modal';
import styled from 'react-emotion';
import PropTypes from 'prop-types';
import React from 'react';
import {addErrorMessage, addSuccessMessage} from 'app/actionCreators/indicator';
import _ from 'lodash';
import {Location} from 'history';

import {SentryApp} from 'app/types';
import {t} from 'app/locale';
import Form from 'app/views/settings/components/forms/form';
import FormModel from 'app/views/settings/components/forms/model';
import JsonForm from 'app/views/settings/components/forms/jsonForm';

class PublishRequestFormModel extends FormModel {
  modal: SentryAppPublishRequestModal;

  constructor(modal, ...args) {
    super(...args);
    this.modal = modal;
  }

  getTransformedData() {
    const data = this.getData();
    //map object to list of questions
    const questionnaire = this.modal.formFields.map(field => {
      return {
        question: field.label,
        answer: data[field.name],
      };
    });
    return {questionnaire};
  }
}

type Props = {
  app: SentryApp;
  location: Location;
  closeModal: () => void;
};

export default class SentryAppPublishRequestModal extends React.Component<Props> {
  static propTypes = {
    app: PropTypes.object.isRequired,
  };

  form = new PublishRequestFormModel(this);

  get formFields() {
    const {app} = this.props;
    //replace the : with a . so we can reserve the colon for the question
    const scopeString = app.scopes.join(', ').replace(/:/g, '-');
    const baseFields = [
      {
        type: 'textarea',
        required: true,
        label: 'What does your integration do? Please be as detailed as possible.',
        autosize: true,
      },
      {
        type: 'textarea',
        required: true,
        label: 'What value does it offer customers?',
        autosize: true,
      },
      {
        type: 'textarea',
        required: true,
        label: `Please justify why you are requesting each of the following scopes: ${scopeString}.`,
        autosize: true,
      },
      {
        type: 'textarea',
        required: true,
        label: 'Do you operate the web service your integration communicates with?',
        autosize: true,
      },
    ];
    //dynamically generate the name based off the index
    return baseFields.map((field, index) =>
      Object.assign({name: `question${index}`}, field)
    );
  }

  onSubmitSuccess = () => {
    addSuccessMessage(t('Request to publish %s successful.', this.props.app.slug));
    this.props.closeModal();
  };

  onSubmitError = () => {
    addErrorMessage(t('Request to publish %s fails.', this.props.app.slug));
  };

  render() {
    const {app} = this.props;
    const endpoint = `/sentry-apps/${app.slug}/publish-request/`;
    const forms = [
      {
        title: t('Questions to answer'),
        fields: this.formFields,
      },
    ];
    return (
      <React.Fragment>
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
            onSubmitSuccess={this.onSubmitSuccess}
            onSubmitError={this.onSubmitError}
            model={this.form}
            submitLabel={t('Request Publication')}
            onCancel={() => this.props.closeModal()}
          >
            <JsonForm location={this.props.location} forms={forms} />
          </Form>
        </Body>
      </React.Fragment>
    );
  }
}

const Explanation = styled.div`
  margin: 10px;
`;
