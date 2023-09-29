import {Component} from 'react';
import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import EmailField from 'sentry/components/forms/fields/emailField';
import Form from 'sentry/components/forms/form';
import NarrowLayout from 'sentry/components/narrowLayout';
import {IconMegaphone} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {trackAnalytics} from 'sentry/utils/analytics';

type Props = RouteComponentProps<{orgId: string}, {}>;

type State = {
  submitSuccess: boolean | null;
};

class OrganizationJoinRequest extends Component<Props, State> {
  state: State = {
    submitSuccess: null,
  };

  handleSubmitSuccess = () => {
    const {params, location} = this.props;
    this.setState({submitSuccess: true});
    trackAnalytics('join_request.created', {
      organization: params.orgId,
      referrer: location.query.referrer,
    });
  };

  handleSubmitError() {
    addErrorMessage(t('Request to join failed'));
  }

  handleCancel = e => {
    e.preventDefault();
    const {params} = this.props;

    window.location.assign(`/auth/login/${params.orgId}/`);
  };

  render() {
    const {params} = this.props;
    const {submitSuccess} = this.state;

    if (submitSuccess) {
      return (
        <NarrowLayout maxWidth="550px">
          <SuccessModal>
            <StyledIconMegaphone size="xxl" />
            <StyledHeader>{t('Request Sent')}</StyledHeader>
            <StyledText>{t('Your request to join has been sent.')}</StyledText>
            <ReceiveEmailMessage>
              {t('You will receive an email when your request is approved.')}
            </ReceiveEmailMessage>
          </SuccessModal>
        </NarrowLayout>
      );
    }

    return (
      <NarrowLayout maxWidth="650px">
        <StyledIconMegaphone size="xxl" />
        <StyledHeader data-test-id="join-request">{t('Request to Join')}</StyledHeader>
        <StyledText>
          {tct('Ask the admins if you can join the [orgId] organization.', {
            orgId: params.orgId,
          })}
        </StyledText>
        <Form
          requireChanges
          apiEndpoint={`/organizations/${params.orgId}/join-request/`}
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
