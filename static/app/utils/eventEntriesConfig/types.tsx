import {IssueType, PlatformType} from 'sentry/types';

export type ResourceLink = {
  link: string;
  text: string;
};

export type EventConfig = {
  evidence?: {
    helpText: string;
    title: string;
  };
  resources?: {
    description: string;
    links: ResourceLink[];
    linksByPlatform: Partial<Record<PlatformType, ResourceLink[]>>;
  };
};

export type EventEntriesIssueTypeMapping<T extends IssueType = IssueType> = Partial<
  Record<T, EventConfig>
> & {
  _default: EventConfig;
};
