import {useEffect, useMemo, useState} from 'react';
import isPropValid from '@emotion/is-prop-valid';
import {EmotionJSX} from '@emotion/react/types/jsx-namespace';
import styled from '@emotion/styled';

import tamagotchiEgg from 'sentry-images/tamagotchi/egg.gif';
import tamagotchiHappy from 'sentry-images/tamagotchi/happy.gif';
import tamagotchiMeh from 'sentry-images/tamagotchi/meh.gif';
import tamagotchiSad from 'sentry-images/tamagotchi/sad.gif';

import {Button, ButtonLabel} from 'sentry/components/button';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Project} from 'sentry/types';
import useOrganization from 'sentry/utils/useOrganization';
import {useProjectSdkUpdates} from 'sentry/utils/useProjectSdkUpdates';
import {
  getEnergy,
  getHappiness,
  getHealth,
  getTidiness,
  useAlertRules,
  useIssues,
} from 'sentry/views/projectDetail/tamagotchi/utils';
import {useReleases} from 'sentry/views/starfish/queries/useReleases';

function Tamagotchi({project}: {project: Project}) {
  const organization = useOrganization();
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
  const issues = useIssues(project);
  const sdkUpdates = useProjectSdkUpdates({
    organization,
    projectId: project.id,
  });

  const tamagotchiMetrics = useMemo(() => {
    const metrics = {
      energy: getEnergy(alerts.data).energy * 100,
      tidiness: getTidiness(releases.data, project).tidiness * 100,
      happiness: getHappiness(issues).happiness * 100,
      health: getHealth(project, sdkUpdates).health * 100,
    };
    return metrics;
  }, [releases, project, alerts, sdkUpdates, issues]);

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
      tamagotchiMetrics.tidiness +
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
          isEnabled={currentCard !== 4}
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
