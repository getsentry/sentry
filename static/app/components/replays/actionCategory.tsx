import {memo} from 'react';
import styled from '@emotion/styled';

import Tooltip from 'sentry/components/tooltip';
import {t} from 'sentry/locale';
import {BreadcrumbType, RawCrumb} from 'sentry/types/breadcrumbs';

import {convertCrumbType} from '../events/interfaces/breadcrumbs/utils';

type Props = {
  action: RawCrumb;
};

type actionCategoryInfo = {
  description: string;
  title: string;
};

function getActionCategoryInfo(crumb: RawCrumb): actionCategoryInfo {
  switch (crumb.type) {
    case BreadcrumbType.USER:
    case BreadcrumbType.UI:
      return {
        title: t('UI Click'),
        description: `${crumb.category}: ${crumb.message}`,
      };
    case BreadcrumbType.NAVIGATION:
      return {
        title: t('Navigation'),
        description: `${crumb.category}: ${crumb.data?.from} => ${crumb.data?.to}`,
      };
    case BreadcrumbType.ERROR:
      return {title: t('Error'), description: `${crumb.category}: ${crumb.message}`};
    default:
      return {
        title: '',
        description: '',
      };
  }
}

const ActionCategory = memo(function Category({action}: Props) {
  const {title, description} = getActionCategoryInfo(convertCrumbType(action));

  return (
    <Tooltip title={description} disabled={!description} skipWrapper disableForVisualTest>
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
