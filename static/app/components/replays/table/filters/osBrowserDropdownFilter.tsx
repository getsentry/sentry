import {DropdownMenu} from 'sentry/components/dropdownMenu';
import {
  ActionMenuTrigger,
  generateAction,
} from 'sentry/components/replays/table/filters/utils';
import {IconEllipsis} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import type {ReplayListLocationQuery} from 'sentry/views/replays/types';

export default function OSBrowserDropdownFilter({
  type,
  name,
  version,
}: {
  name: string | null;
  type: string;
  version: string | null;
}) {
  const location = useLocation<ReplayListLocationQuery>();
  const navigate = useNavigate();

  return (
    <DropdownMenu
      items={[
        ...(name
          ? [
              {
                key: 'name',
                label: tct('[type] name: [name]', {
                  type: <b>{type}</b>,
                  name: <b>{name}</b>,
                }),
                children: [
                  {
                    key: 'name_add',
                    label: t('Add to filter'),
                    onAction: generateAction({
                      key: `${type}.name`,
                      value: name ?? '',
                      edit: 'set',
                      location,
                      navigate,
                    }),
                  },
                  {
                    key: 'name_exclude',
                    label: t('Exclude from filter'),
                    onAction: generateAction({
                      key: `${type}.name`,
                      value: name ?? '',
                      edit: 'remove',
                      location,
                      navigate,
                    }),
                  },
                ],
              },
            ]
          : []),
        ...(version
          ? [
              {
                key: 'version',
                label: tct('[type] version: [version]', {
                  type: <b>{type}</b>,
                  version: <b>{version}</b>,
                }),
                children: [
                  {
                    key: 'version_add',
                    label: t('Add to filter'),
                    onAction: generateAction({
                      key: `${type}.version`,
                      value: version ?? '',
                      edit: 'set',
                      location,
                      navigate,
                    }),
                  },
                  {
                    key: 'version_exclude',
                    label: t('Exclude from filter'),
                    onAction: generateAction({
                      key: `${type}.version`,
                      value: version ?? '',
                      edit: 'remove',
                      location,
                      navigate,
                    }),
                  },
                ],
              },
            ]
          : []),
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
        <ActionMenuTrigger
          {...triggerProps}
          aria-label={t('Actions')}
          data-visible-on-hover
          icon={<IconEllipsis size="xs" />}
          size="zero"
          translucentBorder
        />
      )}
    />
  );
}
