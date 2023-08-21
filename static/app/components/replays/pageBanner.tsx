import type {ReactNode} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import Panel from 'sentry/components/panels/panel';
import {IconClose} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

interface Props {
  description: ReactNode;
  heading: ReactNode;
  icon: ReactNode;
  image: any;
  title: ReactNode;
  button?: ReactNode;
  onDismiss?: () => void;
}

export default function PageBanner({
  button,
  description,
  heading,
  icon,
  image,
  onDismiss,
  title,
}: Props) {
  return (
    <Wrapper>
      {onDismiss && (
        <CloseButton
          onClick={onDismiss}
          icon={<IconClose size="xs" />}
          aria-label={t('Hide')}
          size="xs"
        />
      )}
      <Background image={image} />
      <Stack>
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
  height: ${p => p.theme.iconSizes.lg};
  width: ${p => p.theme.iconSizes.lg};
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

const Stack = styled('div')`
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  max-width: 50%;
  gap: ${space(1)};
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

const SubText = styled('div')<{}>`
  display: flex;
  color: ${p => p.theme.subText};
  line-height: ${p => p.theme.fontSizeMedium};
  font-size: ${p => p.theme.fontSizeMedium};
  align-items: center;
  gap: ${space(0.5)};
`;

const TypeText = styled(SubText)`
  text-transform: uppercase;
  font-weight: 500;
`;
