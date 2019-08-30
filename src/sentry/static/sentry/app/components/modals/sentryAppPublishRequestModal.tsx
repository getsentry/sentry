import Modal, {Header, Body, Footer} from 'react-bootstrap/lib/Modal';
import PropTypes, { any } from 'prop-types';
import React from 'react';
import styled from 'react-emotion';
import {Observer} from 'mobx-react';
import _ from 'lodash';

import {SelectAsyncField} from 'app/components/forms';
import {t} from 'app/locale';
import Button from 'app/components/button';
import TimeSince from 'app/components/timeSince';
import Version from 'app/components/version';

import Form from 'app/views/settings/components/forms/form';
import FormModel from 'app/views/settings/components/forms/model';
import FormField from 'app/views/settings/components/forms/formField';
import JsonForm from 'app/views/settings/components/forms/jsonForm';

class PublishRequestFormModel extends FormModel {
  getData() {
    return this.fields.toJSON();
  }
}

type Props = {
  app: any;
}

type State = {
  isModalOpen: boolean;
}

export default class SentryAppPublishRequestModal  extends React.Component <Props, State> {
  static propTypes = {
    app: PropTypes.object.isRequired,
    // onPublishRequest: PropTypes.func.isRequired,
  };

  constructor(...args) {
    super(...args);
    this.form = new PublishRequestFormModel();
  }

  state = {
    isModalOpen: false,
  };

  get formConfig() {
    const { app } = this.props;
    const baseFields =  [
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
              label:
                `You are requesting the following scopes: ${app.scopes}. Please justify why you need each scope.`,
              autosize: true,
            },
            {
              type: 'textarea',
              required: true,
              label: "Do you own the web service it's communicating with?",
              autosize: true,
            },
        ];

      const fields = baseFields.map( (field, index) => Object.assign({name: `question${index}`}, field))

    return [
      title: t('Publish Request Questionaire'),
      fields,
    ];
  }

  onSubmitSuccess = () => {
    this.handleToggle();
  };

  handleToggle = () => {
    this.setState({isModalOpen: !this.state.isModalOpen});
  };

  render() {
    const {children, app} = this.props;
    const endpoint = `/sentry-apps/${app.slug}/publish-request/`;
    return (
      <Observer>
        {() => (
          <React.Fragment>
            {React.cloneElement(children, {
              onClick: this.handleToggle,
            })}
            <OneModalWrapper>
              <Modal
                show={this.state.isModalOpen}
                animation={false}
                onHide={this.handleToggle}
              >
                <Form
                  allowUndo
                  apiMethod="POST"
                  apiEndpoint={endpoint}
                  onSubmitSuccess={this.onSubmitSuccess}
                  model={this.form}
                  submitLabel={t('Publish Integration')}
                >
                  <JsonForm location={this.props.location} forms={this.formConfig} />
                </Form>
              </Modal>
            </OneModalWrapper>
          </React.Fragment>
        )}
      </Observer>
    );
  }
}

const OneModalWrapper = styled.div`
  & .modal-dialog {
    width: 1000px;
  }
`;
