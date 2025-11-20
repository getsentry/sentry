import {createContext, useContext, useMemo} from 'react';

import type {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import {getProductPageFiltersContainerContextValueForDataCategory} from 'sentry/components/organizations/pageFilters/product/utils';
import type {TimeRangeSelectorProps} from 'sentry/components/timeRangeSelector';
import {DataCategory} from 'sentry/types/core';
import {defined} from 'sentry/utils';
import useOrganization from 'sentry/utils/useOrganization';

export type ProductPageFiltersContextValue = Pick<
  TimeRangeSelectorProps,
  'defaultPeriod' | 'maxPickableDays' | 'relativeOptions'
>;

export const ProductPageFiltersContainerContext =
  createContext<ProductPageFiltersContextValue | null>(null);

function useProductPageFiltersContainerContext() {
  const context = useContext(ProductPageFiltersContainerContext);
  if (context === null) {
    throw new Error(
      'useProductPageFIltersContainerContext must be used with a ProductPageFiltersContainer'
    );
  }
  return context;
}

type PageFilterProps = Partial<React.ComponentProps<typeof PageFiltersContainer>>;

export function usePageFilterProps(): PageFilterProps {
  const contextValue = useProductPageFiltersContainerContext();

  return useMemo(() => {
    const props: PageFilterProps = {};

    if (contextValue.defaultPeriod) {
      props.defaultSelection = {
        datetime: {
          period: contextValue.defaultPeriod,
          start: null,
          end: null,
          utc: null,
        },
      };
    }

    if (contextValue.maxPickableDays) {
      props.maxPickableDays = contextValue.maxPickableDays;
    }

    return props;
  }, [contextValue]);
}

type DatePageFilterProps = Partial<React.ComponentProps<typeof DatePageFilter>>;

export function useProductDatePageFilterProps(): DatePageFilterProps {
  const contextValue = useProductPageFiltersContainerContext();
  return useMemo(() => {
    const props: DatePageFilterProps = {};

    if (contextValue.defaultPeriod) {
      props.defaultPeriod = contextValue.defaultPeriod;
    }

    if (contextValue.maxPickableDays) {
      props.maxPickableDays = contextValue.maxPickableDays;
    }

    if (contextValue.relativeOptions) {
      props.relativeOptions = contextValue.relativeOptions;
    }

    return props;
  }, [contextValue]);
}

export function useProductPageFiltersContainerContextValue({
  dataCategories,
}: {
  dataCategories: DataCategory[];
}): ProductPageFiltersContextValue {
  const organization = useOrganization();

  return useMemo(() => {
    if (dataCategories.length <= 0) {
      return {};
    }

    const productPageFiltersContextValues = dataCategories
      .map(dataCategory =>
        getProductPageFiltersContainerContextValueForDataCategory(
          dataCategory,
          organization
        )
      )
      .filter(value => defined(value.maxPickableDays));

    if (productPageFiltersContextValues.length <= 0) {
      return {};
    }

    return productPageFiltersContextValues.reduce((val, cur) => {
      if (!defined(val.maxPickableDays)) {
        return cur;
      }
      if (!defined(cur.maxPickableDays)) {
        return val;
      }
      return val.maxPickableDays > cur.maxPickableDays ? val : cur;
    }, productPageFiltersContextValues[0]!);
  }, [dataCategories, organization]);
}
