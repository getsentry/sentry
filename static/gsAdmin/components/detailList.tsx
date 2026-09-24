import styled from '@emotion/styled';

import {DescriptionList, type DescriptionListProps} from '@sentry/scraps/descriptionList';

type Props = {
  maxLabelSize?: number;
};

const StyledDetailList = styled(DescriptionList)<Props>`
  gap: ${p => p.theme.space.md};
  grid-template-columns:
    minmax(${p => (p.maxLabelSize ? `${p.maxLabelSize}px` : '110px')}, max-content)
    minmax(0, 1fr);

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

export function DetailList({terms = 'strong', ...props}: Props & DescriptionListProps) {
  return <StyledDetailList terms={terms} {...props} />;
}
