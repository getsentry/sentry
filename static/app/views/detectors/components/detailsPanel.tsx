import styled from '@emotion/styled';

import {Flex} from 'sentry/components/container/flex';
import {Container} from 'sentry/components/workflowEngine/ui/container';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

// TODO: Make component flexible for different alert types
function DetailsPanel() {
  return (
    <Container>
      <Flex column gap={space(0.5)}>
        <Heading>{t('Query:')}</Heading>
        <Query>
          <Label>{t('visualize:')}</Label> <Value>{t('p75')}</Value>
          <Label>{t('where:')}</Label> <Value>{t('device.name is "Chrome"')}</Value>
          <Label>{t('grouped by:')}</Label> <Value>{t('release')}</Value>
        </Query>
      </Flex>
      <Heading>{t('Threshold:')}</Heading>
    </Container>
  );
}

const Heading = styled('h4')`
  font-size: ${p => p.theme.fontSizeMedium};
  margin: 0;
`;

const Query = styled('dl')`
  display: grid;
  grid-template-columns: auto auto;
  grid-template-rows: repeat(3, 1fr);
  width: fit-content;
  gap: ${space(0.5)} ${space(1)};
  margin: 0;
`;

const Label = styled('dt')`
  color: ${p => p.theme.subText};
  justify-self: flex-end;
  margin: 0;
`;

const Value = styled('dl')`
  ${p => p.theme.overflowEllipsis};
  margin: 0;
`;

export default DetailsPanel;
