import type {ReactNode} from 'react';
import {ClassNames} from '@emotion/react';
import styled from '@emotion/styled';

import {Button, LinkButton} from 'sentry/components/button';
import {Hovercard} from 'sentry/components/hovercard';
import {IconOpen, IconQuestion} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {trackAnalytics} from 'sentry/utils/analytics';
import useOrganization from 'sentry/utils/useOrganization';

function Resource({
  title,
  subtitle,
  link,
}: {
  link: string;
  subtitle: ReactNode;
  title: string;
}) {
  const organization = useOrganization();
  return (
    <StyledLinkButton
      icon={<IconOpen />}
      borderless
      external
      href={link}
      onClick={() => {
        trackAnalytics('replay.details-resource-docs-clicked', {
          organization,
          title,
        });
      }}
    >
      <ButtonContent>
        <ButtonTitle>{title}</ButtonTitle>
        <ButtonSubtitle>{subtitle}</ButtonSubtitle>
      </ButtonContent>
    </StyledLinkButton>
  );
}

function ResourceButtons() {
  return (
    <ButtonContainer>
      <Resource
        title={t('General')}
        subtitle={t('Configure sampling rates and recording thresholds')}
        link="https://docs.sentry.io/platforms/javascript/session-replay/configuration/#general-integration-configuration"
      />
      <Resource
        title={t('Element Masking/Blocking')}
        subtitle={t('Unmask text (****) and unblock media (img, svg, video, etc.)')}
        link="https://docs.sentry.io/platforms/javascript/session-replay/privacy/#privacy-configuration"
      />
      <Resource
        title={t('Identify Users')}
        subtitle={t('Identify your users through a specific attribute, such as email.')}
        link="https://docs.sentry.io/platforms/javascript/session-replay/configuration/#identifying-users"
      />
      <Resource
        title={t('Network Details')}
        subtitle={t('Capture request and response headers or bodies')}
        link="https://docs.sentry.io/platforms/javascript/session-replay/configuration/#network-details"
      />
      <Resource
        title={t('Canvas Support')}
        subtitle={tct(
          'Opt-in to record HTML [code:canvas] elements, added in SDK version 7.98.0',
          {code: <code />}
        )}
        link="https://docs.sentry.io/platforms/javascript/session-replay/#canvas-recording"
      />
    </ButtonContainer>
  );
}

export default function ConfigureReplayCard() {
  return (
    <ClassNames>
      {({css}) => (
        <Hovercard
          body={<ResourceButtons />}
          bodyClassName={css`
            padding: ${space(1)};
          `}
          position="top-end"
        >
          <Button
            size="sm"
            icon={<IconQuestion />}
            aria-label={t('replay configure resources')}
          >
            {t('Configure Replay')}
          </Button>
        </Hovercard>
      )}
    </ClassNames>
  );
}

const ButtonContainer = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(1)};
  align-items: flex-start;
`;

const ButtonContent = styled('div')`
  display: flex;
  flex-direction: column;
  text-align: left;
  white-space: pre-line;
  gap: ${space(0.25)};
`;

const ButtonTitle = styled('div')`
  font-weight: ${p => p.theme.fontWeightNormal};
`;

const ButtonSubtitle = styled('div')`
  color: ${p => p.theme.gray300};
  font-weight: ${p => p.theme.fontWeightNormal};
  font-size: ${p => p.theme.fontSizeSmall};
`;

const StyledLinkButton = styled(LinkButton)`
  padding: ${space(1)};
  height: auto;
`;
