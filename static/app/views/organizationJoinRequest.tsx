import {Component} from 'react';
import {type RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import EmailField from 'sentry/components/forms/fields/emailField';
import Form from 'sentry/components/forms/form';
import NarrowLayout from 'sentry/components/narrowLayout';
import {IconMegaphone} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import space from 'sentry/styles/space';
import {type Organization} from 'sentry/types';
import {trackAdhocEvent} from 'sentry/utils/analytics';
import withOrganization from 'sentry/utils/withOrganization';

type Props = RouteComponentProps<{}, {}> & {
  organization: Organization;
};

type State = {
  submitSuccess: boolean | null;
};

class OrganizationJoinRequest extends Component<Props, State> {
  state: State = {
    submitSuccess: null,
  };

  componentDidMount() {
    const {organization} = this.props;

    trackAdhocEvent({
      eventKey: 'join_request.viewed',
      org_slug: organization.slug,
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
    const {organization} = this.props;

    window.location.assign(`/auth/login/${organization.slug}/`);
  };

  render() {
    const {organization} = this.props;
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
        <StyledHeader>{t('Request to Join')}</StyledHeader>
        <StyledText>
          {tct('Ask the admins if you can join the [orgId] organization.', {
            orgId: organization.slug,
          })}
        </StyledText>
        <Form
          requireChanges
          apiEndpoint={`/organizations/${organization.slug}/join-request/`}
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

export default withOrganization(OrganizationJoinRequest);
