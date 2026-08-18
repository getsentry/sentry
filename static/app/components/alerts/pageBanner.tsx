import type {CSSProperties, ReactNode} from 'react';
import styled from '@emotion/styled';

import {Button} from '@sentry/scraps/button';
import {Container, Stack} from '@sentry/scraps/layout';

import {Panel} from 'sentry/components/panels/panel';
import {IconClose} from 'sentry/icons';
import {SvgIcon} from 'sentry/icons/svgIcon';
import {t} from 'sentry/locale';

interface Props {
  description: ReactNode;
  heading: ReactNode;
  icon: ReactNode;
  image: any;
  title: ReactNode;
  button?: ReactNode;
  className?: string;
  hideImageOnSmallScreens?: boolean;
  imageFit?: 'contain' | 'cover';
  imagePosition?: 'left center' | 'right center';
  onDismiss?: () => void;
  style?: CSSProperties;
}

export function PageBanner({
  button,
  className,
  description,
  heading,
  hideImageOnSmallScreens = false,
  icon,
  image,
  imageFit = 'cover',
  imagePosition = 'right center',
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
      <Background
        image={image}
        imageFit={imageFit}
        imagePosition={imagePosition}
        display={
          hideImageOnSmallScreens ? {'screen:2xs': 'none', 'screen:lg': 'flex'} : 'flex'
        }
      />
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
  padding: ${p => p.theme.space.xl};
  min-height: 100px;
  justify-content: space-between;
  align-items: center;
  margin: 0;
`;

const CloseButton = styled(Button)`
  justify-content: center;
  position: absolute;
  top: -${p => p.theme.space.md};
  right: -${p => p.theme.space.md};
  border-radius: 50%;
  height: ${() => SvgIcon.ICON_SIZES.lg};
  width: ${() => SvgIcon.ICON_SIZES.lg};
  z-index: 1;
`;

const Background = styled(Container)<{
  image: any;
  imageFit: 'contain' | 'cover';
  imagePosition: 'left center' | 'right center';
}>`
  justify-self: flex-end;
  position: absolute;
  top: ${p => (p.imageFit === 'contain' ? p.theme.space.md : '0')};
  bottom: ${p => (p.imageFit === 'contain' ? p.theme.space.md : '0')};
  right: 0px;
  width: 50%;
  /* Prevent the image from going behind the text, keep text readable */
  max-width: 500px;
  background-image: url(${p => p.image});
  background-repeat: no-repeat;
  background-position: ${p => p.imagePosition};
  background-size: ${p => p.imageFit};
`;

const TextContainer = styled('div')`
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  z-index: 1;
  h4 {
    margin-bottom: ${p => p.theme.space.xs};
  }
`;

const SubText = styled('div')`
  color: ${p => p.theme.tokens.content.secondary};
  font-size: ${p => p.theme.font.size.md};
  line-height: ${p => p.theme.font.lineHeight.comfortable};
`;

const TypeText = styled(SubText)`
  align-items: center;
  display: flex;
  font-weight: ${p => p.theme.font.weight.sans.regular};
  gap: ${p => p.theme.space.xs};
  text-transform: uppercase;
`;
