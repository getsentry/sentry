import * as Sentry from '@sentry/react';
import {useQuery} from '@tanstack/react-query';
import * as qs from 'query-string';

import {useAvatar as useGenericAvatar} from '@sentry/scraps/avatar';

import {ConfigStore} from 'sentry/stores/configStore';

type GravatarDefinition = {gravatarId: string; type: 'gravatar'};
type UploadDefinition = {type: 'upload'; uploadUrl: string};
type ImageDefinition = GravatarDefinition | UploadDefinition;

export function useAvatar(options: {
  identifier: string;
  name: string;
  imageDefinition?: ImageDefinition;
}) {
  const src = useAvatarImageUrl(options.imageDefinition);
  return useGenericAvatar({
    identifier: options.identifier,
    name: options.name,
    initials: getAvatarInitialsOverride(options.name),
    src: src ?? undefined,
  });
}

const DEFAULT_REMOTE_SIZE = 120;

/**
 * Appends size parameter to uploaded avatar URLs for optimization.
 * Skips data URLs which are already base64 encoded.
 */
function buildUploadUrl(url: string): string {
  if (url.startsWith('data:')) {
    return url;
  }
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}s=${DEFAULT_REMOTE_SIZE}`;
}

export function useAvatarImageUrl(definition?: ImageDefinition): string | null {
  const trimmedGravatarId =
    definition?.type === 'gravatar' ? definition.gravatarId.trim() : '';

  const {data: avatarHash} = useQuery({
    queryKey: ['gravatar', trimmedGravatarId],
    queryFn: () => {
      if (!trimmedGravatarId || window.crypto?.subtle?.digest === undefined) {
        return null;
      }
      return hashGravatarId(trimmedGravatarId).catch(err => {
        Sentry.withScope(scope => {
          scope.setFingerprint(['gravatar-hash-error']);
          Sentry.captureException(err);
        });
        return null;
      });
    },
    retry: 0,
    staleTime: Infinity,
    networkMode: 'always',
  });

  const gravatarHash = avatarHash ?? null;

  const resolvedSrc = definition
    ? definition.type === 'gravatar'
      ? gravatarHash
        ? `${ConfigStore.get('gravatarBaseUrl')}/avatar/${gravatarHash}?${qs.stringify({
            // Default remote size to 120px
            s: 120,
            // If gravatar is not found we need the request to return an error,
            // otherwise error handler will not trigger and avatar will not display a LetterAvatar backup.
            d: '404',
          })}`
        : null
      : buildUploadUrl(definition.uploadUrl) || null
    : null;

  return resolvedSrc;
}

/**
 * Hashes a gravatar identifier using SHA-256.
 * Gravatars require HTTPS to work.
 */
async function hashGravatarId(gravatarId: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(gravatarId);
  const hash = await window.crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Keep the application's scrubbed-name convention out of generic presentation. */
export function getAvatarInitialsOverride(name: string | undefined): string | undefined {
  return name?.trim() === '[Filtered]' ? '?' : undefined;
}
