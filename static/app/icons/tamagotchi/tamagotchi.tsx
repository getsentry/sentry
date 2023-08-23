import {useEffect, useMemo, useState} from 'react';
import styled from '@emotion/styled';

import tamagotchiEgg from 'sentry-images/tamagotchi/egg.gif';
import tamagotchiHappy from 'sentry-images/tamagotchi/happy.gif';
import tamagotchiMeh from 'sentry-images/tamagotchi/meh.gif';
import tamagotchiSad from 'sentry-images/tamagotchi/sad.gif';

import {t, tct} from 'sentry/locale';
import {Project, Release} from 'sentry/types';
import {useReleases} from 'sentry/views/starfish/queries/useReleases';

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

function Tamagotchi({project}: {project?: Project}) {
  const [currentScore, setCurrentScore] = useState(0);
  const [currentStage, setCurrentStage] = useState(tamagotchiEgg);
  const [currentStageName, setCurrentStageName] = useState('Hatching Your Tamagatchi');

  const tamagotchiStages = useMemo(() => {
    const stages = {
      0: {
        stage: tamagotchiEgg,
        stageName: 'Egg',
      },
      1: {
        stage: tamagotchiSad,
        stageName: 'Sad',
      },
      2: {
        stage: tamagotchiMeh,
        stageName: 'Meh',
      },
      3: {
        stage: tamagotchiHappy,
        stageName: 'Happy',
      },
    };
    return stages;
  }, []);

  useEffect(() => {
    // Currently allowing 3 seconds for egg to hatch and then set the initial data to the Sad stage
    setTimeout(() => {
      setCurrentScore(1);
      setCurrentStage(tamagotchiStages[1].stage);
      setCurrentStageName(tamagotchiStages[1].stageName);
    }, 3000);
  }, [tamagotchiStages]);

  // These handle clicks are placeholders to allow the buttons to cycle through the stages
  const handleIncreaseClick = () => {
    setCurrentScore(currentScore + 1);
    setCurrentStage(tamagotchiStages[currentScore].stage);
    setCurrentStageName(tamagotchiStages[currentScore].stageName);
  };

  const handleDecreaseClick = () => {
    setCurrentScore(currentScore - 1);
    setCurrentStage(tamagotchiStages[currentScore].stage);
    setCurrentStageName(tamagotchiStages[currentScore].stageName);
  };

  const releases = useReleases();
  const cleanliness = getCleanliness(releases.data, project);

  return (
    <TamagotchiWrapper>
      <h3>{t('Tamagotchi Status: ')}</h3>
      <h4>{currentStageName}</h4>
      <h4>{tct('Cleanliness: [cleanliness]', {cleanliness})}</h4>
      <img height={200} alt="tamagotchi" src={currentStage} />
      <Wrapper>
        <FirstTitle>{t('This is where we can give some message')}</FirstTitle>
        <ButtonWrapper>
          <Button onClick={handleIncreaseClick}>{t('Yes')}</Button>
          <Button onClick={handleDecreaseClick}>{t('Nope 💩')}</Button>
        </ButtonWrapper>
      </Wrapper>
    </TamagotchiWrapper>
  );
}

export default Tamagotchi;

const TamagotchiWrapper = styled('div')`
  font-family: monospace;
`;

const FirstTitle = styled('h4')`
  font-weight: 600;
  font-size: 16px;
  padding: 0px 8px 8px;
  margin: 0;
`;

const Wrapper = styled('div')`
  width: 400px;
  max-height: 500px;
  height: fit-content;
  background-color: #fbf1c7;
  border: 1px solid transparent;
  border-radius: 2px;
  padding: 16px 12px;
  font-weight: 600;
  font-size: 14px;
  position: relative;
  white-space: pre-wrap;
  word-break: break-word;

  :before {
    content: '';
    width: 0px;
    height: 0px;
    position: absolute;
    border-left: 14px solid transparent;
    border-right: 15px solid #fbf1c7;
    border-top: 18px solid transparent;
    border-bottom: 18px solid #fbf1c7;
    top: -36px;
  }
`;

const Button = styled('button')`
  background-color: transparent;
  border: 1px solid rgba(0, 0, 0, 0.25);
  border-radius: 2px;
  width: 100px;
  :hover {
    text-decoration: underline;
  }
`;

const ButtonWrapper = styled('div')`
  display: flex;
  justify-content: space-between;
  padding: 6px 0 0 0;
`;
