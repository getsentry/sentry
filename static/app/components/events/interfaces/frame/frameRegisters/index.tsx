import {useState} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import ClippedBox from 'sentry/components/clippedBox';
import {getMeta} from 'sentry/components/events/meta/metaProxy';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {defined} from 'sentry/utils';

import {getSortedRegisters} from './utils';
import Value from './value';

type Props = {
  registers: Record<string, string | null>;
  deviceArch?: string;
};

const CLIPPED_HEIGHT = 40;

function FrameRegisters({registers, deviceArch}: Props) {
  const [isRevealed, setIsRevealed] = useState(false);
  const [renderedHeight, setRenderedHeight] = useState(0);

  // make sure that clicking on the registers does not actually do
  // anything on the containing element.
  const handlePreventToggling = (event: React.MouseEvent<HTMLDivElement>) => {
    event.stopPropagation();
  };

  const sortedRegisters = getSortedRegisters(registers, deviceArch);

  return (
    <Wrapper>
      <Title>{t('Registers')}</Title>
      <StyledClippedBox
        isRevealed={isRevealed}
        renderedHeight={renderedHeight}
        clipHeight={CLIPPED_HEIGHT}
        onReveal={() => setIsRevealed(true)}
        onSetRenderedHeight={setRenderedHeight}
        clipFade={({showMoreButton}) => {
          return <ClipFade>{showMoreButton}</ClipFade>;
        }}
      >
        <Registers>
          {sortedRegisters.map(([name, value]) => {
            if (!defined(value)) {
              return null;
            }
            return (
              <Register key={name} onClick={handlePreventToggling}>
                {name}
                <Value value={value} meta={getMeta(registers, name)} />
              </Register>
            );
          })}
        </Registers>
      </StyledClippedBox>
    </Wrapper>
  );
}

export default FrameRegisters;

const Wrapper = styled('div')`
  padding: ${space(1)} ${space(1)} ${space(0.5)} calc(${space(4)} + ${space(0.25)});
  display: grid;
  font-size: ${p => p.theme.fontSizeSmall};
  line-height: 1rem;
  margin-top: ${space(0.5)};
  border-top: 1px solid ${p => p.theme.innerBorder};

  @media (min-width: ${p => p.theme.breakpoints[0]}) {
    grid-template-columns: 132px 1fr;
  }
`;

const Title = styled('div')`
  padding-right: ${space(1)};
  padding-bottom: ${space(1)};

  @media (min-width: ${p => p.theme.breakpoints[0]}) {
    padding-bottom: 0;
    padding-right: ${space(1)};
  }
`;

const Registers = styled('div')`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(14.063rem, 1fr));
  gap: ${space(1)};
`;

const Register = styled('div')`
  display: grid;
  gap: ${space(0.5)};
  grid-template-columns: 3em 1fr;
  align-items: center;
  color: ${p => p.theme.gray300};

  @media (min-width: ${p => p.theme.breakpoints[0]}) {
    text-align: right;
  }
`;

const StyledClippedBox = styled(ClippedBox)<{
  isRevealed: boolean;
  renderedHeight: number;
}>`
  margin-left: 0;
  margin-right: 0;
  padding: 0;
  border-top: 0;

  ${p =>
    !p.isRevealed &&
    p.renderedHeight > CLIPPED_HEIGHT &&
    css`
      /* the height of 2 frame rows + button height */
      max-height: calc(${CLIPPED_HEIGHT * 2}px + 28px);

      @media (min-width: ${p.theme.breakpoints[0]}) {
        /* the height of 1 frame row + button height */
        max-height: calc(${CLIPPED_HEIGHT}px + 28px);
      }

      > *:last-child {
        background: ${p.theme.white};
        right: 0;
        bottom: 0;
        width: 100%;
        position: absolute;
      }
    `}
`;

const ClipFade = styled('div')`
  background: ${p => p.theme.white};
  display: flex;
  justify-content: flex-end;
  /* Let pointer-events pass through ClipFade to visible elements underneath it */
  pointer-events: none;
  /* Ensure pointer-events trigger event listeners on "Expand" button */
  > * {
    pointer-events: auto;
  }
`;
