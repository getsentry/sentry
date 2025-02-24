import {useRedirectNavV2Routes} from 'sentry/components/nav/useRedirectNavV2Routes';
import Redirect from 'sentry/components/redirect';

import {GettingStartedWithProjectContextProvider} from './gettingStartedWithProjectContext';

type Props = {
  children: React.ReactNode;
};

export default function Projects({children}: Props) {
  const redirectPath = useRedirectNavV2Routes({
    oldPathPrefix: '/projects/',
    newPathPrefix: '/insights/projects/',
  });

  if (redirectPath) {
    return <Redirect to={redirectPath} />;
  }

  return (
    <GettingStartedWithProjectContextProvider>
      {children}
    </GettingStartedWithProjectContextProvider>
  );
}
