import {useMemo} from 'react';
import styled from '@emotion/styled';

import type {SelectOption} from 'sentry/components/core/compactSelect';
import {t} from 'sentry/locale';
import type {TagCollection} from 'sentry/types/group';
import {FieldKind} from 'sentry/utils/fields';
import {AttributeDetails} from 'sentry/views/explore/components/attributeDetails';
import {TypeBadge} from 'sentry/views/explore/components/typeBadge';
import {UNGROUPED} from 'sentry/views/explore/contexts/pageParamsContext/groupBys';

interface UseGroupByFieldsProps {
  /**
   * All the group bys that are in use. They will be injected if
   * they dont exist already.
   */
  groupBys: string[];
  tags: TagCollection;
  prefix?: string;
}

export function useGroupByFields({tags, groupBys}: UseGroupByFieldsProps) {
  const options: Array<SelectOption<string>> = useMemo(() => {
    const potentialOptions = [
      // We do not support grouping by span id, we have a dedicated sample mode for that
      ...Object.keys(tags).filter(key => key !== 'id'),

      // These options aren't known to exist on this project but it was inserted into
      // the group bys somehow so it should be a valid options in the group bys.
      //
      // One place this may come from is when switching projects/environment/date range,
      // a tag may disappear based on the selection.
      ...groupBys.filter(groupBy => groupBy && !tags.hasOwnProperty(groupBy)),
    ];
    potentialOptions.sort();

    return [
      // hard code in an empty option
      {
        label: <Disabled>{t('\u2014')}</Disabled>,
        value: UNGROUPED,
        textValue: t('\u2014'),
      },
      ...potentialOptions.map(key => {
        const kind = FieldKind.TAG;
        return {
          label: key,
          value: key,
          textValue: key,
          trailingItems: <TypeBadge kind={kind} />,
          showDetailsInOverlay: true,
          details: <AttributeDetails column={key} kind={kind} label={key} type="span" />,
        };
      }),
    ];
  }, [tags, groupBys]);

  return options;
}

const Disabled = styled('span')`
  color: ${p => p.theme.subText};
`;
