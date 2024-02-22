import {Fragment, useEffect, useState} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import DateTime from 'sentry/components/dateTime';
import type {AutofixData, AutofixStep} from 'sentry/components/events/aiAutofix/types';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Panel from 'sentry/components/panels/panel';
import {IconChevron, IconClose, IconFatal} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {defined} from 'sentry/utils';

interface StepIconProps {
  status: AutofixStep['status'];
}

function StepIcon({status}: StepIconProps) {
  switch (status) {
    case 'PROCESSING':
      return <ProcessingStatusIndicator size={14} mini hideMessage />;
    case 'CANCELLED':
      return <IconClose size="sm" isCircled color="gray300" />;
    case 'ERROR':
      return <IconFatal size="sm" color="red300" />;
    case 'COMPLETED':
    default:
      return null;
  }
}

interface StepProps {
  step: AutofixStep;
  isChild?: boolean;
  stepNumber?: number;
}

interface AutofixStepsProps {
  data: AutofixData;
}

type LogData = {
  message: string;
  timestamp: Date;
};

const FAKE_LOGS = {
  1: [
    'Investigating src/sentry/file.py...',
    'It looks like the flask endpoint is not correctly handling json data when the parameter has_transaction is set to None...',
  ],
  2: ['Second step log 1', 'Second step log 2'],
  3: ['Third step log 1', 'Third step log 2'],
};

function useFakeLogs({stepNumber, isActive}: {isActive: boolean; stepNumber?: number}) {
  const [logs, setLogs] = useState<LogData[]>([]);

  useEffect(() => {
    if (
      !isActive ||
      !defined(stepNumber) ||
      logs.length >= FAKE_LOGS[stepNumber].length
    ) {
      return () => {};
    }

    const timer = setTimeout(
      () => {
        setLogs(prevLogs => [
          ...prevLogs,
          {
            timestamp: new Date(),
            message: FAKE_LOGS[stepNumber][prevLogs.length],
          } as LogData,
        ]);
      },
      Math.random() * 2000 + 3000
    );

    return () => {
      clearInterval(timer);
    };
  }, [isActive, logs.length, stepNumber]);

  return logs;
}

export function Step({step, isChild, stepNumber}: StepProps) {
  const isActive = step.status !== 'PENDING' && step.status !== 'CANCELLED';
  const [isExpanded, setIsExpanded] = useState(false);

  const logs = useFakeLogs({stepNumber, isActive});

  const activeLog = step.description ?? logs[logs.length - 1]?.message ?? null;

  return (
    <StepCard active={isActive}>
      <StepHeader
        isActive={isActive}
        isChild={isChild}
        onClick={() => {
          if (isActive && activeLog) {
            setIsExpanded(value => !value);
          }
        }}
      >
        <StepTitle>
          {stepNumber ? `${stepNumber}. ` : null}
          {step.title}
        </StepTitle>
        {activeLog && !isExpanded && (
          <StepHeaderDescription>{activeLog}</StepHeaderDescription>
        )}
        <StepHeaderRight>
          <StepIcon status={step.status} />
          {isActive && (
            <Button
              icon={<IconChevron size="xs" direction={isExpanded ? 'down' : 'right'} />}
              aria-label={t('Toggle step details')}
              aria-expanded={isExpanded}
              size="zero"
              borderless
              disabled={!activeLog}
            />
          )}
        </StepHeaderRight>
      </StepHeader>
      {isExpanded && (
        <Fragment>
          {step.description && <StepBody>{step.description}</StepBody>}
          {logs.length > 0 && (
            <StepLogs>
              {logs.map((log, index) => (
                <Fragment key={index}>
                  <DateTime date={log.timestamp} format="HH:mm:ss:SSS" />
                  <div>{log.message}</div>
                </Fragment>
              ))}
            </StepLogs>
          )}
          {step.children && step.children.length > 0 && (
            <StepChildrenArea>
              {step.children.map(child => (
                <Step step={child} key={child.id} isChild />
              ))}
            </StepChildrenArea>
          )}
        </Fragment>
      )}
    </StepCard>
  );
}

export function AutofixSteps({data}: AutofixStepsProps) {
  return (
    <div>
      {data.steps?.map((step, index) => (
        <Step step={step} key={step.id} stepNumber={index + 1} />
      ))}
    </div>
  );
}

const StepCard = styled(Panel)<{active?: boolean}>`
  opacity: ${p => (p.active ? 1 : 0.6)};
  overflow: hidden;

  :last-child {
    margin-bottom: 0;
  }
`;

const StepChildrenArea = styled('div')`
  padding: ${space(2)};
  background-color: ${p => p.theme.backgroundSecondary};
  border-top: 1px solid ${p => p.theme.border};
`;

const StepHeader = styled('div')<{isActive: boolean; isChild?: boolean}>`
  display: grid;
  justify-content: space-between;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  padding: ${space(2)};
  cursor: ${p => (p.isActive ? 'pointer' : 'default')};

  &:last-child {
    padding-bottom: ${space(2)};
  }
`;

const StepHeaderDescription = styled('div')`
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.subText};
  padding: 0 ${space(2)} 0 ${space(1)};
  margin-left: ${space(1)};
  border-left: 1px solid ${p => p.theme.border};
  ${p => p.theme.overflowEllipsis};
`;

const StepHeaderRight = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(1)};
  grid-column: -1;
`;

const StepTitle = styled('div')`
  font-weight: bold;

  span {
    margin-right: ${space(1)};
  }
`;

const StepBody = styled('p')`
  padding: 0 ${space(2)} ${space(2)} ${space(2)};
  margin: -${space(1)} 0 0 0;
`;

const ProcessingStatusIndicator = styled(LoadingIndicator)`
  && {
    margin: 0;
    height: 14px;
    width: 14px;
  }
`;

const StepLogs = styled('div')`
  background: ${p => p.theme.backgroundSecondary};
  padding: ${space(2)};
  list-style: none;
  display: grid;
  gap: ${space(1)} ${space(2)};
  grid-template-columns: auto 1fr;
  font-size: ${p => p.theme.fontSizeSmall};
  font-family: ${p => p.theme.text.familyMono};
`;
