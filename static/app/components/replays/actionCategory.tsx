import {memo} from 'react';
import styled from '@emotion/styled';

import Tooltip from 'sentry/components/tooltip';
import {t} from 'sentry/locale';
import {BreadcrumbType, Crumb} from 'sentry/types/breadcrumbs';

type Props = {
  crumb: Crumb;
};

function getActionCategoryDescription(crumb: Crumb): string {
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

const ActionCategory = memo(function Category({crumb}: Props) {
  const title = getActionCategoryDescription(crumb);

  return (
    <Tooltip title={crumb.description} skipWrapper disableForVisualTest>
      <Value>{title}</Value>
    </Tooltip>
  );
});

const Value = styled('div')`
  color: ${p => p.theme.headingColor};
  font-size: ${p => p.theme.fontSizeMedium};
  font-weight: 400;
  text-transform: capitalize;
`;

export default ActionCategory;
