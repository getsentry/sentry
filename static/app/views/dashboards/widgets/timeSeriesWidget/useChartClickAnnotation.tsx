import {useCallback, useEffect, useMemo, useRef, useState, type ReactNode} from 'react';
import {createPortal} from 'react-dom';
import styled from '@emotion/styled';

import {Button} from '@sentry/scraps/button';

import type {ReactEchartsRef} from 'sentry/types/echarts';
import {getFormattedDate} from 'sentry/utils/dates';
import {useGlobalTimestampAnnotationsContext} from 'sentry/views/dashboards/contexts/globalTimestampAnnotationsContext';

interface PopupState {
  screenX: number;
  screenY: number;
  timestamp: number;
}

const DATA_ATTR = 'data-chart-annotation-menu';

interface UseChartClickAnnotationReturn {
  AnnotationMenu: ReactNode;
  connectAnnotationChartRef: (ref: ReactEchartsRef | null) => void;
}

export function useChartClickAnnotation(): UseChartClickAnnotationReturn {
  const {annotations, addAnnotation, clearAnnotations} =
    useGlobalTimestampAnnotationsContext();
  const [popup, setPopup] = useState<PopupState | null>(null);
  const [label, setLabel] = useState('');
  const echartsInstanceRef = useRef<ReturnType<
    ReactEchartsRef['getEchartsInstance']
  > | null>(null);

  const connectAnnotationChartRef = useCallback((ref: ReactEchartsRef | null) => {
    const prevInstance = echartsInstanceRef.current;
    if (prevInstance) {
      prevInstance.getZr()?.off('click');
    }

    if (!ref) {
      echartsInstanceRef.current = null;
      return;
    }

    const instance = ref.getEchartsInstance();
    echartsInstanceRef.current = instance;

    instance.getZr().on('click', (params: any) => {
      // Skip if the click was on a data point (has a dataIndex via target)
      if (params.target?.dataIndex !== undefined) {
        return;
      }

      const {offsetX, offsetY} = params;

      // Check the click is within the chart grid area
      if (!instance.containPixel('grid', [offsetX, offsetY])) {
        return;
      }

      // Convert pixel to data coordinates — index 0 is the timestamp
      const dataCoords = instance.convertFromPixel('grid', [offsetX, offsetY]);
      const timestamp = dataCoords?.[0];

      if (timestamp === undefined) {
        return;
      }

      // Get screen coordinates for positioning the popup
      const chartDom = instance.getDom();
      const rect = chartDom.getBoundingClientRect();

      setPopup({
        timestamp,
        screenX: rect.left + offsetX + window.scrollX,
        screenY: rect.top + offsetY + window.scrollY,
      });
      setLabel('');
    });
  }, []);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      echartsInstanceRef.current?.getZr()?.off('click');
    };
  }, []);

  // Outside click + escape key dismissal
  useEffect(() => {
    if (!popup) {
      return undefined;
    }

    function handleClick(event: MouseEvent) {
      let el = event.target as HTMLElement | null;
      while (el) {
        if (el.hasAttribute?.(DATA_ATTR)) {
          return;
        }
        el = el.parentElement;
      }
      setPopup(null);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setPopup(null);
      }
    }

    document.addEventListener('click', handleClick, true);
    document.addEventListener('keydown', handleKeyDown, true);

    return () => {
      document.removeEventListener('click', handleClick, true);
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [popup]);

  const handleAdd = useCallback(() => {
    if (!popup) {
      return;
    }
    addAnnotation({
      timestamp: popup.timestamp,
      label: label || undefined,
    });
    setPopup(null);
  }, [popup, label, addAnnotation]);

  const handleClearAll = useCallback(() => {
    clearAnnotations();
    setPopup(null);
  }, [clearAnnotations]);

  const AnnotationMenu = useMemo(() => {
    if (!popup) {
      return null;
    }

    const formattedTimestamp = getFormattedDate(popup.timestamp, 'MMM D, YYYY HH:mm:ss', {
      local: true,
    });

    return createPortal(
      <MenuContainer
        {...{[DATA_ATTR]: ''}}
        style={{
          top: popup.screenY,
          left: popup.screenX,
        }}
      >
        <Timestamp>{formattedTimestamp}</Timestamp>
        <LabelInput
          type="text"
          value={label}
          onChange={e => setLabel(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              handleAdd();
            }
          }}
          placeholder="Label (optional)"
          autoFocus
        />
        <Actions>
          <Button size="xs" priority="primary" onClick={handleAdd}>
            Add
          </Button>
          {annotations.length > 0 && (
            <Button size="xs" onClick={handleClearAll}>
              Clear All
            </Button>
          )}
        </Actions>
      </MenuContainer>,
      document.body
    );
  }, [popup, label, annotations.length, handleAdd, handleClearAll]);

  return {AnnotationMenu, connectAnnotationChartRef};
}

const MenuContainer = styled('div')`
  position: absolute;
  transform: translate(-50%, -100%) translateY(-8px);
  z-index: ${p => p.theme.zIndex.tooltip};
  background: ${p => p.theme.tokens.background.primary};
  border: 1px solid ${p => p.theme.tokens.border.primary};
  border-radius: ${p => p.theme.radius.md};
  box-shadow: ${p => p.theme.dropShadowHeavy};
  padding: ${p => p.theme.space.md} ${p => p.theme.space.lg};
  display: flex;
  flex-direction: column;
  gap: ${p => p.theme.space.md};
  white-space: nowrap;
`;

const Timestamp = styled('div')`
  font-size: ${p => p.theme.font.size.sm};
  color: ${p => p.theme.tokens.content.secondary};
`;

const LabelInput = styled('input')`
  padding: ${p => p.theme.space.xs} ${p => p.theme.space.md};
  border: 1px solid ${p => p.theme.tokens.border.primary};
  border-radius: ${p => p.theme.radius.sm};
  background: ${p => p.theme.tokens.background.primary};
  color: ${p => p.theme.tokens.content.primary};
  font-size: ${p => p.theme.font.size.sm};
  outline: none;

  &:focus {
    border-color: ${p => p.theme.tokens.focus.default};
  }
`;

const Actions = styled('div')`
  display: flex;
  gap: ${p => p.theme.space.xs};
`;
