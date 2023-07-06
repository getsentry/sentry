import {useFlamegraphPreferences} from 'sentry/domains/profiling/hooks/useFlamegraphPreferences';
import {ProfileGroupProvider} from 'sentry/domains/profiling/providers/profileGroupProvider';

// This only exists because we need to call useFlamegraphPreferences
// to get the type of visualization that the user is looking at and
// we cannot do it in the component above as it is not a child of the
// FlamegraphStateProvider.
export function ProfileGroupTypeProvider({
  children,
  input,
  traceID,
}: {
  children: React.ReactNode;
  input: Profiling.ProfileInput | null;
  traceID: string;
}) {
  const preferences = useFlamegraphPreferences();
  return (
    <ProfileGroupProvider
      input={input}
      traceID={traceID}
      type={preferences.sorting === 'call order' ? 'flamechart' : 'flamegraph'}
    >
      {children}
    </ProfileGroupProvider>
  );
}
