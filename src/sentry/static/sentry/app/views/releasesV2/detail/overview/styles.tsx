import styled from '@emotion/styled';

import {SectionHeading as BaseSectionHeading} from 'app/components/charts/styles';
import space from 'app/styles/space';

export const Wrapper = styled('div')`
  margin-bottom: ${space(4)};
`;

export const SectionHeading = styled(BaseSectionHeading)`
  margin: 0 0 ${space(1.5)} 0;
`;
