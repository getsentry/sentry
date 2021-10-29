import styled from '@emotion/styled';

import {ButtonLabel} from 'app/components/button';
import CheckboxFancy from 'app/components/checkboxFancy/checkboxFancy';
import DropdownButton from 'app/components/dropdownButton';
import DropdownControl, {Content} from 'app/components/dropdownControl';
import List from 'app/components/list';
import ListItem from 'app/components/list/listItem';
import Tooltip from 'app/components/tooltip';
import {t, tct} from 'app/locale';
import space from 'app/styles/space';
import {PlatformType, SelectValue} from 'app/types';

export enum DisplayOption {
  UNSYMBOLICATED = 'unsymbolicated',
  ABSOLUTE_ADDRESSES = 'absolute-addresses',
  ABSOLUTE_FILE_PATHS = 'absolute-file-paths',
  VERBOSE_FUNCTION_NAMES = 'verbose-function-names',
  FULL_STACK_TRACE = 'full-stack-trace',
  MINIFIED = 'minified',
}

type Props = {
  platform: PlatformType;
  activeDisplayOptions: DisplayOption[];
  onChange: (activeDisplayOptions: DisplayOption[]) => void;
  hasMinified: boolean;
};

function DisplayOptions({activeDisplayOptions, onChange, hasMinified, platform}: Props) {
  const DISPLAY_OPTIONS: SelectValue<string>[] = [
    {label: t('Unsymbolicated'), value: DisplayOption.UNSYMBOLICATED},
    {label: t('Absolute Addresses'), value: DisplayOption.ABSOLUTE_ADDRESSES},
    {label: t('Absolute File Paths'), value: DisplayOption.ABSOLUTE_FILE_PATHS},
    {label: t('Verbose Function Names'), value: DisplayOption.VERBOSE_FUNCTION_NAMES},
    {label: t('Full Stack Trace'), value: DisplayOption.FULL_STACK_TRACE},
  ];

  if (platform === 'javascript' || platform === 'node') {
    // Replaces Unsymbolicated option
    DISPLAY_OPTIONS[0] = {
      label: t('Minified'),
      value: DisplayOption.MINIFIED,
      disabled: !hasMinified,
      tooltip: !hasMinified ? t('Minified version not available') : undefined,
    };
  }

  function handleChange(value: DisplayOption) {
    const newActiveDisplayOptions = activeDisplayOptions.includes(value)
      ? activeDisplayOptions.filter(activeDisplayOption => activeDisplayOption !== value)
      : [...activeDisplayOptions, value];

    onChange(newActiveDisplayOptions);
  }
  return (
    <Wrapper
      button={({isOpen, getActorProps}) => (
        <StyledDropdownButton
          {...getActorProps()}
          isOpen={isOpen}
          prefix={t('Options')}
          size="small"
          hideBottomBorder={false}
        >
          {tct('[activeOptionsQuantity] Active', {
            activeOptionsQuantity: activeDisplayOptions.length,
          })}
        </StyledDropdownButton>
      )}
    >
      {({getMenuProps, isOpen}) => (
        <StyledContent
          {...getMenuProps()}
          data-test-id="filter-dropdown-menu"
          alignMenu="left"
          width="240px"
          isOpen={isOpen}
          blendWithActor
          blendCorner
        >
          <StyledList>
            {DISPLAY_OPTIONS.map(({label, value, disabled, tooltip}) => {
              const displayOption = value as DisplayOption;
              const isDisabled = !!disabled;
              const isChecked = activeDisplayOptions.includes(displayOption);
              return (
                <Tooltip key={value} title={tooltip} disabled={!tooltip}>
                  <StyledListItem
                    onClick={event => {
                      event.stopPropagation();

                      if (isDisabled) {
                        return;
                      }
                      handleChange(displayOption);
                    }}
                    isDisabled={isDisabled}
                    isChecked={isChecked}
                  >
                    {label}
                    <CheckboxFancy isChecked={isChecked} isDisabled={isDisabled} />
                  </StyledListItem>
                </Tooltip>
              );
            })}
          </StyledList>
        </StyledContent>
      )}
    </Wrapper>
  );
}

export default DisplayOptions;

const Wrapper = styled(DropdownControl)`
  z-index: 1;
  &,
  button {
    width: 100%;
  }
  grid-column: 1/-1;
  grid-row: 3/3;

  @media (min-width: ${p => p.theme.breakpoints[0]}) {
    grid-column: 2/2;
    grid-row: 2/2;
  }

  @media (min-width: ${p => p.theme.breakpoints[3]}) {
    grid-column: auto;
    grid-row: auto;
  }
`;

const StyledContent = styled(Content)`
  top: calc(100% + ${space(0.5)} - 2px);
  border-radius: ${p => p.theme.borderRadius};
  > ul:last-child {
    > li:last-child {
      border-bottom: none;
    }
  }
`;

const StyledDropdownButton = styled(DropdownButton)`
  z-index: ${p => p.theme.zIndex.dropdownAutocomplete.actor};
  border-radius: ${p => p.theme.borderRadius};
  max-width: 200px;
  white-space: nowrap;

  ${ButtonLabel} {
    grid-template-columns: max-content 1fr max-content;
  }

  ${p =>
    p.isOpen &&
    `
      :before,
      :after {
        position: absolute;
        bottom: calc(${space(0.5)} + 1px);
        right: 32px;
        content: '';
        width: 16px;
        border: 8px solid transparent;
        transform: translateY(calc(50% + 2px));
        right: 9px;
        border-bottom-color: ${p.theme.white};
      }

      :before {
        transform: translateY(calc(50% + 1px));
        border-bottom-color: ${p.theme.border};
      }
    `}
`;

const StyledList = styled(List)`
  grid-gap: 0;
`;

const StyledListItem = styled(ListItem)<{isChecked: boolean; isDisabled: boolean}>`
  display: grid;
  grid-template-columns: 1fr max-content;
  grid-column-gap: ${space(1)};
  padding: ${space(1)} ${space(2)};
  border-bottom: 1px solid ${p => p.theme.border};
  align-items: center;
  cursor: pointer;
  font-size: ${p => p.theme.fontSizeMedium};

  :last-child {
    border-bottom: none;
  }

  ${CheckboxFancy} {
    opacity: ${p => (p.isChecked ? 1 : 0.3)};
  }

  :hover {
    background-color: ${p => p.theme.backgroundSecondary};
    ${CheckboxFancy} {
      opacity: 1;
    }
  }

  ${p =>
    p.isDisabled &&
    `
      color: ${p.theme.disabled};
      cursor: not-allowed;

      :hover {
        ${CheckboxFancy} {
          opacity: 0.3;
        }
      }
    `}
`;
