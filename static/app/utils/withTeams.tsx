import {Team} from 'sentry/types';
import getDisplayName from 'sentry/utils/getDisplayName';
import useTeams from 'sentry/utils/useTeams';

type InjectedTeamsProps = {
  teams?: Team[];
};

/**
 * Higher order component that provides a list of teams
 *
 * @deprecated Prefer `useTeams` or `<Teams />`.
 */
const withTeams = <P extends InjectedTeamsProps>(
  WrappedComponent: React.ComponentType<P>
) => {
  function WithTeams(props: Omit<P, keyof InjectedTeamsProps> & InjectedTeamsProps) {
    const {teams} = useTeams();
    return <WrappedComponent teams={teams} {...(props as P)} />;
  }

  WithTeams.displayName = `withTeams(${getDisplayName(WrappedComponent)})`;

  return WithTeams;
};

export default withTeams;
