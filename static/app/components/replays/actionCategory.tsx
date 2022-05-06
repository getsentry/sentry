import {memo} from 'react';
import styled from '@emotion/styled';

import Tooltip from 'sentry/components/tooltip';
import {t} from 'sentry/locale';
import {
  BreadcrumbType,
  BreadcrumbTypeHTTP,
  BreadcrumbTypeNavigation,
  RawCrumb,
} from 'sentry/types/breadcrumbs';

import {convertCrumbType} from '../events/interfaces/breadcrumbs/utils';

type Props = {
  category: RawCrumb;
  description?: BreadcrumbTypeNavigation | BreadcrumbTypeHTTP;
};

function getActionCategoryDescription(crumb: RawCrumb): string {
  switch (crumb.type) {
    case BreadcrumbType.USER:
    case BreadcrumbType.UI:
      return t('UI Click');
    case BreadcrumbType.HTTP:
      return t('Fetch');
    case BreadcrumbType.NAVIGATION:
      return t('Navigation');
    case BreadcrumbType.ERROR:
      return t('Error');
    default:
      return '';
  }
}

const ActionCategory = memo(function Category({category, description}: Props) {
  const title = getActionCategoryDescription(convertCrumbType(category));

  return (
    <Wrapper>
      <Tooltip
        title={description}
        disabled={!description}
        skipWrapper
        disableForVisualTest
      >
        <Value>{title}</Value>
      </Tooltip>
    </Wrapper>
  );
});

const Wrapper = styled('div')`
  display: flex;
  justify-content: center;
  position: relative;
  :before {
    content: '';
    display: block;
    width: 1px;
    top: 0;
    bottom: 0;
    left: 50%;
    transform: translate(-50%);
    position: absolute;
  }
`;
const Value = styled('div')`
  color: ${p => p.theme.headingColor};
  font-size: ${p => p.theme.fontSizeMedium};
  font-weight: 400;
  text-transform: capitalize;
`;

export default ActionCategory;
