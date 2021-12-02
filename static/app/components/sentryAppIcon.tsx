import {css} from '@emotion/react';
import styled from '@emotion/styled';

import Feature from 'sentry/components/acl/feature';
import Avatar from 'sentry/components/avatar';
import {
  IconCalixa,
  IconClickup,
  IconGeneric,
  IconKomodor,
  IconLinear,
  IconRookout,
  IconShortcut,
  IconSpikesh,
  IconTaskcall,
  IconTeamwork,
} from 'sentry/icons';
import ConfigStore from 'sentry/stores/configStore';
import {SentryAppComponent} from 'sentry/types';

type Props = {
  sentryAppComponent: SentryAppComponent;
};

const getFallbackIcon = (slug: string) => {
  switch (slug) {
    case 'calixa':
      return <IconCalixa size="md" />;
    case 'clickup':
      return <IconClickup size="md" />;
    case 'komodor':
      return <IconKomodor size="md" />;
    case 'linear':
      return <IconLinear size="md" />;
    case 'rookout':
      return <IconRookout size="md" />;
    case 'shortcut':
      return <IconShortcut size="md" />;
    case 'spikesh':
      return <IconSpikesh size="md" />;
    case 'taskcall':
      return <IconTaskcall size="md" />;
    case 'teamwork':
      return <IconTeamwork size="md" />;
    default:
      return <IconGeneric size="md" />;
  }
};

const SentryAppIcon = ({sentryAppComponent: {sentryApp}}: Props) => {
  return (
    <Feature features={['organizations:sentry-app-logo-upload']}>
      {({hasFeature}) => {
        const selectedAvatar = sentryApp?.avatars?.find(({color}) => color === false);
        const isDefault = !(selectedAvatar && selectedAvatar?.avatarType === 'upload');
        return hasFeature ? (
          <AvatarWrapper shouldInvert={ConfigStore.get('theme') === 'dark' && !isDefault}>
            <Avatar size={20} sentryApp={sentryApp} isColor={false} />
          </AvatarWrapper>
        ) : (
          getFallbackIcon(sentryApp.slug)
        );
      }}
    </Feature>
  );
};

export default SentryAppIcon;

const AvatarWrapper = styled('span')<{shouldInvert: boolean}>`
  ${({shouldInvert}) =>
    shouldInvert &&
    css`
      filter: invert(1);
    `}
  line-height: 0;
`;
