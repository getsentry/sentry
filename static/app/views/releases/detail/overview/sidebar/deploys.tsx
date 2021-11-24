import styled from '@emotion/styled';

import DeployBadge from 'sentry/components/deployBadge';
import SidebarSection from 'sentry/components/sidebarSection';
import TextOverflow from 'sentry/components/textOverflow';
import TimeSince from 'sentry/components/timeSince';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Deploy} from 'sentry/types';

type Props = {
  version: string;
  orgSlug: string;
  deploys: Deploy[];
  projectId: number;
};

const Deploys = ({version, orgSlug, projectId, deploys}: Props) => {
  return (
    <SidebarSection title={t('Deploys')}>
      {deploys.map(deploy => (
        <Row key={deploy.id}>
          <StyledDeployBadge
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
    </SidebarSection>
  );
};

const Row = styled('div')`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: ${space(1)};
  font-size: ${p => p.theme.fontSizeMedium};
  color: ${p => p.theme.subText};
`;

const StyledDeployBadge = styled(DeployBadge)`
  margin-right: ${space(1)};
`;

export default Deploys;
