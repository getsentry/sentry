import React from 'react';
import styled from 'react-emotion';
import {Params} from 'react-router/lib/Router';

import {addErrorMessage} from 'app/actionCreators/indicator';
import {t, tct} from 'app/locale';
import EmailField from 'app/views/settings/components/forms/emailField';
import Form from 'app/views/settings/components/forms/form';
import InlineSvg from 'app/components/inlineSvg';
import NarrowLayout from 'app/components/narrowLayout';
import space from 'app/styles/space';

type Props = {
  params: Params;
};

type State = {
  submitSuccess: boolean | null;
};

class OrganizationJoinRequest extends React.Component<Props, State> {
  state: State = {
    submitSuccess: null,
  };

  handleSubmitSuccess = () => {
    this.setState({submitSuccess: true});
  };

  handleSubmitError() {
    addErrorMessage(t('Request to join failed'));
  }

  handleCancel = e => {
    e.preventDefault();

    const {orgId} = this.props.params;
    window.location.assign(`/auth/login/${orgId}/`);
  };

  render() {
    const {orgId} = this.props.params;
    const {submitSuccess} = this.state;

    return (
      <React.Fragment>
        {submitSuccess ? (
          <NarrowLayout maxWidth="550px">
            <SuccessModal>
              <MegaphoneIcon src="icon-megaphone" size="5em" />
              <StyledHeader>{t('Request Sent')}</StyledHeader>
              <div>{t('Your request to join has been sent.')}</div>
              <ReceiveEmailMessage>
                {tct('You will receive an email if your request is approved.', {orgId})}
              </ReceiveEmailMessage>
            </SuccessModal>
          </NarrowLayout>
        ) : (
          <NarrowLayout maxWidth="600px">
            <MegaphoneIcon src="icon-megaphone" size="5em" />
            <StyledHeader>{t('Request to Join')}</StyledHeader>
            <div>
              {tct('Ask the owners if you can join the [orgId] organization.', {orgId})}
            </div>
            <Form
              requireChanges
              apiEndpoint={`/organizations/${orgId}/join-request/`}
              apiMethod="POST"
              submitLabel={t('Request to Join')}
              onSubmitSuccess={this.handleSubmitSuccess}
              onSubmitError={this.handleSubmitError}
              onCancel={this.handleCancel}
            >
              <StyledEmailField
                name="email"
                inline={false}
                label={t('Email Address')}
                placeholder="name@example.com"
              />
            </Form>
          </NarrowLayout>
        )}
      </React.Fragment>
    );
  }
}

const SuccessModal = styled('div')`
  display: grid;
  justify-items: center;
  text-align: center;
  padding-top: 10px;
  padding-bottom: ${space(4)};
`;

const MegaphoneIcon = styled(InlineSvg)`
  padding-bottom: ${space(3)};
`;

const StyledHeader = styled('h3')`
  margin-bottom: ${space(1)};
`;

const ReceiveEmailMessage = styled('div')`
  max-width: 250px;
`;

const StyledEmailField = styled(EmailField)`
  padding-top: ${space(2)};
  padding-left: 0;
`;

export default OrganizationJoinRequest;
