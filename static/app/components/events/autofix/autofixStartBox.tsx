import {useCallback, useMemo, useState} from 'react';
import styled from '@emotion/styled';

import starImage from 'sentry-images/spot/banner-star.svg';

import {Button} from 'sentry/components/core/button';
import {ButtonBar} from 'sentry/components/core/button/buttonBar';
import {TextArea} from 'sentry/components/core/textarea';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import {AutofixStoppingPoint} from 'sentry/components/events/autofix/types';
import {IconArrow, IconChevron, IconSeer} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';

interface AutofixStartBoxProps {
  groupId: string;
  onSend: (message: string, stoppingPoint?: AutofixStoppingPoint) => void;
}

const STOPPING_POINT_OPTIONS = [
  {
    key: AutofixStoppingPoint.ROOT_CAUSE,
    label: t('Start Root Cause Analysis'),
    value: AutofixStoppingPoint.ROOT_CAUSE,
  },
  {
    key: AutofixStoppingPoint.SOLUTION,
    label: t('Plan a Solution'),
    value: AutofixStoppingPoint.SOLUTION,
  },
  {
    key: AutofixStoppingPoint.CODE_CHANGES,
    label: t('Write Code Changes'),
    value: AutofixStoppingPoint.CODE_CHANGES,
  },
  {
    key: AutofixStoppingPoint.OPEN_PR,
    label: t('Draft a Pull Request'),
    value: AutofixStoppingPoint.OPEN_PR,
  },
] as const;

export function AutofixStartBox({onSend, groupId}: AutofixStartBoxProps) {
  const [message, setMessage] = useState('');
  const [selectedStoppingPoint, setSelectedStoppingPoint] =
    useLocalStorageState<AutofixStoppingPoint>(
      'autofix:selected-stopping-point',
      AutofixStoppingPoint.ROOT_CAUSE
    );

  const handleSubmit = useCallback(
    (e: React.FormEvent, stoppingPoint?: AutofixStoppingPoint) => {
      e.preventDefault();
      const finalStoppingPoint = stoppingPoint ?? selectedStoppingPoint;
      setSelectedStoppingPoint(finalStoppingPoint);
      onSend(message, finalStoppingPoint);
    },
    [message, selectedStoppingPoint, onSend, setSelectedStoppingPoint]
  );

  const {primaryOption, dropdownOptions} = useMemo(() => {
    const primary =
      STOPPING_POINT_OPTIONS.find(opt => opt.value === selectedStoppingPoint) ??
      STOPPING_POINT_OPTIONS[0];
    const dropdown = STOPPING_POINT_OPTIONS.filter(
      opt => opt.value !== selectedStoppingPoint
    ).map(opt => ({
      key: opt.key,
      label: opt.label,
      onAction: () =>
        handleSubmit({preventDefault: () => {}} as React.FormEvent, opt.value),
    }));
    return {primaryOption: primary, dropdownOptions: dropdown};
  }, [selectedStoppingPoint, handleSubmit]);

  return (
    <Wrapper>
      <ScaleContainer>
        <StyledArrow direction="down" size="sm" />
        <Container>
          <AutofixStartText>
            <BackgroundStar
              src={starImage}
              style={{
                width: '20px',
                height: '20px',
                right: '5%',
                top: '20%',
                transform: 'rotate(15deg)',
              }}
            />
            <BackgroundStar
              src={starImage}
              style={{
                width: '16px',
                height: '16px',
                right: '35%',
                top: '40%',
                transform: 'rotate(45deg)',
              }}
            />
            <BackgroundStar
              src={starImage}
              style={{
                width: '14px',
                height: '14px',
                right: '25%',
                top: '60%',
                transform: 'rotate(30deg)',
              }}
            />
            <StartTextRow>
              <IconSeer animation="waiting" variant="primary" size="xl" />
            </StartTextRow>
          </AutofixStartText>
          <InputWrapper onSubmit={handleSubmit}>
            <StyledInput
              autosize
              value={message}
              onChange={e => setMessage(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
              placeholder="Share helpful context here..."
              maxLength={4096}
              maxRows={10}
              size="sm"
            />
            <ButtonBar merged gap="0">
              <StyledButton
                type="submit"
                priority="primary"
                analyticsEventKey={
                  message
                    ? 'autofix.give_instructions_clicked'
                    : 'autofix.start_fix_clicked'
                }
                analyticsEventName={
                  message
                    ? 'Autofix: Give Instructions Clicked'
                    : 'Autofix: Start Fix Clicked'
                }
                analyticsParams={{group_id: groupId}}
              >
                {primaryOption.label}
              </StyledButton>
              <DropdownMenu
                items={dropdownOptions}
                trigger={(triggerProps, isOpen) => (
                  <DropdownTrigger
                    {...triggerProps}
                    priority="primary"
                    aria-label={t('Choose stopping point')}
                    icon={<IconChevron direction={isOpen ? 'up' : 'down'} size="xs" />}
                  />
                )}
              />
            </ButtonBar>
          </InputWrapper>
        </Container>
      </ScaleContainer>
    </Wrapper>
  );
}

const Wrapper = styled('div')`
  display: flex;
  flex-direction: column;
  align-items: center;
  margin: ${space(1)} ${space(4)};
  gap: ${space(1)};
`;

const ScaleContainer = styled('div')`
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${space(1)};
  margin-bottom: 100px;
`;

const Container = styled('div')`
  position: relative;
  width: 100%;
  border-radius: ${p => p.theme.radius.md};
  background: ${p => p.theme.tokens.background.primary}
    linear-gradient(
      135deg,
      ${p => p.theme.colors.pink500}08,
      ${p => p.theme.colors.pink500}20
    );
  overflow: visible;
  padding: ${space(0.5)};
  border: 1px solid ${p => p.theme.border};
`;

const AutofixStartText = styled('div')`
  margin: 0;
  padding: ${space(1)};
  white-space: pre-wrap;
  word-break: break-word;
  font-size: ${p => p.theme.fontSize.lg};
  position: relative;
  overflow: hidden;
`;

const StartTextRow = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(1)};
  width: 100%;
  justify-content: center;
`;

const BackgroundStar = styled('img')`
  position: absolute;
  filter: sepia(1) saturate(3) hue-rotate(290deg);
  opacity: 0.7;
  pointer-events: none;
  z-index: 0;
`;

const StyledArrow = styled(IconArrow)`
  color: ${p => p.theme.subText};
  opacity: 0.5;
`;

const InputWrapper = styled('form')`
  display: flex;
  gap: ${p => p.theme.space.lg};
  padding: ${p => p.theme.space.sm} ${p => p.theme.space.lg};
`;

const StyledInput = styled(TextArea)`
  resize: none;
  background: ${p => p.theme.tokens.background.primary};

  border-color: ${p => p.theme.innerBorder};
  &:hover {
    border-color: ${p => p.theme.border};
  }
`;

const StyledButton = styled(Button)`
  flex-shrink: 0;
`;

const DropdownTrigger = styled(Button)`
  box-shadow: none;
  border-radius: 0 ${p => p.theme.radius.md} ${p => p.theme.radius.md} 0;
  border-left: none;
`;
