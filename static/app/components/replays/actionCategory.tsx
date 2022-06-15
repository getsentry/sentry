import {memo} from 'react';
import styled from '@emotion/styled';

import Tooltip from 'sentry/components/tooltip';
import {t} from 'sentry/locale';
import {BreadcrumbType, Crumb} from 'sentry/types/breadcrumbs';

type Props = {
  action: Crumb;
};

type ActionCategoryInfo = {
  description: string;
  title: string;
};

function getActionCategoryInfo(crumb: Crumb): ActionCategoryInfo {
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
        description: `${crumb.category}: ${crumb.data?.from ?? ''} => ${
          crumb.data?.to ?? ''
        }`,
      };
    case BreadcrumbType.ERROR:
      return {
        title: t('Error'),
        description: `${crumb.data?.type}: ${crumb.data?.value}`,
      };
    case BreadcrumbType.INIT:
      return {
        title: t('Replay Start'),
        description: crumb.data?.url,
      };
    default:
      return {
        title: t('Default'),
        description: '',
      };
  }
}

const ActionCategory = memo(({action}: Props) => {
  const {title, description} = getActionCategoryInfo(action);

  return (
    <Tooltip title={description} disabled={!description} skipWrapper disableForVisualTest>
      <Value>{action.type}</Value>
    </Tooltip>
  );
});

const Value = styled('div')`
  text-transform: capitalize;
`;

export default ActionCategory;
