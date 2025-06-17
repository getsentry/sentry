import Redirect from 'sentry/components/redirect';
import {useRedirectNavV2Routes} from 'sentry/views/nav/useRedirectNavV2Routes';

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

  return children;
}
