import type React from 'react';
import {useEffect, useRef} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button';
import {Flex} from 'sentry/components/core/layout';
import {Tooltip} from 'sentry/components/core/tooltip';
import {IconEdit} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {PercentInput} from 'sentry/views/settings/dynamicSampling/percentInput';
import {useHasDynamicSamplingWriteAccess} from 'sentry/views/settings/dynamicSampling/utils/access';

interface Props {
  help: React.ReactNode;
  label: React.ReactNode;
  onChange: (value: string) => void;
  previousValue: string;
  showPreviousValue: boolean;
  value: string;
  error?: string;
  isBulkEditActive?: boolean;
  isBulkEditEnabled?: boolean;
  onBulkEditChange?: (value: boolean) => void;
}

export function OrganizationSampleRateInput({
  value,
  onChange,
  isBulkEditEnabled,
  isBulkEditActive,
  label,
  help,
  error,
  previousValue,
  showPreviousValue,
  onBulkEditChange,
}: Props) {
  const hasAccess = useHasDynamicSamplingWriteAccess();
  const inputRef = useRef<HTMLInputElement>(null);

  // Autofocus the input when bulk edit is activated
  useEffect(() => {
    if (isBulkEditActive) {
      inputRef.current?.focus();
    }
  }, [isBulkEditActive]);

  const showBulkEditButton = hasAccess && isBulkEditEnabled && !isBulkEditActive;
  return (
    <SampleRateRow>
      <Description>
        <Label>{label}</Label>
        <HelpText>{help}</HelpText>
      </Description>
      <InputWrapper>
        <Flex gap="md">
          {showBulkEditButton && (
            <Button
              title={t('Proportionally scale project rates')}
              aria-label={t('Proportionally scale project rates')}
              borderless
              size="sm"
              onClick={() => onBulkEditChange?.(true)}
              icon={<IconEdit />}
            />
          )}
          <Tooltip
            disabled={hasAccess}
            title={t('You do not have permission to change the sample rate.')}
          >
            <PercentInput
              type="number"
              disabled={!hasAccess || (isBulkEditEnabled && !isBulkEditActive)}
              value={value}
              size="sm"
              ref={inputRef}
              onKeyDown={event => {
                if (event.key === 'Enter' && isBulkEditActive) {
                  event.preventDefault();
                  inputRef.current?.blur();
                }
              }}
              onBlur={() => onBulkEditChange?.(false)}
              onChange={event => onChange(event.target.value)}
            />
          </Tooltip>
        </Flex>
        {error ? (
          <ErrorMessage>{error}</ErrorMessage>
        ) : showPreviousValue ? (
          <PreviousValue>{t('previous: %f%%', previousValue)}</PreviousValue>
        ) : value === '100' ? (
          <AllDataStoredMessage>{t('All spans are stored')}</AllDataStoredMessage>
        ) : null}
      </InputWrapper>
    </SampleRateRow>
  );
}

const SampleRateRow = styled('div')`
  display: flex;
  padding: ${space(1.5)} ${space(2)} ${space(1)};
  border-bottom: 1px solid ${p => p.theme.tokens.border.secondary};
  gap: ${space(4)};
`;

const Description = styled('div')`
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: ${space(0.5)};
  padding-bottom: ${space(0.5)};
`;

const Label = styled('label')`
  margin-bottom: 0;
`;

const HelpText = styled('div')`
  font-size: ${p => p.theme.fontSize.sm};
  color: ${p => p.theme.tokens.content.secondary};
`;

const PreviousValue = styled('span')`
  font-size: ${p => p.theme.fontSize.xs};
  color: ${p => p.theme.tokens.content.secondary};
`;

const ErrorMessage = styled('span')`
  font-size: ${p => p.theme.fontSize.xs};
  color: ${p => p.theme.tokens.content.danger};
`;

const AllDataStoredMessage = styled('span')`
  font-size: ${p => p.theme.fontSize.xs};
  color: ${p => p.theme.tokens.content.success};
`;

const InputWrapper = styled('div')`
  height: 50px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex-shrink: 0;
  align-items: flex-end;
`;
