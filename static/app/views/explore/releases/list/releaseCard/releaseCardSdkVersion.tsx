import {Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {t} from 'sentry/locale';
import type {ReleaseSdkVersion} from 'sentry/views/explore/releases/list/useReleasesSdkVersions';

type Props = {
  sdkVersions: ReleaseSdkVersion[] | undefined;
};

export function ReleaseCardSdkVersion({sdkVersions}: Props) {
  const [primary, ...others] = sdkVersions ?? [];

  if (!primary) {
    return null;
  }

  const content = (
    <Flex gap="xs">
      <Text size="sm">{t('SDK: %s %s', primary.name, primary.version)}</Text>
      {others.length > 0 && (
        <Text size="sm" variant="muted">
          {t('+%s', others.length)}
        </Text>
      )}
    </Flex>
  );

  if (!others.length) {
    return content;
  }

  return (
    <Tooltip
      title={
        <Stack gap="xs" align="start">
          {sdkVersions?.map(sdk => (
            <Text key={`${sdk.name}@${sdk.version}`} size="sm">
              {sdk.name} {sdk.version}
            </Text>
          ))}
        </Stack>
      }
    >
      {content}
    </Tooltip>
  );
}
