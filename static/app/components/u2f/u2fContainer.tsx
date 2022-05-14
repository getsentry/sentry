import {Component} from 'react';

import {Authenticator} from 'sentry/types';

import U2fSign from './u2fsign';

type U2FSignProps = React.ComponentProps<typeof U2fSign>;

type Props = {
  authenticators: Array<Authenticator>;
  onTap: U2FSignProps['onTap'];
  className?: string;
  displayMode?: U2FSignProps['displayMode'];
};

class U2fContainer extends Component<Props> {
  render() {
    const {className, authenticators} = this.props;

    if (!authenticators.length) {
      return null;
    }

    return (
      <div className={className}>
        {authenticators.map(auth =>
          auth.id === 'u2f' && auth.challenge ? (
            <U2fSign key={auth.id} {...this.props} challengeData={auth.challenge} />
          ) : null
        )}
      </div>
    );
  }
}

export default U2fContainer;
