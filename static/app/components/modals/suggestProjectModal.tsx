import {Component, Fragment} from 'react';
import styled from '@emotion/styled';
import * as qs from 'query-string';

import bgPattern from 'sentry-images/spot/mobile-hero.jpg';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import {ModalRenderProps} from 'sentry/actionCreators/modal';
import {Client} from 'sentry/api';
import Access from 'sentry/components/acl/access';
import Button from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import EmailField from 'sentry/components/forms/emailField';
import Form from 'sentry/components/forms/form';
import List from 'sentry/components/list';
import ListItem from 'sentry/components/list/listItem';
import {t, tct} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Organization} from 'sentry/types';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import withApi from 'sentry/utils/withApi';

type Props = ModalRenderProps & {
  api: Client;
  matchedUserAgentString: string;
  organization: Organization;
};

type State = {
  askTeammate: boolean;
};

class SuggestProjectModal extends Component<Props, State> {
  state: State = {
    askTeammate: false,
  };

  handleGetStartedClick = () => {
    const {matchedUserAgentString, organization} = this.props;
    trackAdvancedAnalyticsEvent('growth.clicked_mobile_prompt_setup_project', {
      matchedUserAgentString,
      organization,
    });
  };

  handleAskTeammate = () => {
    const {matchedUserAgentString, organization} = this.props;
    this.setState({askTeammate: true});
    trackAdvancedAnalyticsEvent('growth.clicked_mobile_prompt_ask_teammate', {
      matchedUserAgentString,
      organization,
    });
  };

  goBack = () => {
    this.setState({askTeammate: false});
  };

  handleSubmitSuccess = () => {
    const {matchedUserAgentString, organization, closeModal} = this.props;
    addSuccessMessage('Notified teammate successfully');
    trackAdvancedAnalyticsEvent('growth.submitted_mobile_prompt_ask_teammate', {
      matchedUserAgentString,
      organization,
    });
    closeModal();
  };

  handlePreSubmit = () => {
    addLoadingMessage(t('Submitting\u2026'));
  };

  handleSubmitError = () => {
    addErrorMessage(t('Error notifying teammate'));
  };

  renderAskTeammate() {
    const {Body, organization} = this.props;
    return (
      <Body>
        <Form
          apiEndpoint={`/organizations/${organization.slug}/request-project-creation/`}
          apiMethod="POST"
          submitLabel={t('Send')}
          onSubmitSuccess={this.handleSubmitSuccess}
          onSubmitError={this.handleSubmitError}
          onPreSubmit={this.handlePreSubmit}
          extraButton={
            <BackWrapper>
              <StyledBackButton onClick={this.goBack}>{t('Back')}</StyledBackButton>
            </BackWrapper>
          }
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
      <Fragment>
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
          <Access organization={organization} access={['project:write']}>
            {({hasAccess}) => (
              <ButtonBar gap={1}>
                <Button
                  priority={hasAccess ? 'default' : 'primary'}
                  onClick={this.handleAskTeammate}
                >
                  {t('Tell a Teammate')}
                </Button>
                {hasAccess && (
                  <Button
                    href={newProjectLink}
                    onClick={this.handleGetStartedClick}
                    priority="primary"
                  >
                    {t('Get Started')}
                  </Button>
                )}
              </ButtonBar>
            )}
          </Access>
        </Footer>
      </Fragment>
    );
  }

  render() {
    const {Header} = this.props;
    const {askTeammate} = this.state;
    const header = askTeammate ? t('Tell a Teammate') : t('Try Sentry for Mobile');
    return (
      <Fragment>
        <Header>
          <PatternHeader />
          <Title>{header}</Title>
        </Header>
        {this.state.askTeammate ? this.renderAskTeammate() : this.renderMain()}
      </Fragment>
    );
  }
}

const ModalContainer = styled('div')`
  display: grid;
  gap: ${space(3)};

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
  }
`;

const BackWrapper = styled('div')`
  width: 100%;
  margin-right: ${space(1)};
`;

const StyledBackButton = styled(Button)`
  float: right;
`;

export default withApi(SuggestProjectModal);
