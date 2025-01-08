import type {Theme} from '@emotion/react';
import {css, useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {Button, type ButtonProps} from 'sentry/components/button';
import {ComboBox as _ComboBox} from 'sentry/components/comboBox';
import {
  CompactSelect as _CompactSelect,
  type MultipleSelectProps,
  type SelectKey,
  type SingleSelectProps,
} from 'sentry/components/compactSelect';
import _SmartSearchBar from 'sentry/components/deprecatedSmartSearchBar';
import {DebouncedInput as _DebouncedInput} from 'sentry/components/modals/metricWidgetViewerModal/queries';
import {SearchQueryBuilder as _SearchQueryBuilder} from 'sentry/components/searchQueryBuilder';
import {Tooltip} from 'sentry/components/tooltip';
import {SLOW_TOOLTIP_DELAY} from 'sentry/constants';
import {IconDelete} from 'sentry/icons';
import {space} from 'sentry/styles/space';

export function QueryFieldGroup({children}: React.HTMLAttributes<HTMLDivElement>) {
  return <FieldGroup>{children}</FieldGroup>;
}

type CompactSelectProps<Value extends SelectKey> = (
  | Omit<SingleSelectProps<Value>, 'triggerProps'>
  | Omit<MultipleSelectProps<Value>, 'triggerProps'>
) & {
  triggerProps?: Pick<ButtonProps, 'icon'>;
};

// A series of TS function overloads to properly parse prop types across 2 dimensions:
// option value types (number vs string), and selection mode (singular vs multiple)
function CompactSelect<Value extends number>(
  props: CompactSelectProps<Value>
): JSX.Element;
function CompactSelect<Value extends string>(
  props: CompactSelectProps<Value>
): JSX.Element;
function CompactSelect<Value extends SelectKey>(
  props: CompactSelectProps<Value>
): JSX.Element;

function CompactSelect<Value extends SelectKey>({
  triggerProps,
  className,
  ...props
}: CompactSelectProps<Value>) {
  const theme = useTheme();
  return (
    <_CompactSelect
      {...props}
      triggerProps={{
        icon: triggerProps?.icon,
        className: 'tag-button',
      }}
      css={css`
        width: 100%;

        .tag-button {
          border-radius: 0 ${theme.borderRadius} ${theme.borderRadius} 0;
          width: 100%;
        }

        @media (min-width: ${theme.breakpoints.small}) {
          .tag-button {
            border-radius: 0;
          }
          :last-child .tag-button {
            border-radius: 0 ${theme.borderRadius} ${theme.borderRadius} 0;
          }
        }
      `}
      className={className}
    />
  );
}

function DeleteButton({
  title,
  onClick,
  disabled,
}: {
  onClick: () => void;
  title: string;
  disabled?: boolean;
}) {
  return (
    <Tooltip title={title} delay={SLOW_TOOLTIP_DELAY}>
      <StyledButton
        icon={<IconDelete size="xs" />}
        disabled={disabled}
        aria-label={title}
        onClick={onClick}
      />
    </Tooltip>
  );
}

const StyledButton = styled(Button)`
  border-top-left-radius: 0;
  border-bottom-left-radius: 0;
  border-left: none;
`;

const ComboBox = styled(_ComboBox)`
  width: 100%;
  input {
    min-width: 100%;
    border-radius: 0;
    font-weight: 600;
  }
  :last-child input {
    border-radius: 0 ${p => p.theme.borderRadius} ${p => p.theme.borderRadius} 0;
  }
`;

const searchCss = (theme: Theme) => css`
  border-radius: 0;
  :last-child {
    border-radius: 0 ${theme.borderRadius} ${theme.borderRadius} 0;
  }

  label {
    color: ${theme.gray500};
  }
`;

const SmartSearchBar = styled(_SmartSearchBar)`
  ${p => searchCss(p.theme)}
`;

const SearchQueryBuilder = styled(_SearchQueryBuilder)`
  ${p => searchCss(p.theme)}
`;

const FieldGroup = styled('div')`
  flex-grow: 1;

  display: grid;
  grid-template-columns: max-content 1fr;
  grid-row-gap: ${space(1)};

  > *:nth-child(even) {
    margin-left: -1px;
    width: calc(100% + 1px);
  }

  @media (min-width: ${p => p.theme.breakpoints.small}) {
    display: flex;
    > *:not(:first-child) {
      margin-left: -1px;
    }
  }
`;

const Label = styled('span')`
  color: ${p => p.theme.purple300};
  background: ${p => p.theme.purple100};
  border: 1px solid ${p => p.theme.purple200};
  font-weight: 600;
  padding: 0 ${space(2)};
  gap: ${space(1)};
  display: inline-flex;
  align-items: center;
  z-index: 3;
  border-radius: ${p => p.theme.borderRadius} 0 0 ${p => p.theme.borderRadius};

  @media (min-width: ${p => p.theme.breakpoints.small}) {
    border-radius: 0;
    :first-child {
      border-radius: ${p => p.theme.borderRadius} 0 0 ${p => p.theme.borderRadius};
    }
  }
`;

const DebouncedInput = styled(_DebouncedInput)`
  border-radius: 0;
  z-index: 1;
`;

QueryFieldGroup.Label = Label;
QueryFieldGroup.CompactSelect = CompactSelect;
QueryFieldGroup.ComboBox = ComboBox;
QueryFieldGroup.SmartSearchBar = SmartSearchBar;
QueryFieldGroup.SearchQueryBuilder = SearchQueryBuilder;
QueryFieldGroup.DebouncedInput = DebouncedInput;
QueryFieldGroup.DeleteButton = DeleteButton;
