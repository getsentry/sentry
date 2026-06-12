import styled from '@emotion/styled';

type Props = {
  maxLabelSize?: number;
};

export const DetailList = styled('dl')<Props>`
  display: grid;
  gap: ${p => p.theme.space.md};
  grid-template-columns:
    minmax(${p => (p.maxLabelSize ? `${p.maxLabelSize}px` : '110px')}, max-content)
    minmax(0, 1fr);
  margin-bottom: 0;

  dt,
  dd {
    min-width: 0;
    overflow-wrap: anywhere;
  }

  /* Stack labels above values on small screens so long values and labels
     don't force horizontal overflow. */
  @media (max-width: 768px) {
    grid-template-columns: minmax(0, 1fr);
    gap: ${p => p.theme.space.xs};

    dd {
      margin-bottom: ${p => p.theme.space.md};
    }

    dd:last-of-type {
      margin-bottom: 0;
    }
  }
`;
