import styled from '@emotion/styled';

import {Grid} from '@sentry/scraps/layout';

import {FieldWrapper} from 'sentry/components/forms/fieldGroup/fieldWrapper';

export const UptimeSectionGrid = styled(Grid)`
  ${FieldWrapper} {
    display: grid;
    grid-template-columns: subgrid;
    grid-column: 1 / -1;
    padding-left: 0;
    row-gap: ${p => p.theme.space.md};

    label {
      width: auto;
    }
  }
`;
