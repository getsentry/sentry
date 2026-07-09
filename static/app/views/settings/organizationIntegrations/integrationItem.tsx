import styled from '@emotion/styled';

import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {IconWarning} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import type {Integration} from 'sentry/types/integrations';
import {getIntegrationNoun} from 'sentry/utils/integrationUtil';
import {IntegrationIcon} from 'sentry/views/settings/organizationIntegrations/integrationIcon';

type Props = {
  integration: Integration;
  compact?: boolean;
  requiresUpgrade?: boolean | undefined;
};

export function IntegrationItem({integration, requiresUpgrade, compact = false}: Props) {
  return (
    <Flex align="center">
      <div>
        <IntegrationIcon size={compact ? 18 : 32} integration={integration} />
      </div>
      <Flex
        direction={compact ? 'row' : 'column'}
        align={compact ? 'center' : undefined}
        justify="center"
        paddingLeft="md"
        minWidth={0}
      >
        <Flex align="center" gap="xs">
          <Text size="md" bold>
            {integration.name}
          </Text>
          {requiresUpgrade && (
            <Tooltip
              isHoverable
              containerDisplayMode="flex"
              title={tct(
                "There's a new update for your [displayName] integration, please update your [noun]",
                {
                  displayName: integration.provider.name,
                  noun: getIntegrationNoun(integration.provider.key),
                }
              )}
            >
              <IconWarning variant="warning" aria-label={t('Integration alert')} />
            </Tooltip>
          )}
        </Flex>
        <DomainName compact={compact}>
          <Text size="sm" variant="muted" density="comfortable">
            {integration.domainName}
          </Text>
        </DomainName>
      </Flex>
    </Flex>
  );
}

// Not using the overflowEllipsis style import here
// as it sets width 100% which causes layout issues in the
// integration list.
const DomainName = styled('div')<{compact: boolean}>`
  margin-left: ${p => (p.compact ? p.theme.space.md : 'inherit')};
  margin-top: ${p => (p.compact ? 'inherit' : 0)};
  overflow: hidden;
  text-overflow: ellipsis;
`;
