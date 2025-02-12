import {useCallback, useMemo, useState} from 'react';
import styled from '@emotion/styled';
import {type AnimationProps, motion} from 'framer-motion';

import {Button} from 'sentry/components/button';
import Checkbox from 'sentry/components/checkbox';
import {Flex} from 'sentry/components/container/flex';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import {IconArrow} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {type Detector, DetectorListRow} from 'sentry/views/detectors/detectorListRow';

const animationProps: AnimationProps = {
  initial: {translateY: 8, opacity: 0},
  animate: {translateY: 0, opacity: 1},
  exit: {translateY: -8, opacity: 0},
  transition: {duration: 0.1},
};

type DetectorListTableProps = {
  detectors: Detector[];
};

function DetectorListTable({detectors}: DetectorListTableProps) {
  const [direction, setDirection] = useState<'asc' | 'desc'>('desc');
  const [selectedRows, setSelectedRows] = useState<string[]>([]);

  const detectorIds = useMemo(() => detectors.map(detector => detector.id), [detectors]);

  const handleSelect = useCallback(
    (id: string, checked: boolean): void => {
      if (checked) {
        setSelectedRows([...selectedRows, id]);
      } else {
        setSelectedRows(selectedRows.filter(item => item !== id));
      }
    },
    [selectedRows]
  );

  function selectAll(): void {
    if (selectedRows.length === 2) {
      setSelectedRows([]);
    } else {
      setSelectedRows(detectorIds);
    }
  }

  const bulkActionsVisible = useMemo(() => selectedRows.length > 0, [selectedRows]);
  // TODO: Implement canDelete logic
  const canDelete = true;

  return (
    <Panel>
      <StyledPanelHeader>
        <Flex>
          <StyledCheckbox
            checked={selectedRows.length === detectors.length}
            onChange={selectAll}
            visible
          />
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
        <Flex className="last-issue">
          <HeaderDivider />
          <Flex justify="space-between" flex={1}>
            <Heading>{t('Last Issue')}</Heading>
            <StyledIconArrow
              size="xs"
              direction={direction === 'desc' ? 'down' : 'up'}
              color="subText"
              onClick={() => setDirection(direction === 'desc' ? 'asc' : 'desc')}
            />
          </Flex>
        </Flex>
        <Flex className="open-issues">
          <HeaderDivider />
          <Heading>{t('Open Issues')}</Heading>
        </Flex>
        <Flex className="connected-automations">
          <HeaderDivider />
          <Heading>{t('Connected Automations')}</Heading>
        </Flex>
      </StyledPanelHeader>
      <PanelBody>
        {detectors.map(detector => (
          <DetectorListRow
            key={detector.id}
            automations={detector.automations}
            groups={detector.groups}
            id={detector.id}
            link={detector.link}
            name={detector.name}
            project={detector.project}
            details={detector.details}
            handleSelect={handleSelect}
            selected={selectedRows.includes(detector.id)}
            disabled={detector.disabled}
          />
        ))}
      </PanelBody>
    </Panel>
  );
}

const HeaderDivider = styled('div')`
  background-color: ${p => p.theme.gray200};
  width: 1px;
  border-radius: ${p => p.theme.borderRadius};
`;

const Heading = styled(motion.div)`
  display: flex;
  padding: 0 ${space(2)};
  color: ${p => p.theme.subText};
  align-items: center;
`;

const StyledCheckbox = styled(Checkbox)<{visible?: boolean}>`
  align-self: center;
  visibility: ${p => (p.visible ? 'visible' : 'hidden')};
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

const StyledIconArrow = styled(IconArrow)`
  margin-right: ${space(2)};
`;

const StyledPanelHeader = styled(PanelHeader)`
  justify-content: left;
  padding: ${space(0.75)} ${space(2)};
  min-height: 40px;
  align-items: center;
  display: grid;
  grid-template-columns: 3fr 1fr 0.75fr 1fr;

  @media (max-width: ${p => p.theme.breakpoints.large}) {
    grid-template-columns: 2.5fr 1fr 0.75fr;

    .connected-automations {
      display: none;
    }
  }

  @media (max-width: ${p => p.theme.breakpoints.medium}) {
    grid-template-columns: 3fr 1fr 0.6fr;

    .last-issue {
      display: none;
    }
  }

  @media (max-width: ${p => p.theme.breakpoints.small}) {
    grid-template-columns: 3fr 1fr;

    .open-issues {
      display: none;
    }
  }
`;

export default DetectorListTable;
