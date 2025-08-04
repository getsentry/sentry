type KnownApiUrls = ['/projects/$orgSlug/$projectSlug/releases/$releaseVersion/'];

type ApiMapping = Record<KnownApiUrls[number], never>;
type ApiPath = keyof ApiMapping;
// adding a union with string & {} enables auto-completion
export type MaybeApiPath = ApiPath | (string & {});
