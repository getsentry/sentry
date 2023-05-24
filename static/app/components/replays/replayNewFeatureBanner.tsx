import {CSSProperties} from 'react';
import styled from '@emotion/styled';

import newFeatureImage from 'sentry-images/spot/alerts-new-feature-banner.svg';

import {IconBroadcast, IconClose} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

interface NewFeatureBannerProps {
  description: React.ReactNode;
  heading: React.ReactNode;
  onDismiss: () => void;
  button?: React.ReactNode;
}

export function NewFeatureBanner({
  heading,
  description,
  button,
  onDismiss,
}: NewFeatureBannerProps) {
  return (
    <Wrapper>
      <CloseBtn onClick={onDismiss}>
        <IconClose size="xs" />
      </CloseBtn>
      <Background />
      <Stack>
        <SubText uppercase fontWeight={500}>
          <IconBroadcast />
          <span>{t('Whats New')}</span>
        </SubText>
        <TextContainer>
          <h4>{heading}</h4>
          <SubText>{description}</SubText>
        </TextContainer>
      </Stack>
      {button}
    </Wrapper>
  );
}

const Wrapper = styled('div')`
  position: relative;
  display: flex;
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  padding: ${space(2)};
  margin-bottom: ${space(2)};
  min-height: 100px;
  justify-content: space-between;
  align-items: center;
`;

const CloseBtn = styled('button')`
  display: flex;
  justify-content: center;
  align-items: center;
  position: absolute;
  top: -${space(1)};
  right: -${space(1)};
  border: 1px solid ${p => p.theme.border};
  border-radius: 50%;
  background-color: ${p => p.theme.background};
  height: ${p => p.theme.iconSizes.lg};
  width: ${p => p.theme.iconSizes.lg};
  z-index: 1;
`;

const Background = styled('div')`
  display: flex;
  justify-self: flex-end;
  position: absolute;
  top: 0px;
  right: 0px;
  height: 100%;
  width: 50%;
  max-width: 500px;
  background-image: url(${newFeatureImage});
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

const SubText = styled('div')<{
  fontSize?: 'sm';
  fontWeight?: CSSProperties['fontWeight'];
  uppercase?: boolean;
}>`
  display: flex;
  text-transform: ${p => (p.uppercase ? 'uppercase' : undefined)};
  color: ${p => p.theme.subText};
  line-height: ${p => p.theme.fontSizeMedium};
  font-size: ${p => p.theme.fontSizeMedium};
  font-weight: ${p => p.fontWeight};
  align-items: center;
  gap: ${space(0.5)};
`;
