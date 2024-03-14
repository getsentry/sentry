import {useState} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import Input from 'sentry/components/input';
import {Tooltip} from 'sentry/components/tooltip';
import {IconCheckmark, IconEdit} from 'sentry/icons';
import {space} from 'sentry/styles/space';
import {WidgetDescription} from 'sentry/views/dashboards/widgetCard';

type Props = {
  displayValue: string;
  placeholder: string;
  value: string;
  description?: string;
  onSubmit?: (value: string) => void;
};

export function WidgetTitle({
  value,
  displayValue,
  placeholder,
  description,
  onSubmit,
}: Props) {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [title, setTitle] = useState<string>(value);

  return (
    <WidgetHeader>
      <WidgetTitleRow>
        {isEditingTitle ? (
          <Input
            value={title}
            placeholder={placeholder}
            onChange={e => {
              setTitle?.(e.target.value);
            }}
          />
        ) : (
          <h3>{displayValue}</h3>
        )}
        <Button
          aria-label="Edit Title"
          size="sm"
          borderless
          icon={isEditingTitle ? <IconCheckmark size="sm" /> : <IconEdit size="sm" />}
          priority={isEditingTitle ? 'primary' : 'default'}
          onClick={() => {
            if (isEditingTitle) {
              onSubmit?.(title);
            }
            setIsEditingTitle(curr => !curr);
          }}
        />
      </WidgetTitleRow>
      {description && (
        <Tooltip
          title={description}
          containerDisplayMode="grid"
          showOnlyOnOverflow
          isHoverable
          position="bottom"
        >
          <WidgetDescription>{description}</WidgetDescription>
        </Tooltip>
      )}
    </WidgetHeader>
  );
}

const WidgetHeader = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(1)};
`;

const WidgetTitleRow = styled('div')`
  display: flex;
  justify-content: flex-start;
  align-items: center;
  gap: ${space(1)};
`;
