import React from 'react';
import styled from 'react-emotion';

import {t} from 'app/locale';

class SimilarSpectrum extends React.Component {
  render() {
    const {className} = this.props;

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
}

const StyledSimilarSpectrum = styled(SimilarSpectrum)`
  display: flex;
  font-size: ${p => p.theme.fontSizeSmall};
`;

const SpectrumItem = styled('span')`
  border-radius: 2px;
  margin: 5px;
  width: 14px;
  ${p =>
    typeof p.colorIndex !== 'undefined' &&
    `background-color: ${p.theme.similarity.colors[p.colorIndex]};`};
`;

export default StyledSimilarSpectrum;
