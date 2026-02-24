import type {Tag} from 'sentry/types/group';
import {AttributeDetails} from 'sentry/views/explore/components/attributeDetails';
import {TypeBadge} from 'sentry/views/explore/components/typeBadge';
import type {TraceItemDataset} from 'sentry/views/explore/types';

export function optionFromTag(tag: Tag, traceItemType: TraceItemDataset) {
  return {
    label: tag.name,
    value: tag.key,
    textValue: tag.key,
    trailingItems: <TypeBadge kind={tag.kind} />,
    showDetailsInOverlay: true,
    details: (
      <AttributeDetails
        column={tag.key}
        kind={tag.kind}
        label={tag.name}
        traceItemType={traceItemType}
      />
    ),
  };
}
