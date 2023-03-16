import styled from '@emotion/styled';

type TopResultsIndicatorProps = {
  count: number;
  index: number;
};

const TopResultsIndicator = styled('div')<TopResultsIndicatorProps>`
  position: absolute;
  left: -1px;
  margin-top: 4.5px;
  width: 9px;
  height: 15px;
  border-radius: 0 3px 3px 0;

  background-color: ${p => {
    // this background color needs to match the colors used in
    // app/components/charts/eventsChart so that the ordering matches

    // the color pallete contains n + 2 colors, so we subtract 2 here
    return p.theme.charts.getColorPalette(p.count - 2)[p.index];
  }};
`;

export default TopResultsIndicator;
