import styled from '@emotion/styled';

import {t} from 'sentry/locale';

type Props = {
  className?: string;
};

function BaseSimilarSpectrum({className}: Props) {
  return (
    <div className={className}>
      <span>{t('Similar')}</span>
      <SpectrumItem colorIndex={4} />
      <SpectrumItem colorIndex={3} />
      <SpectrumItem colorIndex={2} />
      <SpectrumItem colorIndex={1} />
      <SpectrumItem colorIndex={0} />
      <span>{t('Not Similar')}</span>
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
  ${p => `background-color: ${p.theme.similarity.colors[p.colorIndex]};`};
`;

export default SimilarSpectrum;
