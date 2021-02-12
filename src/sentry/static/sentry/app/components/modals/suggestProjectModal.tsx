import React from 'react';
import styled from '@emotion/styled';

import {ModalRenderProps} from 'app/actionCreators/modal';
import {Client} from 'app/api';
import Button from 'app/components/button';
import ButtonBar from 'app/components/buttonBar';
import PatternHeader from 'app/components/patternHeader';
import {IconBusiness} from 'app/icons';
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
    const {Header, Body, Footer} = this.props;

    const newProjectLink = `/organi`;

    return (
      <React.Fragment>
        <Header>
          <PatternHeader />
          <Title>
            <HeaderPowerIcon gradient withShine size="1.4em" />
            <h3>{t('Try Sentry for Mobile')}</h3>
          </Title>
        </Header>
        <Body>
          <ModalContainer>
            <SmallP>
              {t(
                "Sentry for Mobile shows a holistic overview of your application's health in real time. So you can correlate errors with releases, tags, and devices to solve problems quickly, decrease churn, and improve user retention."
              )}
            </SmallP>
            <SmallUl>
              <li>
                {tct(
                  '[see:See] session data, version adoption, and user impact by every release.',
                  {
                    see: <strong />,
                  }
                )}
              </li>
              <li>
                {tct(
                  '[solve:Solve] issues quickly with full context: contextualized stack traces, events that lead to the error, client, hardware information, and the very commit that introduced the error.',
                  {
                    solve: <strong />,
                  }
                )}
              </li>
              <li>
                {tct(
                  '[learn:Learn] and analyze event data to reduce regressions and ultimately improve user adoption and engagement.',
                  {
                    learn: <strong />,
                  }
                )}
              </li>
            </SmallUl>
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

const Title = styled('div')`
  display: flex;
  align-items: center;
  font-size: 1.6em;
  margin-top: ${space(2)};
`;

const HeaderPowerIcon = styled(IconBusiness)`
  margin-right: ${space(1)};
`;

const SmallP = styled('p')`
  margin: 0;
`;

const SmallUl = styled('ul')`
  margin: 0;
`;

export default withApi(SuggestProjectModal);
