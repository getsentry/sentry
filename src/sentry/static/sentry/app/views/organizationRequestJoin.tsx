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

class OrganizationRequestJoin extends React.Component<Props, State> {
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
    window.location.href = `/auth/login/${orgId}/`;
  };

  render() {
    const {orgId} = this.props.params;
    const {submitSuccess} = this.state;

    return (
      <NarrowLayout>
        {submitSuccess ? (
          <RequestJoinSuccess>
            <MegaphoneIcon src="icon-megaphone" size="5em" />
            <h3>{t('Request Sent')}</h3>
            <div>{t('Your request has been sent and the owners are reviewing.')}</div>
          </RequestJoinSuccess>
        ) : (
          <React.Fragment>
            <MegaphoneIcon src="icon-megaphone" size="5em" />
            <h3>{t('Request to Join')}</h3>
            <div>
              {tct('Ask the owners if you can join the [orgId] organization.', {orgId})}
            </div>
            <Form
              requireChanges
              apiEndpoint={`/organizations/${orgId}/request-join/`}
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
          </React.Fragment>
        )}
      </NarrowLayout>
    );
  }
}

const RequestJoinSuccess = styled('div')`
  display: grid;
  justify-items: center;
  padding-bottom: ${space(3)};
`;

const MegaphoneIcon = styled(InlineSvg)`
  padding-bottom: ${space(3)};
`;

const StyledEmailField = styled(EmailField)`
  padding-top: ${space(2)};
  padding-left: 0;
`;

export default OrganizationRequestJoin;
