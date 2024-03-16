import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import Input from 'sentry/components/input';
import {Tooltip} from 'sentry/components/tooltip';
import {IconCheckmark, IconEdit} from 'sentry/icons';
import {space} from 'sentry/styles/space';
import {WidgetDescription} from 'sentry/views/dashboards/widgetCard';

export interface TitleState {
  edited: string;
  isEditing: boolean;
  stored: string;
}
interface Props {
  onTitleChange: (val: Partial<TitleState>) => void;
  title: TitleState;
  description?: string;
  placeholder?: string;
}

export function WidgetTitle({title, onTitleChange, placeholder, description}: Props) {
  const titleToDisplay =
    title.edited === ''
      ? title.stored === ''
        ? placeholder
        : title.stored
      : title.edited;

  return (
    <WidgetHeader>
      <WidgetTitleRow>
        {title.isEditing ? (
          <Input
            value={title.edited}
            placeholder={placeholder}
            onChange={e => {
              onTitleChange({edited: e.target.value});
            }}
          />
        ) : (
          <h3>{titleToDisplay}</h3>
        )}
        <Button
          aria-label="Edit Title"
          size="sm"
          borderless
          icon={title.isEditing ? <IconCheckmark size="sm" /> : <IconEdit size="sm" />}
          priority={title.isEditing ? 'primary' : 'default'}
          onClick={() => {
            if (title.isEditing) {
              onTitleChange({isEditing: false});
            } else {
              onTitleChange({isEditing: true});
            }
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
