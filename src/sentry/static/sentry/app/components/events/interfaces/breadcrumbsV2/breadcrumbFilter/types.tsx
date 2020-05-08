import {
  BreadcrumbDetails,
  BreadcrumbType,
  BreadcrumbLevelType,
} from '../../breadcrumbs/types';

export enum FilterGroupType {
  LEVEL = 'level',
  TYPE = 'type',
}

type FilterGroupBase = {
  isChecked: boolean;
  symbol: React.ReactNode;
  description?: string;
};

type FilterGroupTypeType = {
  groupType: FilterGroupType.TYPE;
  type: BreadcrumbType;
} & FilterGroupBase;

type FilterGroupTypeLevel = {
  groupType: FilterGroupType.LEVEL;
  type: BreadcrumbLevelType;
} & FilterGroupBase;

export type FilterGroup = FilterGroupTypeType | FilterGroupTypeLevel;

export type FilterType = BreadcrumbLevelType | BreadcrumbType;

export {BreadcrumbDetails};
