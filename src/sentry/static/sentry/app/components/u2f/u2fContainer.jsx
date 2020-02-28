import React from 'react';

import {Client} from 'app/api';

import U2fSign from './u2fsign';

class U2fContainer extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      authenticators: null,
    };
    this.api = new Client();
  }

  componentDidMount() {
    this.api
      .requestPromise('/authenticators/')
      .then(resp => {
        this.setState({
          authenticators: resp || [],
        });
      })
      .catch(() => {
        // ignore errors
      });
  }

  componentWillUnmount() {
    this.api.clear();
    this.api = null;
  }

  render() {
    const {className, authenticators} = this.state;
    if (authenticators && authenticators.length) {
      return (
        <div className={className}>
          {authenticators.map(({id, ...other}) => {
            if (id === 'u2f' && other.challenge) {
              return <U2fSign key={id} {...this.props} challengeData={other.challenge} />;
            }

            return null;
          })}
        </div>
      );
    }

    return null;
  }
}

export default U2fContainer;
