import {InfoText} from '@sentry/scraps/info';

import {getResultAttributeKey} from 'sentry/views/classifiers/utils';

interface ResultAttributeNameProps {
  resultAttribute: string;
  align?: 'left' | 'right';
}

export function ResultAttributeName({
  resultAttribute,
  align = 'left',
}: ResultAttributeNameProps) {
  const name = getResultAttributeKey(resultAttribute);

  return (
    <InfoText title={name} mode="overflowOnly" dir="rtl" align={align} variant="inherit">
      <bdi>{name}</bdi>
    </InfoText>
  );
}
