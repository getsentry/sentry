import React from 'react';
import PropTypes from 'prop-types';
import {Flex} from 'grid-emotion';
import styled from 'react-emotion';

import {t} from '../../locale';
import img from '../../../images/dashboard/hair-on-fire.svg';
import Button from '../../components/buttons/button';

export default class EmptyState extends React.Component {
  static propTypes = {
    orgId: PropTypes.string,
  };

  render() {
    const {orgId} = this.props;
    return (
      <Flex flex="1" align="center" justify="center">
        <Wrapper>
          <img src={img} height={350} alt="Nothing to see" />
          <Content direction="column" justify="center">
            <h2>{t('Remain calm.')}</h2>
            <p>{t("Sentry's got you covered.")}</p>
            <div>
              <Button priority="primary" to={`organizations/${orgId}/projects/new/`}>
                {t('Create project')}
              </Button>
            </div>
          </Content>
        </Wrapper>
      </Flex>
    );
  }
}

const Wrapper = styled(Flex)`
  height: 350px;
`;

const Content = styled(Flex)`
  margin-left: 40px;
`;
