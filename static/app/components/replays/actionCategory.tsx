import React, {memo} from 'react';
import styled from '@emotion/styled';

import Tooltip from 'sentry/components/tooltip';
import {t} from 'sentry/locale';
import {BreadcrumbType} from 'sentry/types/breadcrumbs';
import {defined} from 'sentry/utils';

type Props = {
  category?: string | null;
  description?:
    | Record<string, any>
    | {from?: string | undefined; to?: string | undefined}
    | {
        method?:
          | 'POST'
          | 'PUT'
          | 'GET'
          | 'HEAD'
          | 'DELETE'
          | 'CONNECT'
          | 'OPTIONS'
          | 'TRACE'
          | 'PATCH'
          | undefined;
        reason?: string | undefined;
        status_code?: number | undefined;
        url?: string | undefined;
      }
    | undefined
    | null;
};

function getActionCategoryDescription(type: string): string {
  const [category] = type.split('.');
  switch (category) {
    case BreadcrumbType.USER:
    case BreadcrumbType.UI:
      return t('UI Click');
    default:
      return category;
  }
}

const ActionCategory = memo(function Category({category, description}: Props) {
  const title = !defined(category)
    ? t('generic')
    : getActionCategoryDescription(category);

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
