import styled from '@emotion/styled';

import {t} from 'app/locale';
import space from 'app/styles/space';
import {Deploy} from 'app/types';
import TimeSince from 'app/components/timeSince';
import DeployBadge from 'app/components/deployBadge';
import TextOverflow from 'app/components/textOverflow';

import {SectionHeading, Wrapper} from './styles';

type Props = {
  version: string;
  orgSlug: string;
  deploys: Deploy[];
  projectId: number;
};

const Deploys = ({version, orgSlug, projectId, deploys}: Props) => {
  return (
    <Wrapper>
      <SectionHeading>{t('Deploys')}</SectionHeading>

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
    </Wrapper>
  );
};

const Row = styled('div')`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: ${space(1)};
  font-size: ${p => p.theme.fontSizeMedium};
  color: ${p => p.theme.gray600};
`;

const StyledDeployBadge = styled(DeployBadge)`
  margin-right: ${space(1)};
`;

export default Deploys;
