import {Authenticator} from 'sentry/types';

import U2fSign from './u2fsign';

type Props = {
  authenticators: Array<Authenticator>;
  onTap: U2fSign['props']['onTap'];
  className?: string;
  displayMode?: U2fSign['props']['displayMode'];
};

function U2fContainer({className, authenticators, ...props}: Props) {
  if (!authenticators.length) {
    return null;
  }

  return (
    <div className={className}>
      {authenticators.map(auth =>
        auth.id === 'u2f' && auth.challenge ? (
          <U2fSign key={auth.id} {...props} challengeData={auth.challenge} />
        ) : null
      )}
    </div>
  );
}

export default U2fContainer;
