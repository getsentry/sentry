import styled from '@emotion/styled';

import ButtonBar from 'sentry/components/buttonBar';
import OnboardingPanel from 'sentry/components/onboardingPanel';
import {t} from 'sentry/locale';

interface Props {
  children?: React.ReactNode;
}

export default function ReplayOnboardingPanel(props: Props) {
  return (
    <OnboardingPanel image={null}>
      <h3>{t('Playback of Your App')}</h3>
      <p>
        {t(
          'Get to the root cause of an error or latency issue faster by seeing all the technical details related to that issue in one visual replay of your web application.'
        )}
      </p>
      <ButtonList gap={1}>{props.children}</ButtonList>
    </OnboardingPanel>
  );
}

const ButtonList = styled(ButtonBar)`
  grid-template-columns: repeat(auto-fit, minmax(130px, max-content));
  justify-content: center;
`;
