import styled from '@emotion/styled';

export const DiffOverlay = styled('span')<{
  $maskSize: string;
  $maskUrl: string;
  $overlayColor: string;
}>`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  background-color: ${p => p.$overlayColor};
  mask-image: url('${p => p.$maskUrl}');
  mask-size: ${p => p.$maskSize};
  mask-position: top left;
  mask-mode: luminance;
  -webkit-mask-image: url('${p => p.$maskUrl}');
  -webkit-mask-size: ${p => p.$maskSize};
  -webkit-mask-position: top left;
`;
