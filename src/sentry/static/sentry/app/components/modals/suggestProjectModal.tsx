import React from 'react';
import styled from '@emotion/styled';

import bgPattern from 'sentry-images/spot/mobile-hero.jpg';

import List from 'app/components/list';
import ListItem from 'app/components/list/listItem';
import {ModalRenderProps} from 'app/actionCreators/modal';
import {Client} from 'app/api';
import Button from 'app/components/button';
import ButtonBar from 'app/components/buttonBar';
import {t, tct} from 'app/locale';
import space from 'app/styles/space';
import {Organization} from 'app/types';
import withApi from 'app/utils/withApi';

type Props = ModalRenderProps & {
  api: Client;
  organization: Organization;
};

type State = {};

class SuggestProjectModal extends React.Component<Props, State> {
  state: State = {};

  render() {
    const {Header, Body, Footer, organization} = this.props;

    const newProjectLink = `/organizations/${organization.slug}/projects/new/`;

    return (
      <React.Fragment>
        <Header>
          <PatternHeader />
          <Title>{t('Try Sentry for Mobile')}</Title>
        </Header>
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
            <Button href={newProjectLink} priority="primary">
              {t('Get Started')}
            </Button>
            <Button>{t('Ask Teammate')}</Button>
          </ButtonBar>
        </Footer>
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
  margin-bottom: ${space(2)};
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
