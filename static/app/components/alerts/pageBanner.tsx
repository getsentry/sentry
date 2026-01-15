import type {CSSProperties, ReactNode} from 'react';
import styled from '@emotion/styled';

import {Stack} from '@sentry/scraps/layout';

import {Button} from 'sentry/components/core/button';
import Panel from 'sentry/components/panels/panel';
import {IconClose} from 'sentry/icons';
import {SvgIcon} from 'sentry/icons/svgIcon';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

interface Props {
  description: ReactNode;
  heading: ReactNode;
  icon: ReactNode;
  image: any;
  title: ReactNode;
  button?: ReactNode;
  className?: string;
  onDismiss?: () => void;
  style?: CSSProperties;
}

export default function PageBanner({
  button,
  className,
  description,
  heading,
  icon,
  image,
  onDismiss,
  style,
  title,
}: Props) {
  return (
    <Wrapper className={className} style={style}>
      {onDismiss && (
        <CloseButton
          onClick={onDismiss}
          icon={<IconClose />}
          aria-label={t('Hide')}
          size="xs"
        />
      )}
      <Background image={image} />
      <Stack justify="between" gap="md" maxWidth="50%">
        <TypeText>
          {icon}
          {title}
        </TypeText>
        <TextContainer>
          <h4>{heading}</h4>
          <SubText>{description}</SubText>
        </TextContainer>
      </Stack>
      {button}
    </Wrapper>
  );
}

const Wrapper = styled(Panel)`
  display: flex;
  padding: ${space(2)};
  min-height: 100px;
  justify-content: space-between;
  align-items: center;
  margin: 0;
`;

const CloseButton = styled(Button)`
  justify-content: center;
  position: absolute;
  top: -${space(1)};
  right: -${space(1)};
  border-radius: 50%;
  height: ${() => SvgIcon.ICON_SIZES.lg};
  width: ${() => SvgIcon.ICON_SIZES.lg};
  z-index: 1;
`;

const Background = styled('div')<{image: any}>`
  display: flex;
  justify-self: flex-end;
  position: absolute;
  top: 0px;
  right: 0px;
  height: 100%;
  width: 50%;
  /* Prevent the image from going behind the text, keep text readable */
  max-width: 500px;
  background-image: url(${p => p.image});
  background-repeat: no-repeat;
  background-size: cover;
`;

const TextContainer = styled('div')`
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  z-index: 1;
  h4 {
    margin-bottom: ${space(0.5)};
  }
`;

const SubText = styled('div')`
  color: ${p => p.theme.tokens.content.secondary};
  font-size: ${p => p.theme.fontSize.md};
  line-height: ${p => p.theme.text.lineHeightBody};
`;

const TypeText = styled(SubText)`
  align-items: center;
  display: flex;
  font-weight: ${p => p.theme.fontWeight.normal};
  gap: ${space(0.5)};
  text-transform: uppercase;
`;
