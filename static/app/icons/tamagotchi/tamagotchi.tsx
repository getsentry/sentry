import {useEffect, useMemo, useState} from 'react';
import isPropValid from '@emotion/is-prop-valid';
import styled from '@emotion/styled';

import tamagotchiEgg from 'sentry-images/tamagotchi/egg.gif';
import tamagotchiHappy from 'sentry-images/tamagotchi/happy.gif';
import tamagotchiMeh from 'sentry-images/tamagotchi/meh.gif';
import tamagotchiSad from 'sentry-images/tamagotchi/sad.gif';

import Panel from 'sentry/components/panels/panel';
import PanelHeader from 'sentry/components/panels/panelHeader';
import PanelItem from 'sentry/components/panels/panelItem';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Project, Release} from 'sentry/types';
import {useApiQuery} from 'sentry/utils/queryClient';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {CombinedAlertType, CombinedMetricIssueAlerts} from 'sentry/views/alerts/types';
import {useReleases} from 'sentry/views/starfish/queries/useReleases';

export function useAlertRules() {
  const organization = useOrganization();
  const location = useLocation();
  const {query} = location;

  query.expand = ['latestIncident', 'lastTriggered'];

  if (!query.sort) {
    query.sort = ['incident_status', 'date_triggered'];
  }
  return useApiQuery<CombinedMetricIssueAlerts[]>(
    [
      `/organizations/${organization.slug}/combined-rules/`,
      {
        query,
      },
    ],
    {staleTime: Infinity}
  );
}

function getCleanliness(releases?: Release[], project?: Project): number {
  const hasReleases = releases?.length !== 0;
  const hasEnvironments =
    project?.environments.length &&
    !(project.environments.length === 1 && project.environments.includes('prod'));

  if ((hasReleases && !hasEnvironments) || (!hasReleases && hasEnvironments)) {
    return 0.5;
  }
  if (hasReleases && hasEnvironments) {
    return 1;
  }

  return 0;
}

function getEnergy(alerts?: CombinedMetricIssueAlerts[]): number {
  const metricAlerts = alerts?.filter(function (element) {
    return element.type === CombinedAlertType.METRIC;
  });

  const issueAlerts = alerts?.filter(function (element) {
    return element.type === CombinedAlertType.ISSUE;
  });

  const hasIssueAlerts = issueAlerts && issueAlerts.length > 0;
  const hasMetricAlerts = metricAlerts && metricAlerts.length > 0;

  if ((hasIssueAlerts && !hasMetricAlerts) || (!hasMetricAlerts && hasIssueAlerts)) {
    return 0.5;
  }
  if (hasIssueAlerts && hasMetricAlerts) {
    return 1;
  }

  return 0;
}

function Tamagotchi({project}: {project?: Project}) {
  const [currentScore, setCurrentScore] = useState(0);
  const [currentStage, setCurrentStage] = useState(tamagotchiEgg);

  const tamagotchiStages = useMemo(() => {
    const stages = {
      0: {
        stage: tamagotchiEgg,
        stageName: 'egg',
        stageMinimumScore: 0,
        stageMaximumScore: 100,
      },
      1: {
        stage: tamagotchiSad,
        stageName: 'sad',
        stageMinimumScore: 101,
        stageMaximumScore: 200,
      },
      2: {
        stage: tamagotchiMeh,
        stageName: 'meh',
        stageMinimumScore: 201,
        stageMaximumScore: 300,
      },
      3: {
        stage: tamagotchiHappy,
        stageName: 'happy',
        stageMinimumScore: 301,
        stageMaximumScore: 400,
      },
    };
    return stages;
  }, []);

  const releases = useReleases();
  const alerts = useAlertRules();

  const tamagotchiMetrics = useMemo(() => {
    const metrics = {
      energy: getEnergy(alerts.data) * 100,
      cleanliness: getCleanliness(releases.data, project) * 100,
      happiness: 50.0,
      health: 100.0,
    };
    return metrics;
  }, [releases, project, alerts]);

  useEffect(() => {
    // Currently allowing 3 seconds for egg to hatch and then set the initial data to the Sad stage
    setTimeout(() => {
      setCurrentScore(1);
      setCurrentStage(tamagotchiStages[1].stage);
    }, 3000);
  }, [tamagotchiStages]);

  useEffect(() => {
    const totalScore =
      tamagotchiMetrics.energy +
      tamagotchiMetrics.cleanliness +
      tamagotchiMetrics.happiness +
      tamagotchiMetrics.health;
    if (totalScore !== currentScore) {
      setCurrentScore(totalScore);
      Object.keys(tamagotchiStages).map(id => {
        if (
          tamagotchiStages[id].stageMinimumScore <= totalScore &&
          tamagotchiStages[id].stageMaximumScore >= totalScore
        ) {
          setCurrentStage(tamagotchiStages[id].stage);
        }
        return id;
      });
    }
  }, [currentScore, tamagotchiMetrics, tamagotchiStages]);

  return (
    <EggContainer>
      <MyEgg>
        <MyBox>
          <Panel>
            <TamagotchiWrapper>
              <img height={50} alt="tamagotchi" src={currentStage} />
            </TamagotchiWrapper>
            {Object.keys(tamagotchiMetrics).map(id => {
              const pctLabel = Math.floor(tamagotchiMetrics[id]);
              return (
                <TamagotchiMetric key={id}>
                  <div>{id}</div>
                  <Segment
                    data-percent={`${pctLabel}%`}
                    aria-label={`${id} ${t('segment')}`}
                    color="#E1567C"
                  >
                    <span>{`${pctLabel}%`}</span>
                  </Segment>
                </TamagotchiMetric>
              );
            })}
          </Panel>
        </MyBox>
      </MyEgg>
    </EggContainer>
  );
}

export default Tamagotchi;

const EggContainer = styled('div')`
  position: relative;
  height: 400px;
`;
const MyEgg = styled('div')`
  width: 100%;
  height: 100%;
  position: absolute;
  top: 0;
  left: 0;
  background-color: #452650;
  display: block;
  border-radius: 50% 60% 50% 50% / 70% 70% 40% 40%;
`;

const MyBox = styled('div')`
  width: 212px;
  background-color: #ffe8ec;
  border-radius: 16px;
  margin: auto;
  margin-top: 70px;
`;

const TamagotchiWrapper = styled(PanelHeader)`
  justify-content: center;
`;

const TamagotchiMetric = styled(PanelItem)`
  display: grid;
  gap: ${space(1)};
  text-transform: capitalize;
  font-size: ${p => p.theme.fontSizeSmall};
  grid-template-columns: 1fr 60%;
`;

const Segment = styled('span', {shouldForwardProp: isPropValid})<{color: string}>`
  display: block;
  width: 100%;
  height: ${space(2)};
  color: ${p => p.theme.black};
  outline: none;
  position: relative;
  background-color: ${p => p.theme.backgroundSecondary};
  border: 1px solid black;
  text-align: right;
  font-size: ${p => p.theme.fontSizeExtraSmall};
  padding: 1px ${space(0.5)} 0 0;

  &:after {
    content: '';
    width: ${p => p['data-percent']};
    position: absolute;
    left: 0;
    height: 100%;
    top: 0;
    background-color: ${p => p.color};
  }
  & span {
    position: relative;
    z-index: 1;
  }
`;
