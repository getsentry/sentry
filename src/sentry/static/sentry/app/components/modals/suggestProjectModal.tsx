import React from 'react';
import styled from '@emotion/styled';
import {Observer} from 'mobx-react';
import * as qs from 'query-string';

import bgPattern from 'sentry-images/spot/mobile-hero.jpg';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'app/actionCreators/indicator';
import {ModalRenderProps} from 'app/actionCreators/modal';
import {Client} from 'app/api';
import Button from 'app/components/button';
import ButtonBar from 'app/components/buttonBar';
import List from 'app/components/list';
import ListItem from 'app/components/list/listItem';
import {t, tct} from 'app/locale';
import space from 'app/styles/space';
import {Organization} from 'app/types';
import {trackAdvancedAnalyticsEvent} from 'app/utils/advancedAnalytics';
import withApi from 'app/utils/withApi';
import EmailField from 'app/views/settings/components/forms/emailField';
import Form from 'app/views/settings/components/forms/form';
import FormModel from 'app/views/settings/components/forms/model';

type Props = ModalRenderProps & {
  api: Client;
  organization: Organization;
};

type State = {
  askTeammate?: boolean;
};

class SuggestProjectModal extends React.Component<Props, State> {
  state: State = {
    askTeammate: false,
  };
  model = new FormModel();

  handleGetStartedClick = () => {
    trackAdvancedAnalyticsEvent(
      'growth.clicked_mobile_prompt_setup_project',
      {},
      this.props.organization
    );
  };

  handleAskTeammate = () => {
    this.setState({askTeammate: true});
    trackAdvancedAnalyticsEvent(
      'growth.clicked_mobile_prompt_ask_teammate',
      {},
      this.props.organization
    );
  };

  goBack = () => {
    this.setState({askTeammate: false});
  };

  handleSubmitSuccess = ({targetUserEmail}: {targetUserEmail: string}) => {
    addSuccessMessage('Notified teammate successfully');
    trackAdvancedAnalyticsEvent(
      'growth.submitted_mobile_prompt_ask_teammate',
      {email: targetUserEmail},
      this.props.organization
    );
    this.props.closeModal();
  };

  handleSubmit = () => {
    addLoadingMessage(t('Submitting\u2026'));
    this.model.saveForm();
  };

  handleSubmitError = () => {
    addErrorMessage(t('Error notifying teammate'));
  };

  handlePreSubmit = () => {
    addLoadingMessage(t('Submitting\u2026'));
  };

  renderAskTeammate() {
    const {Body, Footer, organization} = this.props;
    const model = this.model;
    return (
      <React.Fragment>
        <Body>
          <Form
            model={this.model}
            apiEndpoint={`/organizations/${organization.slug}/request-project-creation/`}
            apiMethod="POST"
            submitLabel={t('Send')}
            onSubmitSuccess={this.handleSubmitSuccess}
            onSubmitError={this.handleSubmitError}
            onPreSubmit={this.handlePreSubmit}
            hideFooter
          >
            <p>
              {t('Let the right folks know about Sentry Mobile Application Monitoring.')}
            </p>
            <EmailField
              required
              name="targetUserEmail"
              inline={false}
              label={t('Email Address')}
              placeholder="name@example.com"
              stacked
            />
          </Form>
        </Body>
        <Footer>
          <ButtonBar gap={1}>
            <Button onClick={this.goBack}>{t('Back')}</Button>
            <Observer>
              {() => (
                <Button
                  onClick={this.handleSubmit}
                  disabled={model.isError || model.isSaving}
                  priority="primary"
                >
                  {t('Send')}
                </Button>
              )}
            </Observer>
          </ButtonBar>
        </Footer>
      </React.Fragment>
    );
  }

  renderMain() {
    const {Body, Footer, organization} = this.props;

    const paramString = qs.stringify({
      referrer: 'suggest_project',
      category: 'mobile',
    });

    const newProjectLink = `/organizations/${organization.slug}/projects/new/?${paramString}`;

    return (
      <React.Fragment>
        <Body>
          <ModalContainer>
            <SmallP>
              {t(
                "Sentry for Mobile shows a holistic overview of your application's health in real time. So you can correlate errors with releases, tags, and devices to solve problems quickly, decrease churn, and improve user retention."
              )}
            </SmallP>

            <StyledList symbol="bullet">
              <ListItem>
                {tct(
                  '[see:See] session data, version adoption, and user impact by every release.',
                  {
                    see: <strong />,
                  }
                )}
              </ListItem>
              <ListItem>
                {tct(
                  '[solve:Solve] issues quickly with full context: contextualized stack traces, events that lead to the error, client, hardware information, and the very commit that introduced the error.',
                  {
                    solve: <strong />,
                  }
                )}
              </ListItem>
              <ListItem>
                {tct(
                  '[learn:Learn] and analyze event data to reduce regressions and ultimately improve user adoption and engagement.',
                  {
                    learn: <strong />,
                  }
                )}
              </ListItem>
            </StyledList>

            <SmallP>{t('And guess what? Setup takes less than five minutes.')}</SmallP>
          </ModalContainer>
        </Body>
        <Footer>
          <ButtonBar gap={1}>
            <Button onClick={this.handleAskTeammate}>{t('Tell a Teammate')}</Button>
            <Button
              href={newProjectLink}
              onClick={this.handleGetStartedClick}
              priority="primary"
            >
              {t('Get Started')}
            </Button>
          </ButtonBar>
        </Footer>
      </React.Fragment>
    );
  }

  render() {
    const {Header} = this.props;
    const {askTeammate} = this.state;
    const header = askTeammate ? t('Tell a Teammate') : t('Try Sentry for Mobile');
    return (
      <React.Fragment>
        <Header>
          <PatternHeader />
          <Title>{header}</Title>
        </Header>
        {this.state.askTeammate ? this.renderAskTeammate() : this.renderMain()}
      </React.Fragment>
    );
  }
}

const ModalContainer = styled('div')`
  display: grid;
  grid-gap: ${space(3)};

  code {
    word-break: break-word;
  }
`;

const Title = styled('h3')`
  margin-top: ${space(2)};
  margin-bottom: ${space(3)};
`;

const SmallP = styled('p')`
  margin: 0;
`;

const PatternHeader = styled('div')`
  margin: -${space(4)} -${space(4)} 0 -${space(4)};
  border-radius: 7px 7px 0 0;
  background-image: url(${bgPattern});
  background-size: 475px;
  background-color: black;
  background-repeat: no-repeat;
  overflow: hidden;
  background-position: center bottom;
  height: 156px;
`;

const StyledList = styled(List)`
  li {
    padding-left: ${space(3)};
    :before {
      top: 7px;
    }
  }
`;

export default withApi(SuggestProjectModal);
