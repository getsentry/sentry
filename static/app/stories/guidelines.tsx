import styled from '@emotion/styled';

import {IconCheckmark} from 'sentry/icons/iconCheckmark';
import {IconClose} from 'sentry/icons/iconClose';
import {Image} from 'sentry/stories/images';
import {space} from 'sentry/styles/space';
import {isChonkTheme} from 'sentry/utils/theme/withChonk';

export function GuidelineLabel(props: {variant: 'do' | 'dont'}) {
  return (
    <Label variant={props.variant}>
      {props.variant === 'do' ? <IconCheckmark /> : <IconClose color="red400" />}
      {props.variant === 'do' ? 'Do' : "Don't"}
    </Label>
  );
}

export function GuidelineImage({
  src,
  text,
  variant,
}: {
  src: string;
  text: string;
  variant: 'do' | 'dont';
}) {
  return (
    <figure>
      <Image src={src} />
      <Figcaption>
        <GuidelineLabel variant={variant} />
        {text}
      </Figcaption>
    </figure>
  );
}

const Figcaption = styled('figcaption')`
  display: grid;
  grid-template-columns: 1fr 2fr;
  align-items: flex-start;
  color: ${p => p.theme.subText};
  padding: ${space(1)} ${space(1)} 0;
`;

const Label = styled('div')<{variant: 'do' | 'dont'}>`
  color: ${p =>
    isChonkTheme(p.theme)
      ? p.variant === 'do'
        ? p.theme.tokens.content.success
        : p.theme.tokens.content.danger
      : p.variant === 'do'
        ? p.theme.green400
        : p.theme.red400};
  align-items: center;
  display: flex;
  font-weight: ${p => p.theme.fontWeightBold};
  gap: ${space(0.5)};
`;
