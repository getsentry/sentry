import { Component } from 'react';
import styled from '@emotion/styled';
import {Params} from 'react-router/lib/Router';

import {addErrorMessage} from 'app/actionCreators/indicator';
import {t, tct} from 'app/locale';
import {trackAdhocEvent} from 'app/utils/analytics';
import EmailField from 'app/views/settings/components/forms/emailField';
import Form from 'app/views/settings/components/forms/form';
import {IconMegaphone} from 'app/icons';
import NarrowLayout from 'app/components/narrowLayout';
import space from 'app/styles/space';

type Props = {
  params: Params;
};

type State = {
  submitSuccess: boolean | null;
};

class OrganizationJoinRequest extends Component<Props, State> {
  state: State = {
    submitSuccess: null,
  };

  componentDidMount() {
    const {orgId} = this.props.params;

    trackAdhocEvent({
      eventKey: 'join_request.viewed',
      org_slug: orgId,
    });
  }

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

    if (submitSuccess) {
      return (
        <NarrowLayout maxWidth="550px">
          <SuccessModal>
            <StyledIconMegaphone size="5em" />
            <StyledHeader>{t('Request Sent')}</StyledHeader>
            <StyledText>{t('Your request to join has been sent.')}</StyledText>
            <ReceiveEmailMessage>
              {tct('You will receive an email when your request is approved.', {orgId})}
            </ReceiveEmailMessage>
          </SuccessModal>
        </NarrowLayout>
      );
    }

    return (
      <NarrowLayout maxWidth="650px">
        <StyledIconMegaphone size="5em" />
        <StyledHeader>{t('Request to Join')}</StyledHeader>
        <StyledText>
          {tct('Ask the admins if you can join the [orgId] organization.', {
            orgId,
          })}
        </StyledText>
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

const StyledIconMegaphone = styled(IconMegaphone)`
  padding-bottom: ${space(3)};
`;

const StyledHeader = styled('h3')`
  margin-bottom: ${space(1)};
`;

const StyledText = styled('p')`
  margin-bottom: 0;
`;

const ReceiveEmailMessage = styled(StyledText)`
  max-width: 250px;
`;

const StyledEmailField = styled(EmailField)`
  padding-top: ${space(2)};
  padding-left: 0;
`;

export default OrganizationJoinRequest;
