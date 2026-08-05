import type {ComponentProps, ReactNode} from 'react';

import {BreadcrumbList} from '@sentry/scraps/breadcrumbList';
import {Flex} from '@sentry/scraps/layout';
import {Heading} from '@sentry/scraps/text';

interface BreadcrumbListDemoProps {
  items: ComponentProps<typeof BreadcrumbList>['items'];
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
          {flexProps => (
            <Heading as="h1" variant="inherit" {...flexProps}>
              {title}
            </Heading>
          )}
        </Flex>
      )}
    </Flex>
  );
}
