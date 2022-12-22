import {css} from '@emotion/react';
import styled from '@emotion/styled';

import ButtonBar from 'sentry/components/buttonBar';
import IdBadge from 'sentry/components/idBadge';
import type {PlatformKey} from 'sentry/data/platformCategories';
import {IconCheckmark} from 'sentry/icons';
import {t} from 'sentry/locale';
import pulsingIndicatorStyles from 'sentry/styles/pulsingIndicator';
import space from 'sentry/styles/space';

enum BeatStatus {
  AWAITING = 'awaiting',
  PENDING = 'pending',
  COMPLETE = 'complete',
}

type Props = {
  actions: React.ReactNode;
  project: {
    platform: string;
    slug: string;
  };
};

export function HeartbeatFooter({project, actions}: Props) {
  return (
    <Wrapper>
      <PlatformIconAndName
        project={{platform: project.platform as PlatformKey, slug: project.slug}}
        avatarSize={28}
        hideOverflow
        disableLink
      />
      <Beats>
        <Beat status={BeatStatus.AWAITING}>
          <PulsingIndicator>1</PulsingIndicator>
          {t('Awaiting server connection')}
        </Beat>
        <Beat status={BeatStatus.COMPLETE}>
          <PulsingIndicator>
            <IconCheckmark size="xs" />
          </PulsingIndicator>
          {t('Awaiting server connection')}
        </Beat>
        <Beat status={BeatStatus.PENDING}>
          <PulsingIndicator>2</PulsingIndicator>
          {t('Awaiting the first error')}
        </Beat>
      </Beats>
      <Actions gap={1}>{actions}</Actions>
    </Wrapper>
  );
}

const PulsingIndicator = styled('div')`
  ${pulsingIndicatorStyles};
  font-size: ${p => p.theme.fontSizeExtraSmall};
  color: ${p => p.theme.white};
  height: 16px;
  width: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  :before {
    top: auto;
    left: auto;
  }
`;

const Wrapper = styled('div')`
  position: sticky;
  bottom: 0;
  width: 100%;
  display: grid;
  grid-template-columns: max-content 1fr max-content;
  background: ${p => p.theme.background};
  padding: ${space(2)} 0;
  margin-bottom: -${space(3)};
  align-items: center;
  z-index: 1;
  gap: ${space(2)};
  justify-items: flex-end;
  grid-template-columns: 1fr;

  @media (min-width: ${p => p.theme.breakpoints.small}) {
    grid-template-columns: repeat(2, 1fr);
    grid-template-rows: repeat(2, 1fr);
  }

  @media (min-width: ${p => p.theme.breakpoints.large}) {
    grid-template-columns: auto 1fr max-content;
    grid-template-rows: 1fr;
  }
`;

const PlatformIconAndName = styled(IdBadge)`
  width: 100%;
  max-width: 100%;
  overflow: hidden;
`;

const Beats = styled('div')`
  width: 100%;
  display: flex;
  gap: ${space(2)};
  justify-content: center;

  @media (min-width: ${p => p.theme.breakpoints.small}) {
    grid-column: 1/2;
    grid-row: 2/2;
  }

  @media (min-width: ${p => p.theme.breakpoints.large}) {
    grid-column: 2/3;
    grid-row: 1;
  }
`;

const Beat = styled('div')<{status: BeatStatus}>`
  display: flex;
  flex-direction: column;
  gap: ${space(0.25)};
  align-items: center;
  text-align: center;
  font-size: ${p => p.theme.fontSizeMedium};
  margin-bottom: 0;
  width: 100%;
  max-width: 200px;
  color: ${p => p.theme.pink300};

  ${p =>
    p.status === BeatStatus.PENDING &&
    css`
      color: ${p.theme.disabled};
      ${PulsingIndicator} {
        background: ${p.theme.disabled};
        :before {
          content: none;
        }
      }
    `}

  ${p =>
    p.status === BeatStatus.COMPLETE &&
    css`
      color: ${p.theme.successText};
      ${PulsingIndicator} {
        background: ${p.theme.success};
        :before {
          content: none;
        }
      }
    `}

  @media (min-width: ${p => p.theme.breakpoints.large}) {
    min-width: 200px;
  }
`;

const Actions = styled(ButtonBar)`
  width: 100%;
  grid-row-gap: ${space(1)};
  grid-auto-flow: row;

  @media (min-width: ${p => p.theme.breakpoints.small}) {
    width: max-content;
    grid-auto-flow: column;
    grid-column: 2/2;
    grid-row: 2/2;
  }

  @media (min-width: ${p => p.theme.breakpoints.large}) {
    grid-column: 3/3;
    grid-row: 1;
  }
`;
