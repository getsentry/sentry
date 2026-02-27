import {
  ImageAvatar,
  type ImageAvatarProps,
} from '@sentry/scraps/avatar/imageAvatar/imageAvatar';
import {
  LetterAvatar,
  type LetterAvatarProps,
} from '@sentry/scraps/avatar/letterAvatar/letterAvatar';
import {Button, type ButtonProps} from '@sentry/scraps/button';

export interface AvatarButtonProps extends Omit<ButtonProps, 'children'> {
  avatar: ImageAvatarProps | LetterAvatarProps;
}

export function AvatarButton({avatar, ...props}: AvatarButtonProps) {
  return (
    <Button {...props}>
      {'definition' in avatar ? (
        <ImageAvatar
          definition={avatar.definition}
          identifier={avatar.identifier}
          name={avatar.name}
          round={avatar.round}
          suggested={avatar.suggested}
        />
      ) : (
        <LetterAvatar
          identifier={avatar.identifier}
          name={avatar.name}
          round={avatar.round}
          suggested={avatar.suggested}
        />
      )}
    </Button>
  );
}
