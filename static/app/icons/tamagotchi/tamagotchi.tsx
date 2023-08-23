import {useEffect, useMemo, useState} from 'react';
import isPropValid from '@emotion/is-prop-valid';
import {EmotionJSX} from '@emotion/react/types/jsx-namespace';
import styled from '@emotion/styled';

import tamagotchiEgg from 'sentry-images/tamagotchi/egg.gif';
import tamagotchiHappy from 'sentry-images/tamagotchi/happy.gif';
import tamagotchiMeh from 'sentry-images/tamagotchi/meh.gif';
import tamagotchiSad from 'sentry-images/tamagotchi/sad.gif';

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

function getCleanliness(
  releases?: Release[],
  project?: Project
): {cleanliness: number; hasEnvironments: boolean; hasReleases: boolean} {
  const hasReleases = releases?.length !== 0;
  const hasEnvironments = Boolean(
    project?.environments.length &&
      !(project.environments.length === 1 && project.environments.includes('prod'))
  );

  const cleanliness = {hasReleases, hasEnvironments, cleanliness: 0};

  if ((hasReleases && !hasEnvironments) || (!hasReleases && hasEnvironments)) {
    cleanliness.cleanliness = 0.5;
  }
  if (hasReleases && hasEnvironments) {
    cleanliness.cleanliness = 1;
  }

  return cleanliness;
}

function getEnergy(alerts?: CombinedMetricIssueAlerts[]): {
  energy: number;
  hasIssueAlerts: boolean;
  hasMetricAlerts: boolean;
} {
  const metricAlerts = alerts?.filter(function (element) {
    return element.type === CombinedAlertType.METRIC;
  });

  const issueAlerts = alerts?.filter(function (element) {
    return element.type === CombinedAlertType.ISSUE;
  });

  const hasIssueAlerts = Boolean(issueAlerts && issueAlerts.length > 0);
  const hasMetricAlerts = Boolean(metricAlerts && metricAlerts.length > 0);
  const energy = {hasIssueAlerts, hasMetricAlerts, energy: 0};

  if ((hasIssueAlerts && !hasMetricAlerts) || (!hasMetricAlerts && hasIssueAlerts)) {
    energy.energy = 0.5;
  }
  if (hasIssueAlerts && hasMetricAlerts) {
    energy.energy = 1;
  }

  return energy;
}

function Tamagotchi({project}: {project?: Project}) {
  const [currentScore, setCurrentScore] = useState(0);
  const [currentStage, setCurrentStage] = useState(tamagotchiEgg);
  const [currentCard, setCurrentCard] = useState(4);

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
      energy: getEnergy(alerts.data).energy * 100,
      cleanliness: getCleanliness(releases.data, project).cleanliness * 100,
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

  const handleSetCurrentCard = (index: number) => {
    setCurrentCard(index);
  };

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

  const cards: EmotionJSX.Element[] = [];
  cards.push(<CardPanel color="red" />);
  cards.push(<CardPanel color="orange" />);
  cards.push(<CardPanel color="blue" />);
  cards.push(<CardPanel color="green" />);
  cards.push(
    <CardPanel color="#ffe8ec">
      <TamagotchiWrapper>
        <img height={28} alt="tamagotchi" src={currentStage} />
      </TamagotchiWrapper>
      {Object.keys(tamagotchiMetrics).map((id, index) => {
        const pctLabel = Math.floor(tamagotchiMetrics[id]);
        return (
          <TamagotchiMetric key={id}>
            <div>
              {
                <button
                  onClick={() => {
                    handleSetCurrentCard(index);
                  }}
                >
                  {id}
                </button>
              }
            </div>
            <Segment
              data-percent={`${pctLabel}%`}
              aria-label={`${id} ${t('segment')}`}
              color="#E1567C"
            />
          </TamagotchiMetric>
        );
      })}
    </CardPanel>
  );

  return (
    <TamagotchiContainer>
      <MyEggShape />
      {cards[currentCard]}
      <MyButtonContainer>
        <TamagotchiButton />
        <TamagotchiButton
          isEnabled
          onClick={() => {
            handleSetCurrentCard(4);
          }}
        />
        <TamagotchiButton />
      </MyButtonContainer>
    </TamagotchiContainer>
  );
}

export default Tamagotchi;

const TamagotchiButton = styled('button')<{isEnabled?: boolean}>`
  border-radius: 50%;
  width: 24px;
  height: 24px;
  border: none;
  z-index: 1;
  background-color: #a99f84;
  cursor: default;

  ${p =>
    p.isEnabled &&
    `
    cursor: pointer;
    background-color: #f1b71c;

    :hover {
    background-color: #fedb4b;

  }`}
`;

const MyButtonContainer = styled('div')`
  width: 100%;
  height: 24px;
  top: 300px;
  display: flex;
  flex-direction: row;
  justify-content: center;
  position: absolute;
  gap: 8px;
`;

const CardPanel = styled('div')<{color: string}>`
  width: 212px;
  height: 216px;
  position: absolute;
  margin: auto;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  z-index: 1;
  background-color: ${p => p.color};
  border-radius: 16px;
`;

const TamagotchiContainer = styled('div')`
  position: relative;
  margin: auto;
  width: 300px;
  height: 360px;
`;
const MyEggShape = styled('div')`
  width: 100%;
  height: 100%;
  position: absolute;
  top: 0;
  left: 0;
  background-color: #452650;
  display: block;
  border-radius: 60% 60% 50% 50% / 70% 70% 40% 40%;
`;

const TamagotchiWrapper = styled('div')`
  justify-content: center;
  display: flex;
  padding: 8px;
  background-color: #f7c3d0;
  border-radius: 16px 16px 0px 0px;
`;

const TamagotchiMetric = styled('div')`
  padding: 8px;
  display: grid;
  gap: ${space(1)};
  text-transform: capitalize;
  font-size: ${p => p.theme.fontSizeSmall};
  grid-template-columns: 1fr 55%;
`;

const Segment = styled('span', {shouldForwardProp: isPropValid})<{color: string}>`
  display: block;
  width: 100%;
  height: 100%;
  color: ${p => p.theme.black};
  outline: none;
  position: relative;
  background-color: #ffe8ec;
  border: 4px solid #452650;
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
    background-color: #fa7faa;
  }
  & span {
    position: relative;
    z-index: 1;
  }
`;
