import {Component, Fragment} from 'react';
import styled from '@emotion/styled';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {LinkButton} from 'sentry/components/button';
import Text from 'sentry/components/text';
import {t, tct} from 'sentry/locale';
import type {WithRouterProps} from 'sentry/types/legacyReactRouter';
import recreateRoute from 'sentry/utils/recreateRoute';
// eslint-disable-next-line no-restricted-imports
import withSentryRouter from 'sentry/utils/withSentryRouter';

type Props = ModalRenderProps &
  WithRouterProps & {
    slug: string;
  };

type State = {
  timer: number;
};

class RedirectToProjectModal extends Component<Props, State> {
  state: State = {
    timer: 5,
  };

  componentDidMount() {
    this.redirectInterval = window.setInterval(() => {
      if (this.state.timer <= 1) {
        window.location.assign(this.newPath);
        return;
      }

      this.setState(state => ({
        timer: state.timer - 1,
      }));
    }, 1000);
  }

  componentWillUnmount() {
    if (this.redirectInterval) {
      window.clearInterval(this.redirectInterval);
    }
  }

  redirectInterval: number | null = null;

  get newPath() {
    const {params, slug} = this.props;

    return recreateRoute('', {
      ...this.props,
      params: {
        ...params,
        projectId: slug,
      },
    });
  }

  render() {
    const {slug, Header, Body} = this.props;
    return (
      <Fragment>
        <Header>{t('Redirecting to New Project...')}</Header>

        <Body>
          <div>
            <Text>
              <p>{t('The project slug has been changed.')}</p>

              <p>
                {tct(
                  'You will be redirected to the new project [project] in [timer] seconds...',
                  {
                    project: <strong>{slug}</strong>,
                    timer: `${this.state.timer}`,
                  }
                )}
              </p>
              <ButtonWrapper>
                <LinkButton priority="primary" href={this.newPath}>
                  {t('Continue to %s', slug)}
                </LinkButton>
              </ButtonWrapper>
            </Text>
          </div>
        </Body>
      </Fragment>
    );
  }
}

export default withSentryRouter(RedirectToProjectModal);
export {RedirectToProjectModal};

const ButtonWrapper = styled('div')`
  display: flex;
  justify-content: flex-end;
`;
