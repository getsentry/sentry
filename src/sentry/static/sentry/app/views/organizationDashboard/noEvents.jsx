import React from 'react';
import PropTypes from 'prop-types';
import styled from 'react-emotion';
import {Flex} from 'grid-emotion';

import Button from 'app/components/buttons/button';

import {t} from 'app/locale';

export default class NoEvents extends React.Component {
  static propTypes = {
    projectId: PropTypes.string,
    orgId: PropTypes.string,
    platformId: PropTypes.string,
  };
  render() {
    const {orgId, projectId, platformId} = this.props;
    const link = `/${orgId}/${projectId}/getting-started/${platformId
      ? platformId + '/'
      : ''}`;

    return (
      <Background align="center" justify="center">
        <Button size="small" to={link}>
          {t('Configure project')}
        </Button>
      </Background>
    );
  }
}

const Background = styled(Flex)`
  height: 80px;
  background-color: rgba(175, 163, 187, 0.1);
  margin-left: 4px;
  margin-right: 4px;
`;
