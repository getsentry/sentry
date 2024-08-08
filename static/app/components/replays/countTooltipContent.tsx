import styled from '@emotion/styled';

const CountTooltipContent = styled('dl')`
  display: grid;
  grid-template-columns: 1fr minmax(auto, max-content);
  gap: ${p => p.theme.space(1)} ${p => p.theme.space(3)};
  text-align: left;
  align-items: start;
  margin-bottom: 0;
`;

export default CountTooltipContent;
