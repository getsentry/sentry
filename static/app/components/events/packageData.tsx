import {useRef} from 'react';
import styled from '@emotion/styled';

import ClippedBox from 'sentry/components/clippedBox';
import ErrorBoundary from 'sentry/components/errorBoundary';
import {useIssueDetailsColumnCount} from 'sentry/components/events/eventTags/util';
import KeyValueList from 'sentry/components/events/interfaces/keyValueList';
import KeyValueData from 'sentry/components/keyValueData';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Event} from 'sentry/types/event';
import {isEmptyObject} from 'sentry/utils/object/isEmptyObject';
import {SectionKey} from 'sentry/views/issueDetails/streamline/context';
import {InterimSection} from 'sentry/views/issueDetails/streamline/interimSection';
import {useHasStreamlinedUI} from 'sentry/views/issueDetails/utils';

type Props = {
  event: Event;
};

export function EventPackageData({event}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const hasStreamlinedUI = useHasStreamlinedUI();
  const columnCount = useIssueDetailsColumnCount(containerRef) + 1;
  let longKeys: boolean, title: string;

  const packages = Object.entries(event.packages || {}).map(([key, value]) => ({
    key,
    value,
    subject: key,
    meta: event._meta?.packages?.[key]?.[''],
  }));

  switch (event.platform) {
    case 'csharp':
      longKeys = true;
      title = t('Assemblies');
      break;
    case 'java':
      longKeys = true;
      title = t('Dependencies');
      break;
    default:
      longKeys = false;
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
      {hasStreamlinedUI ? (
        <ColumnsContainer columnCount={columnCount}>{columns}</ColumnsContainer>
      ) : (
        <ClippedBox>
          <ErrorBoundary mini>
            <KeyValueList data={packages} longKeys={longKeys} />
          </ErrorBoundary>
        </ClippedBox>
      )}
    </InterimSection>
  );
}

export const ColumnsContainer = styled('div')<{columnCount: number}>`
  display: grid;
  align-items: start;
  grid-template-columns: repeat(${p => p.columnCount}, 1fr);
`;

export const Column = styled('div')`
  display: grid;
  grid-template-columns: fit-content(65%) 1fr;
  font-size: ${p => p.theme.fontSizeSmall};
  &:first-child {
    margin-left: -${space(1)};
  }
  &:not(:first-child) {
    border-left: 1px solid ${p => p.theme.innerBorder};
    padding-left: ${space(2)};
    margin-left: -1px;
  }
  &:not(:last-child) {
    border-right: 1px solid ${p => p.theme.innerBorder};
    padding-right: ${space(2)};
  }
`;
