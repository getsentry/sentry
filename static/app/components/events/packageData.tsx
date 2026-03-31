import {useRef} from 'react';
import styled from '@emotion/styled';

import {useIssueDetailsColumnCount} from 'sentry/components/events/eventTags/util';
import {KeyValueData} from 'sentry/components/keyValueData';
import {t} from 'sentry/locale';
import type {Event} from 'sentry/types/event';
import {isEmptyObject} from 'sentry/utils/object/isEmptyObject';
import {SectionKey} from 'sentry/views/issueDetails/streamline/context';
import {InterimSection} from 'sentry/views/issueDetails/streamline/interimSection';

type Props = {
  event: Event;
};

export function EventPackageData({event}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const columnCount = useIssueDetailsColumnCount(containerRef) + 1;
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
    <KeyValueData.Content
      key={`content-card-${item.key}-${i}`}
      item={item}
      meta={item.meta}
    />
  ));

  const columns: React.ReactNode[] = [];
  const columnSize = Math.ceil(componentItems.length / columnCount);
  for (let i = 0; i < componentItems.length; i += columnSize) {
    columns.push(
      <Column key={`highlight-column-${i}`}>
        {componentItems.slice(i, i + columnSize)}
      </Column>
    );
  }

  return (
    <InterimSection
      title={title}
      type={SectionKey.PACKAGES}
      ref={containerRef}
      initialCollapse
    >
      <ColumnsContainer columnCount={columnCount}>{columns}</ColumnsContainer>
    </InterimSection>
  );
}

const ColumnsContainer = styled('div')<{columnCount: number}>`
  display: grid;
  align-items: start;
  grid-template-columns: repeat(${p => p.columnCount}, 1fr);
`;

const Column = styled('div')`
  display: grid;
  grid-template-columns: fit-content(65%) 1fr;
  font-size: ${p => p.theme.font.size.sm};
  &:first-child {
    margin-left: -${p => p.theme.space.md};
  }
  &:not(:first-child) {
    border-left: 1px solid ${p => p.theme.tokens.border.secondary};
    padding-left: ${p => p.theme.space.xl};
    margin-left: -1px;
  }
  &:not(:last-child) {
    border-right: 1px solid ${p => p.theme.tokens.border.secondary};
    padding-right: ${p => p.theme.space.xl};
  }
`;
