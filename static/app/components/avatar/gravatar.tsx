import {useCallback, useEffect, useState} from 'react';
import styled from '@emotion/styled';
import * as qs from 'query-string';

import ConfigStore from 'sentry/stores/configStore';
import {useIsMountedRef} from 'sentry/utils/useIsMountedRef';

import {imageStyle, ImageStyleProps} from './styles';

type Props = {
  remoteSize: number;
  gravatarId?: string;
  onError?: () => void;
  onLoad?: () => void;
  placeholder?: string;
} & ImageStyleProps;

type HasherHelper = typeof import('crypto-js/md5');

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
  const [MD5, setMD5] = useState<HasherHelper>();

  const loadMd5Helper = useCallback(async () => {
    const mod = await import('crypto-js/md5');

    if (isMountedRef.current) {
      // XXX: Use function invocation of `useState`s setter since the mod.default
      // is a function itself.
      setMD5(() => mod.default);
    }
  }, [isMountedRef]);

  useEffect(() => {
    loadMd5Helper();
  }, [loadMd5Helper]);

  if (MD5 === undefined) {
    return null;
  }

  const query = qs.stringify({
    s: remoteSize,
    // If gravatar is not found we need the request to return an error,
    // otherwise error handler will not trigger and avatar will not have a display a LetterAvatar backup.
    d: placeholder ?? '404',
  });

  const gravatarBaseUrl = ConfigStore.get('gravatarBaseUrl');

  const md5 = MD5(gravatarId ?? '');
  const url = `${gravatarBaseUrl}/avatar/${md5}?${query}`;

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
