import {useEffect, useMemo, useState} from 'react';
import isPropValid from '@emotion/is-prop-valid';
import {EmotionJSX} from '@emotion/react/types/jsx-namespace';
import styled from '@emotion/styled';

import tamagotchiEgg from 'sentry-images/tamagotchi/egg.gif';
import tamagotchiHappy from 'sentry-images/tamagotchi/happy.gif';
import tamagotchiMeh from 'sentry-images/tamagotchi/meh.gif';
import tamagotchiSad from 'sentry-images/tamagotchi/sad.gif';

import {Button, ButtonLabel} from 'sentry/components/button';
import Checkbox from 'sentry/components/checkbox';
import QuestionTooltip from 'sentry/components/questionTooltip';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Project} from 'sentry/types';
import useOrganization from 'sentry/utils/useOrganization';
import {useProjectSdkUpdates} from 'sentry/utils/useProjectSdkUpdates';
import {
  getEnergy,
  getHealth,
  getJoy,
  getTidiness,
  useAlertRules,
  useIssues,
} from 'sentry/views/projectDetail/tamagotchi/utils';
import {useReleases} from 'sentry/views/starfish/queries/useReleases';

const CategoryScreenContent = {
  energy: ['Issue Alerts Are Configured', 'Metric Alerts Are Configured'],
  tidiness: ['Releases Are Being Created', 'Projects Are Using Environments'],
  joy: ['Issues Are Assigned', 'Issues Get Resolved'],
  health: ['SDK Version', 'Has Un-Minified Stack Traces'],
};

const MetricToActionsMap = {
  energy: ['hasIssueAlerts', 'hasMetricAlerts'],
  tidiness: ['hasReleases', 'hasEnvironments'],
  joy: ['percentAssigned', 'percentResolved'],
  health: ['sdkIsHealthy', 'minifiedStackTraceIsHealthy'],
};

function StartScreen() {
  return (
    <CardPanel color="#ffe8ec">
      <StartTitle>{t('Press Button for new Tamagotchi')}</StartTitle>
    </CardPanel>
  );
}

function TamagotchiHatchingScreen() {
  return (
    <CardPanel color="#ffe8ec">
      <HatchEggImage height={150} alt="tamagotchi" src={tamagotchiEgg} />
    </CardPanel>
  );
}

function TamagotchiMetricScreen({
  metric,
  metricActions,
}: {
  metric: string;
  metricActions: any;
}) {
  const actionsToCheck = MetricToActionsMap[metric];
  const checkBoxes = CategoryScreenContent[metric].map((item, index) => {
    const isChecked =
      typeof metricActions[metric][actionsToCheck[index]] === 'boolean'
        ? metricActions[metric][actionsToCheck[index]]
        : metricActions[metric][actionsToCheck[index]] > 0;
    return (
      <CheckboxWrapper key={item}>
        <Checkbox checkboxColor="black" checked={isChecked} />
        <h6>{tct('[item]', {item})}</h6>
      </CheckboxWrapper>
    );
  });
  return (
    <CardPanel color="#ffe8ec">
      <TamagotchiMetric key={metric} style={{display: 'flex', alignItems: 'start'}}>
        <MetricHeadingWrapper>
          <h3>{tct('[metric]', {metric})}</h3>
          <QuestionTooltip title="more info" size="sm" />
        </MetricHeadingWrapper>
      </TamagotchiMetric>
      {checkBoxes}
    </CardPanel>
  );
}

