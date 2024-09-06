import styled from '@emotion/styled';

import {Button, LinkButton} from 'sentry/components/button';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import {IconClose} from 'sentry/icons/iconClose';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import useDismissAlert from 'sentry/utils/useDismissAlert';

type BannerProps = {
  description: React.ReactNode;
  docsRoute: string;
  image: any;
  localStorageKey: string;
  onPrimaryButtonClick: () => void;
  onSecondaryButtonClick: () => void;
  organization: Organization;
  primaryButtonText: string;
  title: React.ReactNode;
};

function Banner(props: BannerProps) {
  const {dismiss: snooze, isDismissed: isSnoozed} = useDismissAlert({
    key: props.localStorageKey,
    expirationDays: 7,
  });

  const {dismiss, isDismissed} = useDismissAlert({
    key: props.localStorageKey,
    expirationDays: 365,
  });

  if (isDismissed || isSnoozed) {
    return null;
  }

  return (
    <BannerWrapper>
      <ActionsWrapper>
        <BannerTitle>{props.title}</BannerTitle>
        <BannerDescription>{props.description}</BannerDescription>
        <ButtonsWrapper>
          <ActionButton>
            <Button
              priority="primary"
              onClick={event => {
                event.preventDefault();
                props.onPrimaryButtonClick();
              }}
            >
              {props.primaryButtonText}
            </Button>
          </ActionButton>
          <ActionButton>
            <LinkButton
              onClick={props.onSecondaryButtonClick}
              href={props.docsRoute}
              external
            >
              {t('Learn More')}
            </LinkButton>
          </ActionButton>
        </ButtonsWrapper>
      </ActionsWrapper>
      <BannerBackground image={props.image} />
      <CloseDropdownMenu
        position="bottom-end"
        triggerProps={{
          showChevron: false,
          borderless: true,
          icon: <IconClose color="subText" />,
        }}
        size="xs"
        items={[
          {
            key: 'dismiss',
            label: t('Dismiss'),
            onAction: dismiss,
          },
          {
            key: 'snooze',
            label: t('Snooze'),
            onAction: snooze,
          },
        ]}
      />
    </BannerWrapper>
  );
}

const BannerWrapper = styled('div')`
  position: relative;
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  padding: ${space(2)} ${space(3)};
  margin-bottom: ${space(2)};
  background: linear-gradient(
    90deg,
    ${p => p.theme.backgroundSecondary}00 0%,
    ${p => p.theme.backgroundSecondary}FF 70%,
    ${p => p.theme.backgroundSecondary}FF 100%
  );
  container-type: inline-size;
`;

const ActionsWrapper = styled('div')`
  max-width: 50%;
`;

const ButtonsWrapper = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(0.5)};
`;

const BannerTitle = styled('div')`
  font-size: ${p => p.theme.fontSizeExtraLarge};
  margin-bottom: ${space(1)};
  font-weight: ${p => p.theme.fontWeightBold};
`;

const BannerDescription = styled('div')`
  margin-bottom: ${space(1.5)};
`;

const CloseDropdownMenu = styled(DropdownMenu)`
  position: absolute;
  display: block;
  top: ${space(1)};
  right: ${space(1)};
  color: ${p => p.theme.white};
  cursor: pointer;
  z-index: 1;
`;

const BannerBackground = styled('div')<{image: any}>`
  display: flex;
  justify-self: flex-end;
  position: absolute;
  top: 11px;
  right: -15px;
  height: 90%;
  width: 100%;
  max-width: 270px;
  background-image: url(${p => p.image});
  background-repeat: no-repeat;
  background-size: contain;

  @container (max-width: 840px) {
    display: none;
  }
`;

const ActionButton = styled('div')`
  display: flex;
  gap: ${space(1)};
`;

const TraceWarningComponents = {
  Banner,
  BannerBackground,
};

export {TraceWarningComponents};
