import React from 'react';

import {Client} from 'app/api';
import {Authenticator} from 'app/types';
import withApi from 'app/utils/withApi';

import U2fSign from './u2fsign';

type Props = {
  api: Client;
  onTap: U2fSign['props']['onTap'];
  displayMode?: U2fSign['props']['displayMode'];
  className?: string;
};
type State = {
  authenticators: Array<Authenticator>;
};

class U2fContainer extends React.Component<Props, State> {
  state: State = {
    authenticators: [],
  };
  componentDidMount() {
    this.getAuthenticators();
  }

  async getAuthenticators() {
    const {api} = this.props;

    try {
      const authenticators = await api.requestPromise('/authenticators/');
      this.setState({authenticators: authenticators ?? []});
    } catch {
      // ignore errors
    }
  }

  render() {
    const {className} = this.props;
    const {authenticators} = this.state;

    if (!authenticators.length) {
      return null;
    }

    return (
      <div className={className}>
        {authenticators.map(({id, ...other}) => {
          if (id === 'u2f' && other.challenge) {
            return (
              <U2fSign
                key={id}
                {...this.props}
                challengeData={other.challenge as U2fSign['props']['challengeData']}
              />
            );
          }
          return null;
        })}
      </div>
    );
  }
}

export default withApi(U2fContainer);