function Tamagotchi({project}: {project: Project}) {
  const organization = useOrganization();
  const [start, setStart] = useState(true);
  const [hatchEgg, setHatchEgg] = useState(true);
  const [currentScore, setCurrentScore] = useState(0);
  const [currentStage, setCurrentStage] = useState();
  const [currentCard, setCurrentCard] = useState(4);
  const [showDetails, setShowDetails] = useState(false);

  const tamagotchiStages = useMemo(() => {
    const stages = {
      0: {
        stage: tamagotchiEgg,
        stageName: 'egg',
        stageMinimumScore: 0,
        maxDepletedCategories: 4,
      },
      1: {
        stage: tamagotchiSad,
        stageName: 'sad',
        stageMinimumScore: 1,
        maxDepletedCategories: 3,
      },
      2: {
        stage: tamagotchiMeh,
        stageName: 'meh',
        stageMinimumScore: 200,
        maxDepletedCategories: 2,
      },
      3: {
        stage: tamagotchiHappy,
        stageName: 'happy',
        stageMinimumScore: 300,
        maxDepletedCategories: 1,
      },
    };
    return stages;
  }, []);

  const releases = useReleases();
  const alerts = useAlertRules();
  const issues = useIssues(project);

  const sdkUpdates = useProjectSdkUpdates({
    organization,
    projectId: project.id,
  });

  const tamagotchiMetricActions = useMemo(() => {
    const actions = {
      energy: getEnergy(alerts.data),
      tidiness: getTidiness(releases.data, project),
      joy: getJoy(issues),
      health: getHealth(project, sdkUpdates),
    };
    return actions;
  }, [releases, project, alerts, sdkUpdates, issues]);

  const tamagotchiMetrics = useMemo(() => {
    const metrics = {
      energy: tamagotchiMetricActions.energy.energy * 100,
      tidiness: tamagotchiMetricActions.tidiness.tidiness * 100,
      joy: tamagotchiMetricActions.joy.joy * 100,
      health: tamagotchiMetricActions.health.health * 100,
    };
    return metrics;
  }, [tamagotchiMetricActions]);

  const handleSetCurrentCard = (index: number) => {
    if (currentCard === 4) {
      setStart(false);
    }
    if (index <= 4) {
      setShowDetails(true);
    }
    setCurrentCard(index);
  };

  useEffect(() => {
    if (showDetails) {
      return;
    }
    const calculateScore = () => {
      let totalScore = 0;
      const depletedMetrics: string[] = [];
      Object.keys(tamagotchiMetrics).map(id => {
        totalScore = totalScore + tamagotchiMetrics[id];
        if (!tamagotchiMetrics[id]) {
          depletedMetrics.push(id);
        }
        return id;
      });
      setCurrentScore(totalScore);
      if (totalScore) {
        Object.keys(tamagotchiStages).map(id => {
          if (tamagotchiStages[id].stageMinimumScore <= totalScore) {
            if (depletedMetrics.length <= tamagotchiStages[id].maxDepletedCategories) {
              setCurrentStage(tamagotchiStages[id].stage);
            }
          }
          return id;
        });
      }
    };
    if (!start && !hatchEgg) {
      setCurrentCard(6);
      calculateScore();
    } else if (!start) {
      setTimeout(() => {
        setHatchEgg(false);
        calculateScore();
        setCurrentCard(6);
      }, 3000);
    }
  }, [
    start,
    currentScore,
    tamagotchiMetrics,
    tamagotchiStages,
    hatchEgg,
    showDetails,
    currentStage,
  ]);

  const cards: EmotionJSX.Element[] = [];
  cards.push(
    <TamagotchiMetricScreen metric="energy" metricActions={tamagotchiMetricActions} />
  );
  cards.push(
    <TamagotchiMetricScreen metric="tidiness" metricActions={tamagotchiMetricActions} />
  );
  cards.push(
    <TamagotchiMetricScreen metric="joy" metricActions={tamagotchiMetricActions} />
  );
  cards.push(
    <TamagotchiMetricScreen metric="health" metricActions={tamagotchiMetricActions} />
  );
  cards.push(<StartScreen />);
  cards.push(<TamagotchiHatchingScreen />);
  cards.push(
    <CardPanel color="#ffe8ec">
      <TamagotchiWrapper>
        <img height={70} alt="tamagotchi" src={currentStage} />
      </TamagotchiWrapper>
      {Object.keys(tamagotchiMetrics).map((id, index) => {
        const pctLabel = Math.floor(tamagotchiMetrics[id]);
        return (
          <TamagotchiMetric key={id}>
            <div>
              {
                <MyTextButton
                  priority="primary"
                  size="xs"
                  onClick={() => {
                    handleSetCurrentCard(index);
                  }}
                >
                  {id.charAt(0).toLocaleUpperCase() + id.slice(1)}
                </MyTextButton>
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
          isEnabled={currentCard !== 5 && currentCard !== 6}
          onClick={() => {
            if (currentCard === 4) {
              handleSetCurrentCard(5);
            } else {
              handleSetCurrentCard(6);
            }
          }}
        />
        <TamagotchiButton />
      </MyButtonContainer>
    </TamagotchiContainer>
  );
}

export default Tamagotchi;

const StartTitle = styled('h3')`
  padding-left: 25px;
  padding-right: 25px;
  padding-top: 50px;
`;

const HatchEggImage = styled('img')`
  padding-left: 50px;
  padding-top: 50px;
`;

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

const CheckboxWrapper = styled('div')`
  display: flex;
  gap: ${space(1)};
  align-items: baseline;
  margin-left: ${space(2)};
  margin-right: ${space(1)};
`;

const MetricHeadingWrapper = styled('div')`
  display: flex;
  align-items: baseline;
  gap: ${space(0.5)};
  margin-right: ${space(1)};
  width: 100%;
  padding: ${space(1)};
`;

const MyButtonContainer = styled('div')`
  width: 100%;
  height: 24px;
  top: 320px;
  display: flex;
  flex-direction: row;
  justify-content: center;
  position: absolute;
  gap: 8px;
`;

const CardPanel = styled('div')<{color: string}>`
  width: 212px;
  height: 246px;
  position: absolute;
  margin: auto;
  left: 0;
  right: 0;
  top: 20px;
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
  font-family: silkScreen;
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
  padding: 3px;
  background-color: #f7c3d0;
  border-radius: 16px 16px 0px 0px;
`;

const TamagotchiMetric = styled('div')`
  padding: 8px;
  display: grid;
  gap: ${space(1)};
  text-transform: capitalize;
  font-size: ${p => p.theme.fontSizeSmall};
  justify-items: stretch;
  grid-template-columns: 1fr 55%;
`;

const MyTextButton = styled(Button)`
  width: 100%;

  ${ButtonLabel} {
    justify-content: start;
  }
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
