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
  hasVerboseFunctionNames: boolean;
  hasAbsoluteFilePaths: boolean;
  hasAbsoluteAddresses: boolean;
  hasAppOnlyFrames: boolean;
};

function DisplayOptions({
  activeDisplayOptions,
  onChange,
  hasMinified,
  hasVerboseFunctionNames,
  hasAbsoluteFilePaths,
  hasAbsoluteAddresses,
  hasAppOnlyFrames,
  platform,
}: Props) {
  const DISPLAY_OPTIONS: SelectValue<string>[] = [
    {
      label: t('Unsymbolicated'),
      value: DisplayOption.MINIFIED,
      disabled: !hasMinified,
      tooltip: !hasMinified ? t('Unsymbolicated version not available') : undefined,
    },
    {
      label: t('Absolute Addresses'),
      value: DisplayOption.ABSOLUTE_ADDRESSES,
      disabled: !hasAbsoluteAddresses,
      tooltip: !hasAbsoluteAddresses ? t('Absolute Addresses not available') : undefined,
    },
    {
      label: t('Absolute File Paths'),
      value: DisplayOption.ABSOLUTE_FILE_PATHS,
      disabled: !hasAbsoluteFilePaths,
      tooltip: !hasAbsoluteFilePaths ? t('Absolute File Paths not available') : undefined,
    },
    {
      label: t('Verbose Function Names'),
      value: DisplayOption.VERBOSE_FUNCTION_NAMES,
      disabled: !hasVerboseFunctionNames,
      tooltip: !hasVerboseFunctionNames
        ? t('Verbose Function Names not available')
        : undefined,
    },
    {
      label: t('Full Stack Trace'),
      value: DisplayOption.FULL_STACK_TRACE,
      disabled: !hasAppOnlyFrames,
      tooltip: !hasAppOnlyFrames ? t('Only full version available') : undefined,
    },
  ];

  if (platform === 'javascript' || platform === 'node') {
    // Replaces Unsymbolicated option
    DISPLAY_OPTIONS[0].label = t('Minified');
    DISPLAY_OPTIONS[0].tooltip = !hasMinified
      ? t('Minified version not available')
      : undefined;
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
        <OptionsButton
          {...getActorProps()}
          isOpen={isOpen}
          prefix={t('Options')}
          size="small"
          hideBottomBorder={false}
        >
          {tct('[activeOptionsQuantity] Active', {
            activeOptionsQuantity: activeDisplayOptions.length,
          })}
        </OptionsButton>
      )}
    >
      {({getMenuProps, isOpen}) => (
        <DropdownMenu
          {...getMenuProps()}
          data-test-id="filter-dropdown-menu"
          alignMenu="right"
          isOpen={isOpen}
          blendWithActor
          blendCorner
        >
          <OptionList>
            {DISPLAY_OPTIONS.map(({label, value, disabled, tooltip}) => {
              const displayOption = value as DisplayOption;
              const isDisabled = !!disabled;
              const isChecked = activeDisplayOptions.includes(displayOption);
              return (
                <Option
                  key={value}
                  onClick={event => {
                    event.stopPropagation();

                    if (isDisabled) {
                      return;
                    }
                    handleChange(displayOption);
                  }}
                >
                  <OptionTooltip title={tooltip} disabled={!tooltip}>
                    <ItemContent isDisabled={isDisabled} isChecked={isChecked}>
                      {label}
                      <CheckboxFancy isChecked={isChecked} isDisabled={isDisabled} />
                    </ItemContent>
                  </OptionTooltip>
                </Option>
              );
            })}
          </OptionList>
        </DropdownMenu>
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
    max-width: 100%;
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

const DropdownMenu = styled(Content)`
  width: 100%;
  border-top: none;

  @media (min-width: ${p => p.theme.breakpoints[0]}) {
    top: calc(100% + ${space(0.5)} - 2px);
    border-radius: ${p => p.theme.borderRadius};
    border-top: 1px solid ${p => p.theme.border};
    width: 240px;
  }

  > ul:last-child {
    > li:last-child {
      border-bottom: none;
    }
  }
`;

const OptionsButton = styled(DropdownButton)`
  z-index: ${p => p.theme.zIndex.dropdownAutocomplete.actor};
  white-space: nowrap;

  @media (min-width: ${p => p.theme.breakpoints[0]}) {
    max-width: 200px;
    border-radius: ${p => p.theme.borderRadius};

    ${p =>
      p.isOpen &&
      `
        :before,
        :after {
          position: absolute;
          bottom: calc(${space(0.5)} + 1px);
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
  }

  @media (min-width: ${p => p.theme.breakpoints[3]}) {
    ${ButtonLabel} {
      grid-template-columns: max-content 1fr max-content;
    }
  }
`;

const OptionList = styled(List)`
  grid-gap: 0;
`;

const ItemContent = styled('div')<{isChecked: boolean; isDisabled: boolean}>`
  display: grid;
  grid-template-columns: 1fr max-content;
  grid-column-gap: ${space(1)};
  padding: ${space(1)} ${space(2)};
  align-items: center;
  cursor: pointer;
  font-size: ${p => p.theme.fontSizeMedium};

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

const Option = styled(ListItem)`
  border-bottom: 1px solid ${p => p.theme.border};
`;

const OptionTooltip = styled(Tooltip)`
  width: 100%;
`;
