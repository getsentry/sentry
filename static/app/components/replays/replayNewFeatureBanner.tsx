import {CSSProperties} from 'react';
import styled from '@emotion/styled';

import newFeatureImage from 'sentry-images/spot/alerts-new-feature-banner.svg';

import {Button} from 'sentry/components/button';
import {Panel} from 'sentry/components/panels';
import {IconBroadcast, IconClose} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

interface Props {
  description: React.ReactNode;
  heading: React.ReactNode;
  button?: React.ReactNode;
  onDismiss?: () => void;
}

export function ReplayNewFeatureBanner({heading, description, button, onDismiss}: Props) {
  return (
    <Wrapper>
      {onDismiss && (
        <CloseButton
          onClick={onDismiss}
          icon={<IconClose size="xs" />}
          aria-label={t('Feature banner close')}
          size="xs"
        />
      )}
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

const Wrapper = styled(Panel)`
  display: flex;
  padding: ${space(2)};
  min-height: 100px;
  justify-content: space-between;
  align-items: center;
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
