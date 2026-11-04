import {Avatar as GenericAvatar, type AvatarProps} from '@sentry/scraps/avatar';

import {getAvatarInitialsOverride, useAvatarImageUrl} from './useAvatar';

export type {AvatarProps};

export interface GravatarBaseAvatarProps extends AvatarProps {
  gravatarId: string;
  identifier: string;
  name: string;
  type: 'gravatar';
}

export interface LetterBaseAvatarProps extends AvatarProps {
  identifier: string;
  name: string;
  type: 'letter_avatar';
}

export interface UploadBaseAvatarProps extends AvatarProps {
  identifier: string;
  name: string;
  type: 'upload';
  uploadUrl: string;
}

export type BaseAvatarProps =
  | GravatarBaseAvatarProps
  | LetterBaseAvatarProps
  | UploadBaseAvatarProps;

export function Avatar(props: BaseAvatarProps) {
  const src = useAvatarImageUrl(
    props.type === 'upload'
      ? {type: 'upload', uploadUrl: props.uploadUrl}
      : props.type === 'gravatar'
        ? {type: 'gravatar', gravatarId: props.gravatarId}
        : undefined
  );
  const {type, identifier, name, ...presentation} = props;
  // Keep application-only URL fields off the presentational component and DOM.
  const {
    uploadUrl: _uploadUrl,
    gravatarId: _gravatarId,
    ...appearance
  } = presentation as typeof presentation & {gravatarId?: string; uploadUrl?: string};
  return (
    <GenericAvatar
      {...appearance}
      identifier={identifier}
      name={name}
      initials={getAvatarInitialsOverride(name)}
      src={src ?? undefined}
      data-test-id={props['data-test-id'] ?? `${type}-avatar`}
    />
  );
}
