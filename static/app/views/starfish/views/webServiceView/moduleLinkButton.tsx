import {ReactElement} from 'react';

import {Button} from 'sentry/components/button';
import {IconStar} from 'sentry/icons';
import {t} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';

export enum ModuleButtonType {
  API,
  CACHE,
  DB,
}

type Props = {
  type: ModuleButtonType;
};

export function ModuleLinkButton({type}: Props) {
  const organization = useOrganization();

  const BUTTON_TYPE_MAP: Record<
    ModuleButtonType,
    {icon: ReactElement; link: string; title: string}
  > = {
    [ModuleButtonType.API]: {
      link: `/organizations/${organization.slug}/starfish/api/`,
      title: t('API'),
      icon: <IconStar />,
    },
    [ModuleButtonType.CACHE]: {
      link: `/organizations/${organization.slug}/starfish/cache/`,
      title: t('Cache'),
      icon: <IconStar />,
    },
    [ModuleButtonType.DB]: {
      link: `/organizations/${organization.slug}/starfish/database/`,
      title: t('Database'),
      icon: <IconStar />,
    },
  };

  const {link, title, icon} = BUTTON_TYPE_MAP[type];
  return (
    <Button to={link} icon={icon}>
      {title}
    </Button>
  );
}
