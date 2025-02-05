import {useRedirectNavV2Routes} from 'sentry/components/nav/useRedirectNavV2Routes';
import Redirect from 'sentry/components/redirect';
import type {RouteComponentProps} from 'sentry/types/legacyReactRouter';

type Props = RouteComponentProps<{}, {}> & {
  children: React.ReactNode;
};

export default function ReleasesContainer({children}: Props) {
  const redirectPath = useRedirectNavV2Routes({
    oldPathPrefix: '/releases/',
    newPathPrefix: '/explore/releases/',
  });

  if (redirectPath) {
    return <Redirect to={redirectPath} />;
  }

  return children;
}
