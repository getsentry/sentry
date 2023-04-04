import {useState} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import ClippedBox from 'sentry/components/clippedBox';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {defined} from 'sentry/utils';

import {getSortedRegisters} from './utils';
import {FrameRegisterValue} from './value';

type Props = {
  registers: Record<string, string | null>;
  deviceArch?: string;
  meta?: Record<any, any>;
};

const CLIPPED_HEIGHT = 40;

export const FrameRegisters = ({registers, deviceArch, meta}: Props) => {
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
        <RegistersTitle>{t('Registers')}</RegistersTitle>
        <Registers>
          {sortedRegisters.map(([name, value]) => {
            if (!defined(value)) {
              return null;
            }
            return (
              <Register key={name} onClick={handlePreventToggling}>
                {name}
                <FrameRegisterValue value={value} meta={meta?.[name]?.['']} />
              </Register>
            );
          })}
        </Registers>
      </StyledClippedBox>
    </Wrapper>
  );
};

const Wrapper = styled('div')`
  padding: ${space(0.5)} ${space(1.5)};

  @media (min-width: ${p => p.theme.breakpoints.small}) {
    padding: 18px 36px;
  }
`;

const RegistersTitle = styled('div')`
  width: 80px;
  padding: ${space(1)} 0;
`;

const Registers = styled('div')`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(14.063rem, 1fr));
  gap: ${space(1)};
  flex-grow: 1;
`;

const Register = styled('div')`
  display: grid;
  gap: ${space(0.5)};
  grid-template-columns: 3em 1fr;
  align-items: center;
  color: ${p => p.theme.gray300};

  @media (min-width: ${p => p.theme.breakpoints.small}) {
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

  @media (min-width: ${p => p.theme.breakpoints.small}) {
    display: flex;
  }

  ${p =>
    !p.isRevealed &&
    p.renderedHeight > CLIPPED_HEIGHT &&
    css`
      /* the height of 2 frame rows + button height */
      max-height: calc(${CLIPPED_HEIGHT * 2}px + 28px);

      @media (min-width: ${p.theme.breakpoints.small}) {
        /* the height of 1 frame row + button height */
        max-height: calc(${CLIPPED_HEIGHT}px + 28px);
      }

      > *:last-child {
        background: ${p.theme.background};
        right: 0;
        bottom: 0;
        width: 100%;
        position: absolute;
      }
    `}
`;

const ClipFade = styled('div')`
  background: ${p => p.theme.background};
  display: flex;
  justify-content: flex-end;
  /* Let pointer-events pass through ClipFade to visible elements underneath it */
  pointer-events: none;
  /* Ensure pointer-events trigger event listeners on "Expand" button */
  > * {
    pointer-events: auto;
  }
`;
