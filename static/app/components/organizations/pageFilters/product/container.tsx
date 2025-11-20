import {type ReactNode} from 'react';

import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import {
  ProductPageFiltersContainerContext,
  usePageFilterProps,
} from 'sentry/components/organizations/pageFilters/product/context';
import {useProductPageFiltersContainerContextValue} from 'sentry/components/organizations/pageFilters/product/utils';
import {DataCategory} from 'sentry/types/core';

interface ProductPageFiltersContainerProps {
  children: ReactNode;
  dataCategories: DataCategory[];
}

export function ProductPageFiltersContainer({
  children,
  dataCategories,
}: ProductPageFiltersContainerProps) {
  const contextValue = useProductPageFiltersContainerContextValue({
    dataCategories,
  });

  return (
    <ProductPageFiltersContainerContext.Provider value={contextValue}>
      <ProductPageFiltersContainerInner>{children}</ProductPageFiltersContainerInner>
    </ProductPageFiltersContainerContext.Provider>
  );
}

interface ProductPageFiltersContainerInner {
  children: ReactNode;
}

function ProductPageFiltersContainerInner({children}: ProductPageFiltersContainerInner) {
  const props = usePageFilterProps();
  return <PageFiltersContainer {...props}>{children}</PageFiltersContainer>;
}
