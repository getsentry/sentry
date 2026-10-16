import {Fragment} from 'react';

import {Tag} from '@sentry/scraps/badge';
import {Button, ButtonBar} from '@sentry/scraps/button';
import {Container, Flex, Grid, Stack} from '@sentry/scraps/layout';
import {Switch} from '@sentry/scraps/switch';
import {Text} from '@sentry/scraps/text';

import {t} from 'sentry/locale';

type Device = 'desktop' | 'mobile';

const DEVICES: Device[] = ['desktop', 'mobile'];

type LegacyBrowserOption = {
  /** Subfilter key as the filters API expects it. */
  key: string;
  /** Human readable version cutoff, such as "110 and lower". */
  versions: string;
};

type LegacyBrowserRow = {
  family: string;
  /** Deprecated rows only show while their key is still active. */
  deprecated?: boolean;
  desktop?: LegacyBrowserOption;
  mobile?: LegacyBrowserOption;
};

const LEGACY_BROWSERS: LegacyBrowserRow[] = [
  {
    family: 'Chrome',
    desktop: {key: 'chrome', versions: '110 and lower'},
    mobile: {key: 'chrome_mobile', versions: '110 and lower'},
  },
  {
    family: 'Safari',
    desktop: {key: 'safari', versions: '15 and lower'},
    mobile: {key: 'safari_mobile', versions: '15 and lower'},
  },
  {
    family: 'Firefox',
    desktop: {key: 'firefox', versions: '110 and lower'},
    mobile: {key: 'firefox_mobile', versions: '110 and lower'},
  },
  {
    family: 'Edge',
    desktop: {key: 'edge', versions: '110 and lower'},
    mobile: {key: 'edge_mobile', versions: '110 and lower'},
  },
  {
    family: 'Opera',
    desktop: {key: 'opera', versions: '99 and lower'},
    mobile: {key: 'opera_mobile', versions: '73 and lower'},
  },
  {
    family: 'Opera Mini',
    mobile: {key: 'opera_mini', versions: '34 and lower'},
  },
  {
    family: 'Android',
    mobile: {key: 'android', versions: '3 and lower'},
  },
  {
    family: 'Internet Explorer',
    desktop: {key: 'ie', versions: '11 and lower'},
  },
  {
    family: 'Safari',
    deprecated: true,
    desktop: {key: 'safari_pre_6', versions: '5 and lower'},
  },
  {
    family: 'Android',
    deprecated: true,
    mobile: {key: 'android_pre_4', versions: '3 and lower'},
  },
  {
    family: 'Edge (Legacy)',
    deprecated: true,
    desktop: {key: 'edge_pre_79', versions: '18 and lower'},
  },
  {
    family: 'Internet Explorer',
    deprecated: true,
    desktop: {key: 'ie_pre_9', versions: '8 and lower'},
  },
  {
    family: 'Internet Explorer',
    deprecated: true,
    desktop: {key: 'ie9', versions: '9'},
  },
  {
    family: 'Internet Explorer',
    deprecated: true,
    desktop: {key: 'ie10', versions: '10'},
  },
  {
    family: 'Internet Explorer',
    deprecated: true,
    desktop: {key: 'ie11', versions: '11'},
  },
  {
    family: 'Opera',
    deprecated: true,
    desktop: {key: 'opera_pre_15', versions: '14 and lower'},
  },
  {
    family: 'Opera Mini',
    deprecated: true,
    mobile: {key: 'opera_mini_pre_8', versions: '8 and lower'},
  },
];

function getDeviceKeys(device: Device): string[] {
  return LEGACY_BROWSERS.filter(row => !row.deprecated)
    .map(row => row[device]?.key)
    .filter(key => key !== undefined);
}

/**
 * Every subfilter key that is not deprecated. This is what "All" selects.
 */
export function getAllLegacyBrowserKeys(): string[] {
  return DEVICES.flatMap(getDeviceKeys);
}

/**
 * The filters API reports the legacy browser filter either as a boolean, for
 * projects that never picked individual browsers, or as the list of active keys.
 */
export function getInitialSubfilters(active: boolean | string[]): string[] {
  switch (active) {
    case true:
      return getAllLegacyBrowserKeys();
    case false:
      return [];
    default:
      return active;
  }
}

function versionText(row: LegacyBrowserRow): string {
  const {desktop, mobile} = row;
  if (desktop && mobile && desktop.versions !== mobile.versions) {
    return t('Version %s, mobile %s', desktop.versions, mobile.versions);
  }
  return t('Version %s', (desktop ?? mobile)!.versions);
}

function deviceTitle(device: Device): string {
  return device === 'desktop' ? t('Desktop') : t('Mobile');
}

