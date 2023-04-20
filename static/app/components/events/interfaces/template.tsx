import {t} from 'sentry/locale';
import {EntryType, Event, Frame} from 'sentry/types';

import {EventDataSection} from '../../events/eventDataSection';

import DeprecatedLine from './frame/deprecatedLine';

type Props = {
  data: Frame;
  event: Event;
};

export function Template({data, event}: Props) {
  const entryIndex = event.entries.findIndex(entry => entry.type === EntryType.TEMPLATE);
  const meta = event._meta?.entries?.[entryIndex]?.data?.values;
  return (
    <EventDataSection type={EntryType.TEMPLATE} title={t('Template')}>
      <div className="traceback no-exception">
        <ul>
          <DeprecatedLine
            data={data}
            event={event}
            registers={{}}
            components={[]}
            frameMeta={meta}
            isExpanded
          />
        </ul>
      </div>
    </EventDataSection>
  );
}
