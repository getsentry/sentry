import React from 'react';
import styled from '@emotion/styled';

import {t} from 'app/locale';
import space from 'app/styles/space';

import {BreadcrumbListItem} from './styles';

const BreadcrumbsListHeader = () => {
  return (
    <BreadcrumbListHeaderWrapper>
      <BreadcrumbListHeaderItem>{t('Type')}</BreadcrumbListHeaderItem>
      <BreadcrumbListHeaderItem>{t('Category')}</BreadcrumbListHeaderItem>
      <BreadcrumbListHeaderItem>{t('Summary')}</BreadcrumbListHeaderItem>
      <BreadcrumbListHeaderItem>{t('Level')}</BreadcrumbListHeaderItem>
      <BreadcrumbListHeaderItem>{t('Datetime')}</BreadcrumbListHeaderItem>
    </BreadcrumbListHeaderWrapper>
  );
};

export default BreadcrumbsListHeader;

const BreadcrumbListHeaderWrapper = styled(BreadcrumbListItem)`
  padding: ${space(2)} ${space(2)} ${space(2)} ${space(3)};
  border-bottom: 1px solid ${p => p.theme.borderDark};
  background: ${p => p.theme.offWhite};
`;

const BreadcrumbListHeaderItem = styled('div')`
  color: ${p => p.theme.gray3};
  font-size: ${p => p.theme.fontSizeSmall};
  font-weight: 600;
  text-transform: uppercase;
  border-radius: 4px 4px 0 0;
  line-height: 1;
`;
