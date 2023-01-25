import {Fragment} from 'react';
import styled from '@emotion/styled';

export default {
  title: 'Components/Icons',
};

const fontSizes = [12, 14, 16];
const fontWeights = [400, 600];

export const _Confirm = () => (
  <div>
    {fontWeights.map(weight => (
      <Row key={weight} style={{fontWeight: weight}}>
        {fontSizes.map(size => (
          <Fragment key={size}>
            <strong style={{fontSize: size}}>Size: {size}px</strong>
            <Pair style={{fontSize: size}}>
              <CheckIcon
                width={size}
                height={size}
                weight={weight}
                viewBox="0 0 14 14"
                fill="none"
              >
                <path
                  d="M1.75 7.875L5.6875 12.25L12.25 2.1875"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </CheckIcon>
              <p>Done</p>
            </Pair>
            <Pair style={{fontSize: size}}>
              <GroupIcon
                width={size}
                height={size}
                weight={weight}
                viewBox="0 0 14 14"
                fill="none"
              >
                <path
                  d="M7.95375 7.4025C7.95375 8.63625 6.95625 9.6425 5.71375 9.6425C4.47126 9.6425 3.47375 8.645 3.47375 7.4025V5.495C3.47375 4.26126 4.47126 3.255 5.71375 3.255C6.95625 3.255 7.95375 4.25251 7.95375 5.495V7.4025Z"
                  stroke="#2B2233"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M4.15624 9.00375L2.42374 9.2925C1.41749 9.45875 0.673737 10.3338 0.673737 11.3488V12.6875C0.673737 13.0725 0.988737 13.3875 1.37374 13.3875H10.045C10.43 13.3875 10.745 13.0725 10.745 12.6875V11.3488C10.745 10.325 10.01 9.45875 8.99499 9.2925L7.26249 9.00375"
                  stroke="#2B2233"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M6.04626 3.28125V2.9575C6.04626 1.72375 7.04376 0.717499 8.28626 0.717499C9.52876 0.717499 10.5263 1.715 10.5263 2.9575V4.865C10.5263 6.09875 9.52876 7.105 8.28626 7.105C8.17251 7.105 8.05876 7.105 7.95376 7.07875"
                  stroke="#2B2233"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M10.6837 10.85H12.6175C13.0025 10.85 13.3175 10.535 13.3175 10.15V8.81125C13.3175 7.7875 12.5825 6.92125 11.5675 6.755L9.83499 6.46625"
                  stroke="#2B2233"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </GroupIcon>
              <p>Group</p>
            </Pair>

            <div />
            <div />
            <div />
            <div />
            <div />
            <div />
          </Fragment>
        ))}
      </Row>
    ))}
  </div>
);

const Row = styled('div')`
  width: max-content;
  display: grid;
  grid-auto-flow: column;
  align-items: center;
  gap: 16px;
  margin: 12px 12px 36px;

  p {
    margin: 0;
    font-weight: inherit;
    font-size: inherit;
  }

  strong {
    font-weight: inherit;
    color: ${p => p.theme.subText};
    width: 5rem;
  }
`;

const Pair = styled('div')`
  display: grid;
  grid-auto-flow: column;
  align-items: center;
  justify-content: left;
  gap: 4px;

  width: 4rem;
`;

const Icon = styled('svg')`
  --size-factor: 0.04;
  --weight-factor: ${p => (p.weight > 500 ? 1.25 : 1)};

  display: block;
  width: 1em;
  height: 1em;
  stroke: ${p => p.theme.textColor};
  stroke-width: calc(
    (0.6px + var(--size-factor) * 1em) * var(--weight-factor, 1) *
      var(--optical-factor, 1)
  );
`;

const CheckIcon = styled(Icon)`
  --optical-factor: 1.15;
`;

const GroupIcon = styled(Icon)`
  --optical-factor: 1;
`;
