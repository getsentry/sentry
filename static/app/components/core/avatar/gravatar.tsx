import {useEffect, useState} from 'react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';
import * as qs from 'query-string';

import ConfigStore from 'sentry/stores/configStore';

import {type BaseAvatarStyleProps, baseAvatarStyles} from './baseAvatarComponentStyles';

interface GravatarProps extends BaseAvatarStyleProps {
  remoteSize: number;
  gravatarId?: string;
  onError?: () => void;
  onLoad?: () => void;
  placeholder?: string;
  ref?: React.Ref<HTMLImageElement>;
}

export function Gravatar({
  ref,
  remoteSize,
  gravatarId,
  placeholder,
  round,
  onError,
  onLoad,
  suggested,
}: GravatarProps) {
  const [sha256, setSha256] = useState<string | null>(null);
  useEffect(() => {
    if (!isCryptoSubtleDigestAvailable()) {
      return;
    }

    hashGravatarId((gravatarId ?? '').trim())
      .then(hash => {
        setSha256(hash);
      })
      .catch((err: any) => {
        // If there is an error with the hash, we should not render the gravatar
        setSha256(null);

        Sentry.withScope(scope => {
          scope.setFingerprint(['gravatar-hash-error']);
          Sentry.captureException(err);
        });
      });
  }, [gravatarId]);

  if (!sha256) {
    // @TODO(jonasbadalic): Do we need a placeholder here?
    return null;
  }

  const query = qs.stringify({
    s: remoteSize,
    // If gravatar is not found we need the request to return an error,
    // otherwise error handler will not trigger and avatar will not have a display a LetterAvatar backup.
    d: placeholder ?? '404',
  });

  return (
    <Image
      ref={ref}
      round={round}
      src={`${ConfigStore.get('gravatarBaseUrl')}/avatar/${sha256}?${query}`}
      onLoad={onLoad}
      onError={onError}
      suggested={suggested}
    />
  );
}

function isCryptoSubtleDigestAvailable() {
  return (
    !!window.crypto &&
    !!window.crypto.subtle &&
    typeof window.crypto.subtle.digest === 'function'
  );
}

/**
 * Available only in secure contexts. (https)
 * Gravatar will not work in http
 */
async function hashGravatarId(message = ''): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hash = await window.crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

const Image = styled('img')<BaseAvatarStyleProps>`
  ${baseAvatarStyles};
`;
