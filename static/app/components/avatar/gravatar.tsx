import {useCallback, useEffect, useState} from 'react';
import styled from '@emotion/styled';
import type HasherHelper from 'crypto-js/md5';
import * as qs from 'query-string';

import ConfigStore from 'sentry/stores/configStore';
import {useIsMountedRef} from 'sentry/utils/useIsMountedRef';

import type {ImageStyleProps} from './styles';
import {imageStyle} from './styles';

type Props = {
  remoteSize: number;
  gravatarId?: string;
  onError?: () => void;
  onLoad?: () => void;
  placeholder?: string;
} & ImageStyleProps;

type HasherHelper = typeof import('crypto-js/sha256');

function Gravatar({
  remoteSize,
  gravatarId,
  placeholder,
  round,
  onError,
  onLoad,
  suggested,
}: Props) {
  const isMountedRef = useIsMountedRef();
  const [SHA256, setSHA256] = useState<typeof HasherHelper>();

  const loadSHA256Helper = useCallback(async () => {
    const mod = await import('crypto-js/sha256');

    if (isMountedRef.current) {
      // XXX: Use function invocation of `useState`s setter since the mod.default
      // is a function itself.
      setSHA256(() => mod.default);
    }
  }, [isMountedRef]);

  useEffect(() => {
    loadSHA256Helper();
  }, [loadSHA256Helper]);

  if (SHA256 === undefined) {
    return null;
  }

  const query = qs.stringify({
    s: remoteSize,
    // If gravatar is not found we need the request to return an error,
    // otherwise error handler will not trigger and avatar will not have a display a LetterAvatar backup.
    d: placeholder ?? '404',
  });

  const gravatarBaseUrl = ConfigStore.get('gravatarBaseUrl');

  const sha256 = SHA256((gravatarId ?? '').trim());
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
