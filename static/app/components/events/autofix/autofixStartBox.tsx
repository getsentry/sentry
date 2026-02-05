import {useCallback, useMemo, useState} from 'react';
import styled from '@emotion/styled';

import starImage from 'sentry-images/spot/banner-star.svg';

import {Button, ButtonBar} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import {TextArea} from '@sentry/scraps/textarea';
import {Tooltip} from '@sentry/scraps/tooltip';

import {DropdownMenu} from 'sentry/components/dropdownMenu';
import {AutofixStoppingPoint} from 'sentry/components/events/autofix/types';
import {IconArrow, IconChevron, IconSeer} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';
import useOrganization from 'sentry/utils/useOrganization';

interface AutofixStartBoxProps {
  groupId: string;
  onSend: (message: string, stoppingPoint?: AutofixStoppingPoint) => void;
}

function getStoppingPointOptions(organization: Organization) {
  const enableSeerCoding = organization.enableSeerCoding !== false;
  return [
    {
      key: AutofixStoppingPoint.ROOT_CAUSE,
      label: t('Start Root Cause Analysis'),
      value: AutofixStoppingPoint.ROOT_CAUSE,
      disabled: false,
      tooltip: undefined,
    },
    {
      key: AutofixStoppingPoint.SOLUTION,
      label: t('Plan a Solution'),
      value: AutofixStoppingPoint.SOLUTION,
      disabled: false,
      tooltip: undefined,
    },
    {
      key: AutofixStoppingPoint.CODE_CHANGES,
      label: t('Write Code Changes'),
      value: AutofixStoppingPoint.CODE_CHANGES,
      disabled: !enableSeerCoding,
      tooltip: enableSeerCoding
        ? undefined
        : tct(
            '[settings:"Enable Code Generation"] must be enabled by an admin in settings.',
            {
              settings: (
                <Link to={`/settings/${organization.slug}/seer/#enableSeerCoding`} />
              ),
            }
          ),
    },
    {
      key: AutofixStoppingPoint.OPEN_PR,
      label: t('Draft a Pull Request'),
      value: AutofixStoppingPoint.OPEN_PR,
      disabled: !enableSeerCoding,
      tooltip: enableSeerCoding
        ? undefined
        : tct(
            '[settings:"Enable Code Generation"] must be enabled by an admin in settings.',
            {
              settings: (
                <Link to={`/settings/${organization.slug}/seer/#enableSeerCoding`} />
              ),
            }
          ),
    },
  ] as const;
}

export function AutofixStartBox({onSend, groupId}: AutofixStartBoxProps) {
  const organization = useOrganization();
  organization.enableSeerCoding = false;
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
    const options = getStoppingPointOptions(organization);
    const primary =
      options.find(opt => opt.value === selectedStoppingPoint) ?? options[0];
    const dropdown = options
      .filter(opt => opt.value !== selectedStoppingPoint)
      .map(opt => ({
        key: opt.key,
        label: opt.label,
        disabled: opt.disabled ?? false,
        tooltip: opt.tooltip,
        onAction: () =>
          handleSubmit({preventDefault: () => {}} as React.FormEvent, opt.value),
      }));
    return {primaryOption: primary, dropdownOptions: dropdown};
  }, [organization, selectedStoppingPoint, handleSubmit]);

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
            <Flex justify="center" align="center" gap="md" width="100%">
              <IconSeer animation="waiting" variant="primary" size="xl" />
            </Flex>
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
              <Tooltip
                title={primaryOption.tooltip}
                skipWrapper
                disabled={!primaryOption.disabled}
              >
                <StyledButton
                  type="submit"
                  priority="primary"
                  disabled={primaryOption.disabled}
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
              </Tooltip>
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
  border: 1px solid ${p => p.theme.tokens.border.primary};
`;

const AutofixStartText = styled('div')`
  margin: 0;
  padding: ${space(1)};
  white-space: pre-wrap;
  word-break: break-word;
  font-size: ${p => p.theme.font.size.lg};
  position: relative;
  overflow: hidden;
`;

const BackgroundStar = styled('img')`
  position: absolute;
  filter: sepia(1) saturate(3) hue-rotate(290deg);
  opacity: 0.7;
  pointer-events: none;
  z-index: 0;
`;

const StyledArrow = styled(IconArrow)`
  color: ${p => p.theme.tokens.content.secondary};
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

  border-color: ${p => p.theme.tokens.border.secondary};
  &:hover {
    border-color: ${p => p.theme.tokens.border.primary};
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
