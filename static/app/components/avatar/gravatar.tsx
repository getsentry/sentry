import {useEffect, useState} from 'react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';
import * as qs from 'query-string';

import ConfigStore from 'sentry/stores/configStore';

import type {ImageStyleProps} from './styles';
import {imageStyle} from './styles';

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

type Props = {
  remoteSize: number;
  gravatarId?: string;
  onError?: () => void;
  onLoad?: () => void;
  placeholder?: string;
} & ImageStyleProps;

function Gravatar({
  remoteSize,
  gravatarId,
  placeholder,
  round,
  onError,
  onLoad,
  suggested,
}: Props) {
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
    return null;
  }

  const query = qs.stringify({
    s: remoteSize,
    // If gravatar is not found we need the request to return an error,
    // otherwise error handler will not trigger and avatar will not have a display a LetterAvatar backup.
    d: placeholder ?? '404',
  });

  const gravatarBaseUrl = ConfigStore.get('gravatarBaseUrl');

  const url = `${gravatarBaseUrl}/avatar/${sha256}?${query}`;

  return (
    <Image
      round={round}
      src={url}
      onLoad={onLoad}
      onError={onError}
      suggested={suggested}
    />
  );
}

export default Gravatar;

const Image = styled('img')<ImageStyleProps>`
  ${imageStyle};
`;
