import {t} from 'sentry/locale';
import type {Event, Frame} from 'sentry/types';
import {EntryType} from 'sentry/types/event';

import DeprecatedLine from './frame/deprecatedLine';
import {InterimSection} from 'sentry/views/issueDetails/streamline/interimSection';
import {FoldSectionKey} from 'sentry/views/issueDetails/streamline/foldSection';

type Props = {
  data: Frame;
  event: Event;
};

export function Template({data, event}: Props) {
  const entryIndex = event.entries.findIndex(entry => entry.type === EntryType.TEMPLATE);
  const meta = event._meta?.entries?.[entryIndex]?.data?.values;
  return (
    <InterimSection
      type={EntryType.TEMPLATE}
      title={t('Template')}
      sectionKey={FoldSectionKey.TEMPLATE}
    >
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
