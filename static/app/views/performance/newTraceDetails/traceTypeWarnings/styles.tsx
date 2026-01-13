import styled from '@emotion/styled';

import {Flex} from '@sentry/scraps/layout';

import {Button} from 'sentry/components/core/button';
import {LinkButton} from 'sentry/components/core/button/linkButton';
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
        <Flex align="center" gap="xs">
          <Flex gap="md">
            <Button
              priority="primary"
              onClick={event => {
                event.preventDefault();
                props.onPrimaryButtonClick();
              }}
            >
              {props.primaryButtonText}
            </Button>
          </Flex>
          <Flex gap="md">
            <LinkButton
              onClick={props.onSecondaryButtonClick}
              href={props.docsRoute}
              external
            >
              {t('Learn More')}
            </LinkButton>
          </Flex>
        </Flex>
      </ActionsWrapper>
      <BannerBackground image={props.image} />
      <CloseDropdownMenu
        position="bottom-end"
        triggerProps={{
          showChevron: false,
          borderless: true,
          icon: <IconClose variant="muted" />,
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
  border: 1px solid ${p => p.theme.tokens.border.primary};
  border-radius: ${p => p.theme.radius.md};
  padding: ${space(2)} ${space(3)};
  background: linear-gradient(
    90deg,
    color-mix(in srgb, ${p => p.theme.tokens.background.secondary} 0%, transparent) 0%,
    ${p => p.theme.tokens.background.secondary} 70%,
    ${p => p.theme.tokens.background.secondary} 100%
  );
  container-type: inline-size;
`;

const ActionsWrapper = styled('div')`
  max-width: 50%;
`;

const BannerTitle = styled('div')`
  font-size: ${p => p.theme.fontSize.xl};
  margin-bottom: ${space(1)};
  font-weight: ${p => p.theme.fontWeight.bold};
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

const TraceWarningComponents = {
  Banner,
  BannerBackground,
};

export {TraceWarningComponents};
