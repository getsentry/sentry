import type {ReactNode} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button';
import StructuredEventData from 'sentry/components/structuredEventData';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Extraction} from 'sentry/utils/replays/extractDomNodes';
import type {ReplayFrame} from 'sentry/utils/replays/types';
import {isCLSFrame, isWebVitalFrame} from 'sentry/utils/replays/types';
import type {OnExpandCallback} from 'sentry/views/replays/detail/useVirtualizedInspector';

type MouseCallback = (frame: ReplayFrame, nodeId?: number) => void;

interface Props {
  frame: ReplayFrame;
  onInspectorExpanded: OnExpandCallback;
  onMouseEnter: MouseCallback;
  onMouseLeave: MouseCallback;
  expandPaths?: string[];
  extraction?: Extraction;
}

export function BreadcrumbWebVital({
  frame,
  extraction,
  expandPaths,
  onInspectorExpanded,
  onMouseEnter,
  onMouseLeave,
}: Props) {
  if (!isWebVitalFrame(frame)) {
    return null;
  }

  const webVitalData = {value: frame.data.value};
  const selectors = extraction?.selectors;

  if (isCLSFrame(frame) && frame.data.attributions && selectors) {
    const layoutShifts: Array<Record<string, ReactNode[]>> = [];
    for (const attr of frame.data.attributions) {
      const elements: ReactNode[] = [];
      if ('nodeIds' in attr && Array.isArray(attr.nodeIds)) {
        attr.nodeIds.forEach(nodeId => {
          if (selectors.get(nodeId)) {
            elements.push(
              <span
                key={nodeId}
                onMouseEnter={() => onMouseEnter(frame, nodeId)}
                onMouseLeave={() => onMouseLeave(frame, nodeId)}
              >
                <ValueObjectKey>{t('element')}</ValueObjectKey>
                <span>{': '}</span>
                <span>
                  <SelectorButton>{selectors.get(nodeId)}</SelectorButton>
                </span>
              </span>
            );
          }
        });
      }
      // if we can't find the elements associated with the layout shift, we still show the score with element: unknown
      if (!elements.length) {
        elements.push(
          <span>
            <ValueObjectKey>{t('element')}</ValueObjectKey>
            <span>{': '}</span>
            <ValueNull>{t('unknown')}</ValueNull>
          </span>
        );
      }
      layoutShifts.push({[`score ${attr.value}`]: elements});
    }
    if (layoutShifts.length) {
      // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
      webVitalData['Layout shifts'] = layoutShifts;
    }
  } else if (selectors) {
    selectors.forEach((key, value) => {
      // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
      webVitalData[key] = (
        <span
          key={key}
          onMouseEnter={() => onMouseEnter(frame, value)}
          onMouseLeave={() => onMouseLeave(frame, value)}
        >
          <ValueObjectKey>{t('element')}</ValueObjectKey>
          <span>{': '}</span>
          <SelectorButton size="zero" borderless>
            {key}
          </SelectorButton>
        </span>
      );
    });
  }

  return (
    <StructuredEventData
      initialExpandedPaths={expandPaths ?? []}
      onToggleExpand={(expandedPaths, path) => {
        onInspectorExpanded(
          path,
          Object.fromEntries(expandedPaths.map(item => [item, true]))
        );
      }}
      data={webVitalData}
      withAnnotatedText
    />
  );
}

const ValueObjectKey = styled('span')`
  color: var(--prism-keyword);
`;

const ValueNull = styled('span')`
  font-weight: ${p => p.theme.fontWeight.bold};
  color: var(--prism-property);
`;

const SelectorButton = styled(Button)`
  background: none;
  border: none;
  padding: 0 2px;
  border-radius: 2px;
  font-weight: ${p => p.theme.fontWeight.normal};
  box-shadow: none;
  font-size: ${p => p.theme.fontSize.sm};
  color: ${p => p.theme.subText};
  margin: 0 ${space(0.5)};
  height: auto;
  min-height: auto;
`;
