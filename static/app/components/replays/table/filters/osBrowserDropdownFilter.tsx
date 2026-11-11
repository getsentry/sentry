import {IconEllipsis} from '@sentry/icons/ellipsis';

import {DropdownMenu} from '@sentry/scraps/dropdownMenu';

import {t, tct} from 'sentry/locale';

import {ActionMenuTrigger, useGenerateAction} from './utils';

export function OSBrowserDropdownFilter({
  type,
  name,
  version,
}: {
  name: string | null;
  type: 'browser' | 'os';
  version: string | null;
}) {
  const generateAction = useGenerateAction();

  return (
    <DropdownMenu
      items={[
        {
          key: 'name',
          label: tct('[type] name: [name]', {
            type,
            name: name ? name : t('undefined'),
          }),
          children: [
            {
              key: 'name_add',
              label: t('Add to filter'),
              onAction: generateAction({
                key: `${type}.name`,
                value: name ?? '',
              }),
            },
            {
              key: 'name_exclude',
              label: t('Exclude from filter'),
              onAction: generateAction({
                key: `!${type}.name`,
                value: name ?? '',
              }),
            },
          ],
        },

        {
          key: 'version',
          label: tct('[type] version: [version]', {
            type,
            version: version ? version : t('undefined'),
          }),
          children: [
            {
              key: 'version_add',
              label: t('Add to filter'),
              onAction: generateAction({
                key: `${type}.version`,
                value: version ?? '',
              }),
            },
            {
              key: 'version_exclude',
              label: t('Exclude from filter'),
              onAction: generateAction({
                key: `!${type}.version`,
                value: version ?? '',
              }),
            },
          ],
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
        <ActionMenuTrigger
          {...triggerProps}
          aria-label={t('Actions')}
          data-visible-on-hover
          icon={<IconEllipsis size="xs" />}
          size="zero"
        />
      )}
    />
  );
}
