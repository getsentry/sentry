import {Fragment} from 'react';
import {components as selectComponents} from 'react-select';
import styled from '@emotion/styled';

import MenuListItem from 'sentry/components/menuListItem';
import Tooltip from 'sentry/components/tooltip';
import {IconCheckmark} from 'sentry/icons';
import {defined} from 'sentry/utils';

type Props = React.ComponentProps<typeof selectComponents.Option>;

function SelectOption(props: Props) {
  const {label, data, selectProps, isMulti, isSelected, isFocused, isDisabled} = props;
  const {showDividers} = selectProps;
  const {
    value,
    tooltip,
    tooltipOptions = {delay: 500},
    selectionMode,
    priority,
    ...itemProps
  } = data;

  const isMultiple = defined(selectionMode) ? selectionMode === 'multiple' : isMulti;

  // Unless the priority prop is explicitly defined, use 'primary' for
  // selected items in single-selection menus and 'default' for the rest.
  const itemPriority = priority ?? (isSelected && !isMultiple ? 'primary' : 'default');

  return (
    <selectComponents.Option className="select-option" {...props}>
      <Tooltip skipWrapper title={tooltip} {...tooltipOptions}>
        <MenuListItem
          {...itemProps}
          as="div"
          label={label}
          isDisabled={isDisabled}
          isFocused={isFocused}
          showDivider={showDividers}
          priority={itemPriority}
          innerWrapProps={{'data-test-id': value}}
          labelProps={{as: typeof label === 'string' ? 'p' : 'div'}}
          leadingItems={
            <Fragment>
              <CheckWrap isMultiple={isMultiple} isSelected={isSelected}>
                {isSelected && (
                  <IconCheckmark
                    size={isMultiple ? 'xs' : 'sm'}
                    color={isMultiple ? 'white' : undefined}
                  />
                )}
              </CheckWrap>
              {data.leadingItems}
            </Fragment>
          }
        />
      </Tooltip>
    </selectComponents.Option>
  );
}

export default SelectOption;

const CheckWrap = styled('div')<{isMultiple: boolean; isSelected: boolean}>`
  display: flex;
  justify-content: center;
  align-items: center;

  ${p =>
    p.isMultiple
      ? `
      width: 1em;
      height: 1em;
      padding: 1px;
      border: solid 1px ${p.theme.border};
      background: ${p.theme.backgroundElevated};
      border-radius: 2px;
      box-shadow: inset ${p.theme.dropShadowLight};
      ${
        p.isSelected &&
        `
        background: ${p.theme.purple300};
        border-color: ${p.theme.purple300};
       `
      }
    `
      : `
      width: 1em;
      height: 1.4em;
      padding-bottom: 1px;
    `}
`;
