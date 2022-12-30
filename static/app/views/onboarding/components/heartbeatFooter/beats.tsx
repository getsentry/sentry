import {Fragment} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import Placeholder from 'sentry/components/placeholder';
import {IconCheckmark} from 'sentry/icons';
import {t} from 'sentry/locale';
import pulsingIndicatorStyles from 'sentry/styles/pulsingIndicator';
import space from 'sentry/styles/space';
import {Group} from 'sentry/types';

enum BeatStatus {
  AWAITING = 'awaiting',
  PENDING = 'pending',
  COMPLETE = 'complete',
}

type Props = {
  firstErrorReceived: boolean | Group;
  loading: boolean;
  serverConnected: boolean;
};

export function Beats({loading, serverConnected, firstErrorReceived}: Props) {
  return (
    <Wrapper>
      {loading ? (
        <Fragment>
          <LoadingPlaceholder height="28px" />
          <LoadingPlaceholder height="28px" />
        </Fragment>
      ) : firstErrorReceived ? (
        <Fragment>
          <Beat status={BeatStatus.COMPLETE}>
            <IconCheckmark size="16px" isCircled />
            {t('DSN response received')}
          </Beat>
          <Beat status={BeatStatus.COMPLETE}>
            <IconCheckmark size="16px" isCircled />
            {t('First error received')}
          </Beat>
        </Fragment>
      ) : serverConnected ? (
        <Fragment>
          <Beat status={BeatStatus.COMPLETE}>
            <IconCheckmark size="16px" isCircled />
            {t('DSN response received')}
          </Beat>
          <Beat status={BeatStatus.AWAITING}>
            <PulsingIndicator>2</PulsingIndicator>
            {t('Awaiting first error')}
          </Beat>
        </Fragment>
      ) : (
        <Fragment>
          <Beat status={BeatStatus.AWAITING}>
            <PulsingIndicator>1</PulsingIndicator>
            {t('Awaiting DSN response')}
          </Beat>
          <Beat status={BeatStatus.PENDING}>
            <PulsingIndicator>2</PulsingIndicator>
            {t('Awaiting first error')}
          </Beat>
        </Fragment>
      )}
    </Wrapper>
  );
}

const Wrapper = styled('div')`
  display: none;

  @media (min-width: ${p => p.theme.breakpoints.small}) {
    gap: ${space(2)};
    display: grid;
    grid-template-columns: repeat(2, max-content);
    justify-content: center;
    align-items: center;
  }
`;

export const LoadingPlaceholder = styled(Placeholder)`
  width: 100%;
  max-width: ${p => p.width};
`;

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

const Beat = styled('div')<{status: BeatStatus}>`
  width: 160px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${space(0.5)};
  font-size: ${p => p.theme.fontSizeSmall};
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
`;
