import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';
import type {Integration} from 'sentry/types/integrations';
import IntegrationIcon from 'sentry/views/settings/organizationIntegrations/integrationIcon';

type Props = {
  integration: Integration;
  compact?: boolean;
};

function IntegrationItem({integration, compact = false}: Props) {
  return (
    <Flex>
      <div>
        <IntegrationIcon size={compact ? 22 : 32} integration={integration} />
      </div>
      <Labels compact={compact}>
        <IntegrationName data-test-id="integration-name">
          {integration.name}
        </IntegrationName>
        <DomainName compact={compact}>{integration.domainName}</DomainName>
      </Labels>
    </Flex>
  );
}

export default IntegrationItem;

const Flex = styled('div')`
  display: flex;
  align-items: center;
`;

const Labels = styled('div')<{compact: boolean}>`
  box-sizing: border-box;
  display: flex;
  ${p => (p.compact ? 'align-items: center;' : '')};
  flex-direction: ${p => (p.compact ? 'row' : 'column')};
  padding-left: ${space(1)};
  min-width: 0;
  justify-content: center;
`;

const IntegrationName = styled('div')`
  font-size: ${p => p.theme.fontSizeMedium};
  font-weight: ${p => p.theme.fontWeightBold};
  line-height: ${p => p.theme.text.lineHeightHeading};
`;

// Not using the overflowEllipsis style import here
// as it sets width 100% which causes layout issues in the
// integration list.
const DomainName = styled('div')<{compact: boolean}>`
  color: ${p => p.theme.subText};
  margin-left: ${p => (p.compact ? space(1) : 'inherit')};
  margin-top: ${p => (!p.compact ? 0 : 'inherit')};
  font-size: ${p => p.theme.fontSizeSmall};
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: ${p => p.theme.text.lineHeightBody};
`;
