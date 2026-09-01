import styled from '@emotion/styled';

import {FieldWrapper} from 'sentry/components/forms/fieldGroup/fieldWrapper';

export const UptimeSectionGrid = styled('div')`
  display: grid;
  gap: 0 ${p => p.theme.space.xl};
  grid-template-columns: fit-content(250px) 1fr;
  align-items: center;

  ${FieldWrapper} {
    display: grid;
    grid-template-columns: subgrid;
    grid-column: 1 / -1;
    padding-left: 0;

    label {
      width: auto;
    }
  }

  @container (max-width: ${p => p.theme.container.xl}) {
    ${FieldWrapper} {
      display: flex;
      flex-direction: column;
      align-items: stretch;
      gap: ${p => p.theme.space.md};
    }
  }
`;
