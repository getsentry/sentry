import React from 'react';
import PropTypes from 'prop-types';
import styled from '@emotion/styled';

import FunctionName from 'app/components/events/interfaces/frame/functionName';
import space from 'app/styles/space';
import {t} from 'app/locale';
import {Frame} from 'app/types';

type Props = {
  frame: Frame;
  onShowAllImages: (filter: string) => void;
};

const ImageForBar = ({frame, onShowAllImages}: Props) => {
  const handleShowAllImages = () => {
    onShowAllImages('');
  };

  return (
    <Wrapper>
      <MatchedFunctionWrapper>
        <MatchedFunctionCaption>{t('Image for: ')}</MatchedFunctionCaption>
        <FunctionName frame={frame} />
      </MatchedFunctionWrapper>
      <ResetAddressFilterCaption onClick={handleShowAllImages}>
        {t('Show all images')}
      </ResetAddressFilterCaption>
    </Wrapper>
  );
};

ImageForBar.propTypes = {
  frame: PropTypes.object.isRequired,
  onShowAllImages: PropTypes.func.isRequired,
};

const Wrapper = styled('div')`
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  padding: ${space(0.5)} ${space(2)};
  background: ${p => p.theme.gray100};
  border-bottom: 1px solid ${p => p.theme.border};
  font-weight: 700;
  code {
    color: ${p => p.theme.blue300};
    font-size: ${p => p.theme.fontSizeSmall};
    background: ${p => p.theme.gray100};
  }
  a {
    color: ${p => p.theme.blue300};
    &:hover {
      text-decoration: underline;
    }
  }
`;

const MatchedFunctionWrapper = styled('div')`
  display: flex;
  align-items: baseline;
`;

const MatchedFunctionCaption = styled('span')`
  font-size: ${p => p.theme.fontSizeSmall};
  font-weight: 400;
  color: ${p => p.theme.gray500};
  flex-shrink: 0;
`;

const ResetAddressFilterCaption = styled('a')`
  display: flex;
  flex-shrink: 0;
  padding-left: ${space(0.5)};
  font-size: ${p => p.theme.fontSizeSmall};
  font-weight: 400;
  color: ${p => p.theme.gray500} !important;
  &:hover {
    color: ${p => p.theme.gray500} !important;
  }
`;

export default ImageForBar;
