import type {Release} from 'sentry/types/release';

type ApiDefinition = [
  ['/projects/$orgSlug/$projectSlug/releases/$releaseVersion/', Release],
];

export type ApiMapping = {
  [K in ApiDefinition[number] as K[0]]: K[1];
};

export type ApiPath = keyof ApiMapping;

// adding a union with string & {} enables auto-completion
export type MaybeApiPath = ApiPath | (string & {});
