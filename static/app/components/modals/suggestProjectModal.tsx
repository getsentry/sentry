import {Fragment, useState} from 'react';
import styled from '@emotion/styled';
import * as qs from 'query-string';

import bgPattern from 'sentry-images/spot/mobile-hero.jpg';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import type {Client} from 'sentry/api';
import Access from 'sentry/components/acl/access';
import {Button, LinkButton} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import EmailField from 'sentry/components/forms/fields/emailField';
import Form from 'sentry/components/forms/form';
import List from 'sentry/components/list';
import ListItem from 'sentry/components/list/listItem';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import {trackAnalytics} from 'sentry/utils/analytics';
import withApi from 'sentry/utils/withApi';

type Props = ModalRenderProps & {
  api: Client;
  matchedUserAgentString: string;
  organization: Organization;
};

function SuggestProjectModal(props: Props) {
  const [askTeammate, setAskTeammate] = useState<boolean>(false);
  const {matchedUserAgentString, organization, closeModal, Body, Header, Footer} = props;

  const handleGetStartedClick = () => {
    trackAnalytics('growth.clicked_mobile_prompt_setup_project', {
      matchedUserAgentString,
      organization,
    });
  };

  const handleAskTeammate = () => {
    setAskTeammate(true);
    trackAnalytics('growth.clicked_mobile_prompt_ask_teammate', {
      matchedUserAgentString,
      organization,
    });
  };

  const goBack = () => {
    setAskTeammate(false);
  };

  const handleSubmitSuccess = () => {
    addSuccessMessage('Notified teammate successfully');
    trackAnalytics('growth.submitted_mobile_prompt_ask_teammate', {
      matchedUserAgentString,
      organization,
    });
    closeModal();
  };

  const handlePreSubmit = () => {
    addLoadingMessage(t('Submitting\u2026'));
  };

  const handleSubmitError = () => {
    addErrorMessage(t('Error notifying teammate'));
  };

  const renderAskTeammate = () => {
    return (
      <Body>
        <Form
          apiEndpoint={`/organizations/${organization.slug}/request-project-creation/`}
          apiMethod="POST"
          submitLabel={t('Send')}
          onSubmitSuccess={handleSubmitSuccess}
          onSubmitError={handleSubmitError}
          onPreSubmit={handlePreSubmit}
          extraButton={
            <BackWrapper>
              <StyledBackButton onClick={goBack}>{t('Back')}</StyledBackButton>
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
  };

  const renderMain = () => {
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
          <Access access={['project:write']}>
            {({hasAccess}) => (
              <ButtonBar gap={1}>
                <Button
                  priority={hasAccess ? 'default' : 'primary'}
                  onClick={handleAskTeammate}
                >
                  {t('Tell a Teammate')}
                </Button>
                {hasAccess && (
                  <LinkButton
                    href={newProjectLink}
                    onClick={handleGetStartedClick}
                    priority="primary"
                  >
                    {t('Get Started')}
                  </LinkButton>
                )}
              </ButtonBar>
            )}
          </Access>
        </Footer>
      </Fragment>
    );
  };

  const header = askTeammate ? t('Tell a Teammate') : t('Try Sentry for Mobile');
  return (
    <Fragment>
      <Header>
        <PatternHeader />
        <Title>{header}</Title>
      </Header>
      {askTeammate ? renderAskTeammate() : renderMain()}
    </Fragment>
  );
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
