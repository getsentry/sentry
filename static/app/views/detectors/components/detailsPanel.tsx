import styled from '@emotion/styled';

import {Flex} from 'sentry/components/container/flex';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

// TODO: Make component flexible for different alert types
function DetailsPanel() {
  return (
    <Panel column gap={space(0.5)} justify="flex-start">
      <strong>{t('Query:')}</strong>
      <Query>
        <Subtext>{t('visualize:')}</Subtext> <p>{t('p75')}</p>
        <Subtext>{t('where:')}</Subtext> <p>{t('level is error')}</p>
        <Subtext>{t('grouped by:')}</Subtext> <p>{t('release')}</p>
      </Query>
      <strong>{t('Threshold:')}</strong>
    </Panel>
  );
}

const Panel = styled(Flex)`
  background-color: ${p => p.theme.backgroundSecondary};
  border: 1px solid ${p => p.theme.translucentBorder};
  border-radius: ${p => p.theme.borderRadius};
  padding: ${space(1.5)};
`;

const Query = styled('div')`
  display: grid;
  grid-template-columns: 1fr 2fr;
  grid-template-rows: repeat(3, 1fr);
  width: auto;

  p {
    margin: ${space(0.5)};
  }
`;

const Subtext = styled('p')`
  color: ${p => p.theme.subText};
  justify-self: flex-end;
`;

export default DetailsPanel;
