import {
  KeyValueColumns,
  KeyValueTableDataRow,
} from 'sentry/components/tables/keyValueTable';
import {t} from 'sentry/locale';
import type {Event} from 'sentry/types/event';
import {splitIntoColumns} from 'sentry/utils/array/splitIntoColumns';
import {isEmptyObject} from 'sentry/utils/object/isEmptyObject';
import {SectionKey} from 'sentry/views/issueDetails/context';
import {FoldSection} from 'sentry/views/issueDetails/foldSection';

type Props = {
  event: Event;
};

export function EventPackageData({event}: Props) {
  let title: string;

  const packages = Object.entries(event.packages || {}).map(([key, value]) => ({
    key,
    value,
    subject: key,
    meta: event._meta?.packages?.[key]?.[''],
  }));

  switch (event.platform) {
    case 'csharp':
      title = t('Assemblies');
      break;
    case 'java':
      title = t('Dependencies');
      break;
    default:
      title = t('Packages');
  }

  if (isEmptyObject(event.packages)) {
    return null;
  }

  const componentItems = packages.map((item, i) => (
    <KeyValueTableDataRow
      key={`content-card-${item.key}-${i}`}
      item={item}
      meta={item.meta}
    />
  ));

  return (
    <FoldSection sectionKey={SectionKey.PACKAGES} title={title} initialCollapse>
      <KeyValueColumns>
        {columnCount => splitIntoColumns(componentItems, columnCount)}
      </KeyValueColumns>
    </FoldSection>
  );
}
