import {Flex} from 'grid-emotion';
import {withRouter} from 'react-router';
import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import {t, tct} from 'app/locale';
import Button from 'app/components/buttons/button';
import Text from 'app/components/text';
import recreateRoute from 'app/utils/recreateRoute';

class RedirectToProjectModal extends React.Component {
  static propTypes = {
    /**
     * New slug to redirect to
     */
    slug: PropTypes.string.isRequired,

    Header: PropTypes.oneOfType([PropTypes.func, PropTypes.node]).isRequired,
    Body: PropTypes.oneOfType([PropTypes.func, PropTypes.node]).isRequired,
  };

  constructor(props) {
    super(props);

    this.state = {
      timer: 5,
    };
  }

  componentDidMount() {
    setInterval(() => {
      if (this.state.timer <= 1) {
        window.location.assign(this.getNewPath());
        return;
      }

      this.setState(state => ({
        timer: state.timer - 1,
      }));
    }, 1000);
  }

  getNewPath() {
    let {params, slug} = this.props;

    return recreateRoute('', {
      ...this.props,
      params: {
        ...params,
        projectId: slug,
      },
    });
  }

  render() {
    let {slug, Header, Body} = this.props;
    return (
      <React.Fragment>
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
                <Button priority="primary" href={this.getNewPath()}>
                  {t('Continue to %s', slug)}
                </Button>
              </ButtonWrapper>
            </Text>
          </div>
        </Body>
      </React.Fragment>
    );
  }
}

export default withRouter(RedirectToProjectModal);
export {RedirectToProjectModal};

const ButtonWrapper = styled(Flex)`
  justify-content: flex-end;
`;
