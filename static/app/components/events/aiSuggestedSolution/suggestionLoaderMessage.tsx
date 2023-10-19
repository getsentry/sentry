import {useEffect, useState} from 'react';
import styled from '@emotion/styled';
import shuffle from 'lodash/shuffle';

import {t} from 'sentry/locale';

const LOADING_MESSAGES = [
  t('Heating up them GPUs'),
  t('Engineering a prompt'),
  t('Demonstrating value'),
  t('Moving the needle'),
  t('Preventing prompt injection attacks'),
  t('Remove traces of depression from answers'),
  t('Reticulating splines or whatever'),
  t('Loading marketing material'),
  t('Wiping node_modules'),
  t('Installing dependencies'),
  t('Searching StackOverflow'),
  t('Googling for solutions'),
  t('Running spell checker'),
  t('Searching for the perfect emoji'),
  t('Adding trace amounts of human touch'),
  t("Don't be like Sydney, don't be like Sydney"),
  t('Initiating quantum leap'),
  t('Charging flux capacitors'),
  t('Summoning a demon'),
];

export function SuggestionLoaderMessage() {
  const [messages] = useState(() => shuffle(LOADING_MESSAGES));
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(
      () => {
        if (messageIndex < messages.length - 1) {
          setMessageIndex(messageIndex + 1);
        }
      },
      Math.random() * 700 + 800
    );
    return () => clearInterval(id);
  });

  return (
    <div>
      <Message>{`${messages[messageIndex]}\u2026`}</Message>
    </div>
  );
}

const Message = styled('div')`
  color: ${p => p.theme.gray300};
  font-size: ${p => p.theme.fontSizeLarge};
`;
