import {
  BreadcrumbDetails,
  BreadcrumbType,
  BreadcrumbLevel,
} from '../../breadcrumbs/types';

export enum FilterGroupType {
  LEVEl = 'level',
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
  groupType: FilterGroupType.LEVEl;
  type: BreadcrumbLevel;
} & FilterGroupBase;

export type FilterGroup = FilterGroupTypeType | FilterGroupTypeLevel;

export type FilterType = BreadcrumbLevel | BreadcrumbType;

export {BreadcrumbDetails};
