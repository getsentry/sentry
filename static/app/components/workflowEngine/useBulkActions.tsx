import {useCallback, useMemo, useState} from 'react';
import styled from '@emotion/styled';
import {type AnimationProps, motion} from 'framer-motion';

import {Button} from 'sentry/components/button';
import Checkbox from 'sentry/components/checkbox';
import {Flex} from 'sentry/components/container/flex';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Detector} from 'sentry/views/detectors/components/detectorListRow';

// TODO: Adjust to work for automations once type is available
export function useBulkActions(detectors: Detector[]) {
  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const detectorIds = useMemo(() => detectors.map(detector => detector.id), [detectors]);

  const handleSelect = useCallback((id: string, checked: boolean): void => {
    if (checked) {
      setSelectedRows(prev => [...prev, id]);
    } else {
      setSelectedRows(prev => prev.filter(item => item !== id));
    }
  }, []);

  const toggleSelectAll = useCallback((): void => {
    if (selectedRows.length === detectors.length) {
      setSelectedRows([]);
    } else {
      setSelectedRows(detectorIds);
    }
  }, [selectedRows, detectors, detectorIds]);

  const bulkActionsVisible = useMemo(() => selectedRows.length > 0, [selectedRows]);
  const isSelectAllChecked = useMemo(
    () => selectedRows.length === detectors.length,
    [selectedRows, detectors]
  );

  return {
    selectedRows,
    handleSelect,
    isSelectAllChecked,
    toggleSelectAll,
    bulkActionsVisible,
    // TODO: Implement canDelete logic
    canDelete: true,
  };
}

const animationProps: AnimationProps = {
  initial: {translateY: 8, opacity: 0},
  animate: {translateY: 0, opacity: 1},
  exit: {translateY: -8, opacity: 0},
  transition: {duration: 0.1},
};

type BulkActionsProps = {
  bulkActionsVisible: boolean;
  canDelete: boolean;
  isSelectAllChecked: boolean;
  toggleSelectAll: () => void;
};

export function BulkActions({
  bulkActionsVisible,
  canDelete,
  isSelectAllChecked,
  toggleSelectAll,
}: BulkActionsProps) {
  return (
    <Flex>
      <StyledCheckbox checked={isSelectAllChecked} onChange={toggleSelectAll} visible />
      <Flex justify={'space-between'} flex={1}>
        {bulkActionsVisible ? (
          <ActionsWrapper {...animationProps}>
            <Button size="xs">{t('Disable')}</Button>
            {canDelete ? (
              <Button size="xs" priority="danger">
                {t('Delete')}
              </Button>
            ) : (
              <Subtext>{t("Occurrence-based monitors can't be deleted")}</Subtext>
            )}
          </ActionsWrapper>
        ) : (
          <Heading {...animationProps}>{t('Name')}</Heading>
        )}
      </Flex>
    </Flex>
  );
}

const StyledCheckbox = styled(Checkbox)<{visible?: boolean}>`
  align-self: center;
  visibility: ${p => (p.visible ? 'visible' : 'hidden')};
`;

const Heading = styled(motion.div)`
  display: flex;
  padding: 0 ${space(2)};
  color: ${p => p.theme.subText};
  align-items: center;
`;

const Subtext = styled('p')`
  color: ${p => p.theme.gray300};
  margin: 0;
  align-self: center;
  text-transform: none;
  font-weight: normal;
`;

const ActionsWrapper = styled(motion.div)`
  display: flex;
  flex-direction: row;
  padding: 0 ${space(2)};
  gap: ${space(1)};
`;
