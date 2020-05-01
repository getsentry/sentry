import {
  BreadcrumbDetails,
  BreadcrumbType,
  BreadcrumbLevel,
} from '../../breadcrumbs/types';

export enum FilterGroupType {
  LEVEL = 'level',
  TYPE = 'type',
}

type FilterGroupBase = {
  isChecked: boolean;
} & BreadcrumbDetails;

type FilterGroupTypeType = {
  groupType: FilterGroupType.TYPE;
  type: BreadcrumbType;
} & FilterGroupBase;

type FilterGroupTypeLevel = {
  groupType: FilterGroupType.LEVEL;
  type: BreadcrumbLevel;
} & FilterGroupBase;

export type FilterGroup = FilterGroupTypeType | FilterGroupTypeLevel;

export type FilterType = BreadcrumbLevel | BreadcrumbType;

export {BreadcrumbDetails};
