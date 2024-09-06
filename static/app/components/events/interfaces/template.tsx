import {t} from 'sentry/locale';
import type {Event, Frame} from 'sentry/types/event';
import {EntryType} from 'sentry/types/event';
import {SectionKey} from 'sentry/views/issueDetails/streamline/context';
import {InterimSection} from 'sentry/views/issueDetails/streamline/interimSection';

import DeprecatedLine from './frame/deprecatedLine';

type Props = {
  data: Frame;
  event: Event;
};

export function Template({data, event}: Props) {
  const entryIndex = event.entries.findIndex(entry => entry.type === EntryType.TEMPLATE);
  const meta = event._meta?.entries?.[entryIndex]?.data?.values;
  return (
    <InterimSection title={t('Template')} type={SectionKey.TEMPLATE}>
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
    </InterimSection>
  );
}
