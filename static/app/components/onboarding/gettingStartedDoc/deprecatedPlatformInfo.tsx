import styled from '@emotion/styled';

import {Alert} from 'sentry/components/core/alert';
import {CodeBlock} from 'sentry/components/core/code';
import {Stack} from 'sentry/components/core/layout';
import {ExternalLink} from 'sentry/components/core/link';
import {Text} from 'sentry/components/core/text';
import {tct} from 'sentry/locale';
import type {PlatformIntegration, ProjectKey} from 'sentry/types/project';

type DeprecatedPlatformInfoProps = {
  dsn: ProjectKey['dsn'];
  platform: PlatformIntegration;
};

export function DeprecatedPlatformInfo({platform, dsn}: DeprecatedPlatformInfoProps) {
  return (
    <NoOverflowAlert variant="warning" showIcon={false}>
      <Stack padding="xl" gap="xl">
        <Text>
          {tct(
            '[platform] has been deprecated, but you can still use this project with the following DSN:',
            {
              platform: <strong>{platform.name}</strong>,
            }
          )}
        </Text>

        <CodeBlock dark language="properties">
          {dsn.public}
        </CodeBlock>

        <Text>
          {tct(
            'Looking for setup guidance? The [platformDocLink:docs] have you covered.',
            {
              platformDocLink: (
                <ExternalLink
                  href={platform.link ?? 'https://docs.sentry.io/platforms/'}
                />
              ),
            }
          )}
        </Text>

        <Text>
          {tct(
            "We support many platforms! Take a peek at the [docsLink:full list] to see what's available.",
            {
              docsLink: <ExternalLink href="https://docs.sentry.io/platforms/" />,
            }
          )}
        </Text>
      </Stack>
    </NoOverflowAlert>
  );
}

const NoOverflowAlert = styled(Alert)`
  > *:first-child {
    overflow: hidden;
  }
`;
