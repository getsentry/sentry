import Redirect from 'sentry/components/redirect';
import type {RouteComponentProps} from 'sentry/types/legacyReactRouter';
import {useRedirectNavV2Routes} from 'sentry/views/nav/useRedirectNavV2Routes';

type Props = RouteComponentProps & {
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
