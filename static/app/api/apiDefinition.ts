type KnownApiUrls = ['/projects/$orgSlug/$projectSlug/releases/$releaseVersion/'];

export type ApiMapping = Record<KnownApiUrls[number], never>;
export type ApiPath = keyof ApiMapping;
// adding a union with string & {} enables auto-completion
export type MaybeApiPath = ApiPath | (string & {});
