import React from 'react';
import styled from '@emotion/styled';
import isEmpty from 'lodash/isEmpty';
import mapKeys from 'lodash/mapKeys';
import startCase from 'lodash/startCase';
import moment from 'moment';

import Button from 'app/components/button';
import KeyValueList from 'app/components/events/interfaces/keyValueList/keyValueList';
import ListItem from 'app/components/list/listItem';
import {t} from 'app/locale';
import space from 'app/styles/space';

type Error = {
  type: string;
  message: React.ReactNode;
  data?: {
    name?: string;
    message?: string;
    image_path?: string;
    image_name?: string;
    server_time?: string;
    sdk_time?: string;
    url?: string;
  } & Record<string, any>;
};

const keyMapping = {
  image_uuid: 'Debug ID',
  image_name: 'File Name',
  image_path: 'File Path',
};

type Props = {
  error: Error;
};

type State = {
  isOpen: boolean;
};

class ErrorItem extends React.Component<Props, State> {
  state: State = {
    isOpen: false,
  };

  shouldComponentUpdate(_nextProps: Props, nextState: State) {
    return this.state.isOpen !== nextState.isOpen;
  }

  handleToggle = () => {
    this.setState({isOpen: !this.state.isOpen});
  };

  cleanedData(errorData: NonNullable<Error['data']>) {
    const data = {...errorData};

    // The name is rendered as path in front of the message
    if (typeof data.name === 'string') {
      delete data.name;
    }

    if (data.message === 'None') {
      // Python ensures a message string, but "None" doesn't make sense here
      delete data.message;
    }

    if (typeof data.image_path === 'string') {
      // Separate the image name for readability
      const separator = /^([a-z]:\\|\\\\)/i.test(data.image_path) ? '\\' : '/';
      const path = data.image_path.split(separator);
      data.image_name = path.splice(-1, 1)[0];
      data.image_path = path.length ? path.join(separator) + separator : '';
    }

    if (typeof data.server_time === 'string' && typeof data.sdk_time === 'string') {
      data.message = t(
        'Adjusted timestamps by %s',
        moment
          .duration(moment.utc(data.server_time).diff(moment.utc(data.sdk_time)))
          .humanize()
      );
    }

    return mapKeys(data, (_value, key) => t(keyMapping[key] || startCase(key)));
  }

  renderPath(data: NonNullable<Error['data']>) {
    const {name} = data;

    if (!name || typeof name !== 'string') {
      return null;
    }

    return (
      <React.Fragment>
        <strong>{name}</strong>
        {': '}
      </React.Fragment>
    );
  }

  render() {
    const {error} = this.props;
    const {isOpen} = this.state;

    const data = error?.data ?? {};
    const cleanedData = this.cleanedData(data);

    return (
      <StyledListItem>
        <OverallInfo>
          <div>
            {this.renderPath(data)}
            {error.message}
          </div>
          {!isEmpty(cleanedData) && (
            <ToggleButton onClick={this.handleToggle} priority="link">
              {isOpen ? t('Collapse') : t('Expand')}
            </ToggleButton>
          )}
        </OverallInfo>
        {isOpen && <KeyValueList data={cleanedData} isContextData />}
      </StyledListItem>
    );
  }
}

export default ErrorItem;

const ToggleButton = styled(Button)`
  margin-left: ${space(1.5)};
  font-weight: 700;
  color: ${p => p.theme.subText};
  :hover,
  :focus {
    color: ${p => p.theme.textColor};
  }
`;

const StyledListItem = styled(ListItem)`
  margin-bottom: ${space(0.75)};
`;

const OverallInfo = styled('div')`
  display: grid;
  grid-template-columns: repeat(2, minmax(auto, max-content));
  word-break: break-all;
`;
