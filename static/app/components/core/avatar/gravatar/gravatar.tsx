import {useEffect, useState} from 'react';
import * as Sentry from '@sentry/react';
import * as qs from 'query-string';

import {ImageAvatar} from '@sentry/scraps/avatar/imageAvatar/imageAvatar';

import ConfigStore from 'sentry/stores/configStore';

// eslint-disable-next-line no-relative-import-paths/no-relative-import-paths
import {type BaseAvatarStyleProps} from '../avatarComponentStyles';
// eslint-disable-next-line no-relative-import-paths/no-relative-import-paths
import {type ImageAvatarProps} from '../imageAvatar/imageAvatar';
// eslint-disable-next-line no-relative-import-paths/no-relative-import-paths
import {LetterAvatar} from '../letterAvatar/letterAvatar';

/**
 * Note that avatars currently do not support refs. This is because they are only exposed
 * through the main Avatar component, which wraps the avatar in a container element, and has
 * histrically hijacked the ref and attached it to the container element, and we would need
 * to eliminate the wrapper before we can enable ref support.
 */
export interface GravatarProps
  extends BaseAvatarStyleProps, Omit<ImageAvatarProps, 'src' | 'identifier'> {
  gravatarId: string;
}

export function Gravatar({gravatarId, ...props}: GravatarProps) {
  const avatarHash = useGravatarHash(gravatarId);

  if (avatarHash === null) {
    return <LetterAvatar identifier={gravatarId} {...props} />;
  }

  return (
    <ImageAvatar
      identifier={gravatarId}
      {...props}
      src={`${ConfigStore.get('gravatarBaseUrl')}/avatar/${avatarHash}?${qs.stringify({
        // Default remote size to 120px
        s: 120,
        // If gravatar is not found we need the request to return an error,
        // otherwise error handler will not trigger and avatar will not display a LetterAvatar backup.
        d: '404',
      })}`}
    />
  );
}

function useGravatarHash(gravatarId: string) {
  const [avatarHash, setAvatarHash] = useState<string | null>(null);

  useEffect(() => {
    const trimmedGravatarId = gravatarId.trim();
    if (!trimmedGravatarId || typeof window.crypto?.subtle?.digest === 'undefined') {
      setAvatarHash(null);
      return;
    }

    hashGravatarId(trimmedGravatarId)
      .then(hash => setAvatarHash(hash))
      .catch(error => {
        setAvatarHash(null);
        Sentry.withScope(scope => {
          scope.setFingerprint(['gravatar-hash-error']);
          Sentry.captureException(error);
        });
      });
  }, [gravatarId]);

  return avatarHash;
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
