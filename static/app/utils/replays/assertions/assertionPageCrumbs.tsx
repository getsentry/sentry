import {t} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';
import {makeReplaysPathname} from 'sentry/views/replays/pathnames';

export default function useAssertionPageCrumbs({label}: {label: string}) {
  const organization = useOrganization();

  return [
    {
      label: t('Replay'),
      to: {
        pathname: makeReplaysPathname({
          path: '/',
          organization,
        }),
      },
    },
    {
      label: t('Assertions'),
      to: {
        pathname: makeReplaysPathname({
          path: '/assertions/table/',
          organization,
        }),
      },
    },
    {
      label,
    },
  ];
}