type ColumnState = 'all' | 'some' | 'none';

function DeviceSwitch({
  row,
  device,
  checked,
  disabled,
  onChange,
}: {
  checked: boolean;
  device: Device;
  onChange: () => void;
  row: LegacyBrowserRow;
  disabled?: boolean;
}) {
  const option = row[device];
  if (!option) {
    return <div />;
  }
  const label = [
    row.family,
    device === 'mobile' ? t('Mobile') : null,
    t('Version %s', option.versions),
    row.deprecated ? `(${t('deprecated')})` : null,
  ]
    .filter(part => part !== null)
    .join(' ');

  return (
    <Flex justify="center">
      <Switch
        aria-label={label}
        checked={checked}
        disabled={disabled}
        onChange={onChange}
      />
    </Flex>
  );
}

const COLUMNS = '1fr 112px 112px';

/**
 * Lets the user pick which legacy browsers Relay drops events from. Each
 * browser is one row with a Desktop and a Mobile switch. The quick selects
 * cover everything, one device column, or nothing.
 */
export function LegacyBrowserFilter({
  subfilters,
  disabled,
  hintText,
  indicator,
  label,
  onToggle,
}: {
  hintText: React.ReactNode;
  label: React.ReactNode;
  onToggle: (newSubfilters: string[]) => void;
  subfilters: string[];
  disabled?: boolean;
  indicator?: React.ReactNode;
}) {
  const selection = new Set(subfilters);

  const toggleKey = (key: string) => {
    const next = new Set(selection);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    onToggle([...next]);
  };

  const columnState = (device: Device): ColumnState => {
    const keys = getDeviceKeys(device);
    const count = keys.filter(key => selection.has(key)).length;
    if (count === 0) {
      return 'none';
    }
    return count === keys.length ? 'all' : 'some';
  };

  const toggleColumn = (device: Device) => {
    const next = new Set(selection);
    const keys = getDeviceKeys(device);
    if (columnState(device) === 'all') {
      keys.forEach(key => next.delete(key));
    } else {
      keys.forEach(key => next.add(key));
    }
    onToggle([...next]);
  };

  const visibleRows = LEGACY_BROWSERS.filter(
    row =>
      !row.deprecated ||
      (row.desktop && selection.has(row.desktop.key)) ||
      (row.mobile && selection.has(row.mobile.key))
  );

  return (
    <Stack flexGrow={1} width="100%" gap="md">
      <Stack gap="xs">
        <Flex align="center" gap="md" justify="between" wrap="wrap">
          {label}
          <Flex align="center" gap="md">
            {indicator}
            <ButtonBar size="xs">
              <Button
                onClick={() => onToggle(getAllLegacyBrowserKeys())}
                disabled={disabled}
              >
                {t('All')}
              </Button>
              {DEVICES.map(device => (
                <Button
                  key={device}
                  onClick={() => toggleColumn(device)}
                  disabled={disabled}
                  aria-pressed={columnState(device) === 'all'}
                >
                  {t('All %s', deviceTitle(device).toLowerCase())}
                </Button>
              ))}
              <Button onClick={() => onToggle([])} disabled={disabled}>
                {t('None')}
              </Button>
            </ButtonBar>
          </Flex>
        </Flex>
        {hintText}
      </Stack>
      <Container border="primary" radius="md" overflow="hidden">
        <Stack>
          <Grid columns={COLUMNS} align="center" padding="xs lg" background="secondary">
            <Text size="sm" variant="muted" bold>
              {t('Browser')}
            </Text>
            {DEVICES.map(device => (
              <Text key={device} size="sm" variant="muted" bold align="center">
                {deviceTitle(device)}
              </Text>
            ))}
          </Grid>
          {visibleRows.map(row => (
            <Fragment key={row.desktop?.key ?? row.mobile?.key}>
              <Stack.Separator />
              <Grid columns={COLUMNS} align="center" padding="md lg">
                <Flex align="baseline" gap="sm" wrap="wrap">
                  <Text bold>{row.family}</Text>
                  <Text size="sm" variant="muted">
                    {versionText(row)}
                  </Text>
                  {row.deprecated && <Tag variant="muted">{t('Deprecated')}</Tag>}
                </Flex>
                {DEVICES.map(device => (
                  <DeviceSwitch
                    key={device}
                    row={row}
                    device={device}
                    checked={row[device] ? selection.has(row[device].key) : false}
                    disabled={disabled}
                    onChange={() => row[device] && toggleKey(row[device].key)}
                  />
                ))}
              </Grid>
            </Fragment>
          ))}
        </Stack>
      </Container>
    </Stack>
  );
}
