import React from 'react';
import styled from '@emotion/styled';

import TextField from 'app/components/forms/textField';
import {IconSearch, IconClose} from 'app/icons';
import {t} from 'app/locale';
import space from 'app/styles/space';

type Props = {
  searchTerm: string;
  onChangeSearchTerm: TextField['props']['onChange'];
  onClearSearchTerm: () => void;
};

const BreadCrumbsSearch = ({
  searchTerm,
  onChangeSearchTerm,
  onClearSearchTerm,
}: Props) => (
  <Wrapper data-test-id="breadcumber-search">
    <StyledTextField
      name="breadcumber-search"
      placeholder={t('Search breadcrumbs...')}
      autoComplete="off"
      value={searchTerm}
      onChange={onChangeSearchTerm}
    />
    <StyledIconSearch />
    <StyledIconClose show={!!searchTerm} onClick={onClearSearchTerm} isCircled />
  </Wrapper>
);

export default BreadCrumbsSearch;

const Wrapper = styled('div')`
  position: relative;
  display: flex;
  align-items: center;
`;

const StyledTextField = styled(TextField)<TextField['props']>`
  margin-bottom: 0;
  input {
    height: 28px;
    padding-left: ${space(4)};
    padding-right: ${space(4)};
  }
`;

const StyledIconSearch = styled(IconSearch)`
  position: absolute;
  color: ${p => p.theme.gray500};
  font-size: ${p => p.theme.fontSizeMedium};
  left: ${space(1)};
`;

const StyledIconClose = styled(IconClose, {
  shouldForwardProp: p => p !== 'show',
})<{
  show: boolean;
}>`
  position: absolute;
  cursor: pointer;
  color: ${p => p.theme.gray400};
  right: ${space(0.75)};
  visibility: ${p => (p.show ? 'visible' : 'hidden')};
`;
