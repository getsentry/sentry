import {Fragment} from 'react';

import {useTeams} from 'sentry/utils/useTeams';

type RenderProps = ReturnType<typeof useTeams>;

type Props = Parameters<typeof useTeams>[0] & {
  children: (props: RenderProps) => React.ReactNode;
};

/**
 * This is a utility component to leverage the useTeams hook to provide
 * a render props component which returns teams through a variety of inputs
 * such as a list of slugs or user teams.
 */
function Teams({children, ...props}: Props) {
  const renderProps = useTeams(props);

  return <Fragment>{children(renderProps)}</Fragment>;
}

export default Teams;
