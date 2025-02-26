import styled from '@emotion/styled';

import {DeployBadge} from 'sentry/components/core/badge/deployBadge';
import * as SidebarSection from 'sentry/components/sidebarSection';
import TextOverflow from 'sentry/components/textOverflow';
import TimeSince from 'sentry/components/timeSince';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Deploy} from 'sentry/types/release';

type Props = {
  deploys: Deploy[];
  orgSlug: string;
  projectId: number;
  version: string;
};

function Deploys({version, orgSlug, projectId, deploys}: Props) {
  return (
    <SidebarSection.Wrap>
      <SidebarSection.Title>{t('Deploys')}</SidebarSection.Title>
      <SidebarSection.Content>
        {deploys.map(deploy => (
          <Row key={deploy.id}>
            <DeployBadge
              deploy={deploy}
              orgSlug={orgSlug}
              version={version}
              projectId={projectId}
            />
            <TextOverflow>
              <TimeSince date={deploy.dateFinished} />
            </TextOverflow>
          </Row>
        ))}
      </SidebarSection.Content>
    </SidebarSection.Wrap>
  );
}

const Row = styled('div')`
  display: flex;
  gap: ${space(1)};
  align-items: center;
  justify-content: space-between;
  margin-bottom: ${space(1)};
  font-size: ${p => p.theme.fontSizeMedium};
  color: ${p => p.theme.subText};
`;

export default Deploys;
