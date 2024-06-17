import type {Authenticator} from 'sentry/types';

import U2fSign from './u2fsign';

type U2FSignProps = React.ComponentProps<typeof U2fSign>;

type Props = {
  authenticators: Array<Authenticator>;
  onTap: U2FSignProps['onTap'];
  className?: string;
  displayMode?: U2FSignProps['displayMode'];
};

function U2fContainer({className, authenticators, ...props}: Props) {
  if (!authenticators.length) {
    return null;
  }

  return (
    <div className={className}>
      {authenticators.map(auth =>
        auth.id === 'u2f' && auth.challenge ? (
          <U2fSign
            key={auth.id}
            onTap={props.onTap}
            displayMode={props.displayMode}
            challengeData={auth.challenge}
            authStateData={auth.authState}
          />
        ) : null
      )}
    </div>
  );
}

export default U2fContainer;
