import styled from '@emotion/styled';

import {SIMILARITY_SCORE_COLORS} from './similarScoreCard';

type Props = {
  highSpectrumLabel: string;
  lowSpectrumLabel: string;
  className?: string;
};

function BaseSimilarSpectrum({className, highSpectrumLabel, lowSpectrumLabel}: Props) {
  return (
    <div className={className}>
      <span>{highSpectrumLabel}</span>
      <SpectrumItem colorIndex={4} />
      <SpectrumItem colorIndex={3} />
      <SpectrumItem colorIndex={2} />
      <SpectrumItem colorIndex={1} />
      <SpectrumItem colorIndex={0} />
      <span>{lowSpectrumLabel}</span>
    </div>
  );
}

const SimilarSpectrum = styled(BaseSimilarSpectrum)`
  display: flex;
  font-size: ${p => p.theme.fontSizeSmall};
`;

type ItemProps = {
  colorIndex: number;
};

const SpectrumItem = styled('span')<ItemProps>`
  border-radius: 2px;
  margin: 5px;
  width: 14px;
  ${p => `background-color: ${SIMILARITY_SCORE_COLORS[p.colorIndex]};`};
`;

export default SimilarSpectrum;
