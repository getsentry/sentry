import {InfoText} from '@sentry/scraps/info';
import type {TextProps} from '@sentry/scraps/text';

import {getResultAttributeKey} from 'sentry/views/classifiers/utils';

interface ResultAttributeNameProps extends Pick<
  TextProps<'span'>,
  'density' | 'monospace' | 'size'
> {
  resultAttribute: string;
  align?: 'left' | 'right';
}

export function ResultAttributeName({
  resultAttribute,
  align = 'left',
  ...textProps
}: ResultAttributeNameProps) {
  const name = getResultAttributeKey(resultAttribute);

  return (
    <InfoText
      title={name}
      mode="overflowOnly"
      dir="rtl"
      align={align}
      variant="inherit"
      {...textProps}
    >
      <bdi>{name}</bdi>
    </InfoText>
  );
}
