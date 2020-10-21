import styled from '@emotion/styled';

import {Project, Deploy as DeployType} from 'app/types';
import {t} from 'app/locale';
import Button from 'app/components/button';
import SentryTypes from 'app/sentryTypes';
import TextOverflow from 'app/components/textOverflow';
import TimeSince from 'app/components/timeSince';
import Version from 'app/components/version';
import space from 'app/styles/space';
import getDynamicText from 'app/utils/getDynamicText';

const DEPLOY_COUNT = 2;

type Props = {
  project: Project;
};

const Deploys = ({project}: Props) => {
  const flattenedDeploys = Object.entries(project.latestDeploys || {}).map(
    ([environment, value]): Pick<
      DeployType,
      'version' | 'dateFinished' | 'environment'
    > => ({environment, ...value})
  );

  const deploys = (flattenedDeploys || [])
    .sort(
      (a, b) => new Date(b.dateFinished).getTime() - new Date(a.dateFinished).getTime()
    )
    .slice(0, DEPLOY_COUNT);

  if (!deploys.length) {
    return <NoDeploys />;
  }

  return (
    <DeployContainer>
      {deploys.map(deploy => (
        <Deploy
          key={`${deploy.environment}-${deploy.version}`}
          deploy={deploy}
          project={project}
        />
      ))}
    </DeployContainer>
  );
};

Deploys.propTypes = {
  project: SentryTypes.Project.isRequired,
};

export default Deploys;

type DeployProps = Props & {
  deploy: Pick<DeployType, 'version' | 'dateFinished' | 'environment'>;
};

const Deploy = ({deploy, project}: DeployProps) => (
  <DeployRow>
    <Environment>{deploy.environment}</Environment>

    <StyledTextOverflow>
      <Version
        version={deploy.version}
        projectId={project.id}
        tooltipRawVersion
        truncate
      />
    </StyledTextOverflow>

    <DeployTimeWrapper>
      {getDynamicText({
        fixed: '3 hours ago',
        value: <TimeSince date={deploy.dateFinished} />,
      })}
    </DeployTimeWrapper>
  </DeployRow>
);

Deploy.propTypes = {
  deploy: SentryTypes.Deploy.isRequired,
  project: SentryTypes.Project.isRequired,
};

const NoDeploys = () => (
  <DeployContainer>
    <Background>
      <Button size="xsmall" href="https://docs.sentry.io/learn/releases/" external>
        {t('Track deploys')}
      </Button>
    </Background>
  </DeployContainer>
);

const DeployRow = styled('div')`
  display: flex;
  justify-content: space-between;
  color: ${p => p.theme.gray500};
  font-size: ${p => p.theme.fontSizeSmall};

  &:not(:last-of-type) {
    margin-top: ${space(1)};
  }
`;

const Environment = styled(TextOverflow)`
  font-size: ${p => p.theme.fontSizeExtraSmall};
  text-transform: uppercase;
  width: 80px;
  border: 1px solid ${p => p.theme.borderLight};
  margin-right: ${space(1)};
  background-color: ${p => p.theme.gray100};
  text-align: center;
  border-radius: ${p => p.theme.borderRadius};
  flex-shrink: 0;
`;

const StyledTextOverflow = styled(TextOverflow)`
  margin-right: ${space(1)};
`;

const DeployTimeWrapper = styled('div')`
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  width: 90px;
  flex-grow: 1;
  flex-shrink: 0;
  text-align: right;
`;

const DeployContainer = styled('div')`
  height: 92px;
  padding: ${space(2)};
`;

const Background = styled('div')`
  display: flex;
  height: 100%;
  background-color: ${p => p.theme.gray100};
  align-items: center;
  justify-content: center;
`;
