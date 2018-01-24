import {Flex, Box} from 'grid-emotion';
import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import {t} from '../../../locale';
import AlertLink from '../../../components/alertLink';
import AsyncView from '../../asyncView';
import Button from '../../../components/buttons/button';
import Form from '../components/forms/form';
import JsonForm from '../components/forms/jsonForm';
import Panel from '../components/panel';
import PanelBody from '../components/panelBody';
import PanelHeader from '../components/panelHeader';
import Row from '../components/row';
import Tag from '../components/tag';
import SettingsPageHeader from '../components/settingsPageHeader';
import accountEmailsFields from '../../../data/forms/accountEmails';

const ENDPOINT = '/users/me/emails/';

const RemoveButton = styled(({hidden, ...props}) => (
  <Button priority="danger" size="small" {...props}>
    <span className="icon-trash" />
  </Button>
))`
  ${p => (p.hidden ? 'opacity: 0' : '')};
`;

class EmailRow extends React.Component {
  static propTypes = {
    email: PropTypes.string.isRequired,
    isVerified: PropTypes.bool,
    isPrimary: PropTypes.bool,
    hideRemove: PropTypes.bool,
    onRemove: PropTypes.func,
    onSetPrimary: PropTypes.func,
  };

  handleSetPrimary = e => {
    this.props.onSetPrimary(this.props.email, e);
  };

  handleRemove = e => {
    this.props.onRemove(this.props.email, e);
  };

  render() {
    let {email, isPrimary, isVerified, hideRemove} = this.props;

    return (
      <Row justify="space-between">
        <Flex align="center">
          {email}
          {!isVerified && <Tag priority="warning">{t('Unverified')}</Tag>}
          {isPrimary && <Tag priority="success">{t('Primary')}</Tag>}
        </Flex>

        {!isPrimary &&
          !hideRemove && (
            <Flex>
              <Button size="small" onClick={this.handleSetPrimary}>
                {t('Set as primary')}
              </Button>
              <Box ml={1}>
                <RemoveButton
                  onClick={this.handleRemove}
                  hidden={isPrimary || hideRemove}
                />
              </Box>
            </Flex>
          )}
      </Row>
    );
  }
}

class AccountEmails extends AsyncView {
  getEndpoints() {
    return [['emails', ENDPOINT]];
  }

  handleSubmitSuccess = (change, model, id) => {
    model.setValue(id, '');
    this.remountComponent();
  };

  handleSetPrimary = email => {
    this.setState({loading: true, emails: []}, () => {
      this.api
        .requestPromise(ENDPOINT, {
          method: 'PUT',
          data: {
            email,
          },
        })
        .then(this.remountComponent.bind(this));
    });
  };

  handleRemove = email => {
    this.setState({loading: true, emails: []}, () => {
      this.api
        .requestPromise(ENDPOINT, {
          method: 'DELETE',
          data: {
            email,
          },
        })
        .then(this.remountComponent.bind(this));
    });
  };

  renderBody() {
    let {emails} = this.state;
    let primary = emails.find(({isPrimary}) => isPrimary);
    let secondary = emails.filter(({isPrimary}) => !isPrimary);

    return (
      <div>
        <SettingsPageHeader title="Emails" />

        <Panel>
          <PanelHeader>{t('Emails')}</PanelHeader>
          <PanelBody>
            {primary && <EmailRow onRemove={this.handleRemove} {...primary} />}

            {secondary &&
              secondary.map(emailObj => {
                return (
                  <EmailRow
                    key={emailObj.email}
                    onSetPrimary={this.handleSetPrimary}
                    onRemove={this.handleRemove}
                    {...emailObj}
                  />
                );
              })}
          </PanelBody>
        </Panel>

        <Form
          apiMethod="POST"
          apiEndpoint={ENDPOINT}
          saveOnBlur
          onSubmitSuccess={this.handleSubmitSuccess}
        >
          <JsonForm location={this.props.location} forms={accountEmailsFields} />
        </Form>

        <AlertLink to="/settings/account/notifications" icon="icon-stack">
          {t('Wanna change how many emails you get? Use the notifications panel.')}
        </AlertLink>
      </div>
    );
  }
}

export default AccountEmails;
