import {Component, Fragment} from 'react';

import {Flex} from '@sentry/scraps/layout';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import {Text} from 'sentry/components/core/text';
import {t, tct} from 'sentry/locale';
import type {WithRouterProps} from 'sentry/types/legacyReactRouter';
import recreateRoute from 'sentry/utils/recreateRoute';
import {testableWindowLocation} from 'sentry/utils/testableWindowLocation';
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
        testableWindowLocation.assign(this.newPath);
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
            <Text>{t('The project slug has been changed.')}</Text>

            <Text>
              {tct(
                'You will be redirected to the new project [project] in [timer] seconds...',
                {
                  project: <strong>{slug}</strong>,
                  timer: `${this.state.timer}`,
                }
              )}
            </Text>
            <Flex justify="end">
              <LinkButton priority="primary" href={this.newPath}>
                {t('Continue to %s', slug)}
              </LinkButton>
            </Flex>
          </div>
        </Body>
      </Fragment>
    );
  }
}

export default withSentryRouter(RedirectToProjectModal);
export {RedirectToProjectModal};
