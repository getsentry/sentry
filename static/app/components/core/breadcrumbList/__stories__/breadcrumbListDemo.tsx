import type {ReactNode} from 'react';

import {type BreadcrumbListProps, BreadcrumbList} from '@sentry/scraps/breadcrumbList';
import {Flex} from '@sentry/scraps/layout';

interface BreadcrumbListDemoProps {
  items: BreadcrumbListProps['items'];
  title?: ReactNode;
}

export function BreadcrumbListDemo({items, title}: BreadcrumbListDemoProps) {
  return (
    <Flex
      width="100%"
      align="center"
      gap="sm"
      minWidth="0"
      flexGrow={1}
      containerType="inline-size"
    >
      <Flex align="center" gap="sm" minWidth="0" flex="0 1 auto">
        <BreadcrumbList items={items} />
      </Flex>
      {title !== undefined && (
        <Flex align="center" gap="sm" minWidth="0" flexGrow={1}>
          {title}
        </Flex>
      )}
    </Flex>
  );
}
