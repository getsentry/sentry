type KnownApiUrls = ['/projects/$orgSlug/$projectSlug/releases/$releaseVersion/'];

export type MaybeApiPath = KnownApiUrls[number] | (string & {});
