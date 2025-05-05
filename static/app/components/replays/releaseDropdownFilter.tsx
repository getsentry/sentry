import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import {IconEllipsis} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import {makeReleasesPathname} from 'sentry/views/releases/utils/pathnames';
import {makeReplaysPathname} from 'sentry/views/replays/pathnames';
import type {ReplayListLocationQuery} from 'sentry/views/replays/types';

export default function ReleaseDropdownFilter({val}: {val: string}) {
  const location = useLocation<ReplayListLocationQuery>();
  const navigate = useNavigate();
  const organization = useOrganization();

  return (
    <DropdownMenu
      items={[
        {
          key: 'search',
          label: t('Search for replays in this release'),
          onAction: () =>
            navigate({
              pathname: makeReplaysPathname({
                path: '/',
                organization,
              }),
              query: {
                ...location.query,
                query: `release:"${val}"`,
              },
            }),
        },
        {
          key: 'details',
          label: t('Go to release details'),
          onAction: () =>
            navigate(
              makeReleasesPathname({
                organization,
                path: `/${encodeURIComponent(val)}/`,
              })
            ),
        },
      ]}
      usePortal
      size="xs"
      offset={4}
      position="bottom"
      preventOverflowOptions={{padding: 4}}
      flipOptions={{
        fallbackPlacements: ['top', 'right-start', 'right-end', 'left-start', 'left-end'],
      }}
      trigger={triggerProps => (
        <TriggerButton
          {...triggerProps}
          aria-label={t('Actions')}
          icon={<IconEllipsis size="xs" />}
          size="zero"
        />
      )}
    />
  );
}

const TriggerButton = styled(Button)`
  padding: ${space(0.5)};
`;
